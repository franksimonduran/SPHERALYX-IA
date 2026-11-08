import hashlib
import io
import json
import os

import httpx
import numpy as np
import pytest
from astropy.io import fits
from fastapi.testclient import TestClient

from backend.astronomy import calibration, network, pair_finder, temporal
from backend.main import app

UUID='12345678-1234-1234-1234-123456789abc'


def calibration_fixture(tmp_path, monkeypatch):
    path=tmp_path/'spectral_wcs_D2_spx_cal-wcs-v4-2025-254.fits'
    primary=fits.PrimaryHDU();primary.header['DETCOORD']='sky'
    cw=fits.ImageHDU(np.arange(36,dtype=float).reshape(6,6)+1,name='CWAVE')
    cb=fits.ImageHDU(np.ones((6,6))*.05,name='CBAND')
    for h in (cw,cb): h.header['DETECTOR']=2;h.header['BUNIT']='um'
    fits.HDUList([primary,cw,cb]).writeto(path)
    record={'uuid':UUID,'detector':2,'release':'qr2','version':'4','file':path.name,
            'source_url':'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/spectral_wcs/cal-wcs-v4-2025-254/2/'+path.name,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    manifest=tmp_path/'manifest.json';manifest.write_text(json.dumps([record]),encoding='utf8')
    monkeypatch.setenv('SPHERALYX_CALIBRATION_MANIFEST',str(manifest))
    header=fits.Header();header['DETECTOR']=2;header['DETCOORD']='sky';header['CRPIX1A']=0;header['CRPIX2A']=0
    header.add_history('[CALIB] spectral_wcs '+UUID)
    return header,record,manifest


def test_verified_calibration_and_origin(tmp_path, monkeypatch):
    header,record,_=calibration_fixture(tmp_path,monkeypatch)
    cw,cb,info=calibration.calibrated_maps(header,(2,2),'qr2')
    assert info['verified'] and info['version']=='4' and cw[0,0]==8 and cb[0,0]==pytest.approx(.05)
    assert calibration.spectral_uuid(header)==UUID
    assert calibration.select_record([record,record],UUID,2,'qr2') is None


@pytest.mark.parametrize('problem',['release','detector','checksum','version','orientation','origin'])
def test_calibration_mismatch_fails_closed(tmp_path,monkeypatch,problem):
    header,record,manifest=calibration_fixture(tmp_path,monkeypatch)
    release='qr2'
    if problem=='release': release='qr3'
    if problem=='detector': header['DETECTOR']=3
    if problem=='checksum': record['sha256']='0'*64
    if problem=='version': record['version']='5'
    if problem=='orientation': header['DETCOORD']='detector'
    if problem=='origin': header['CRPIX1A']=.5
    manifest.write_text(json.dumps([record]),encoding='utf8')
    assert not calibration.calibrated_maps(header,(2,2),release)[2]['verified']


@pytest.mark.parametrize('status',[429,502,503,504])
def test_retry_then_success(monkeypatch,status):
    calls=[]; real=httpx.Client
    def handler(request):
        calls.append(request)
        return httpx.Response(status if len(calls)==1 else 200,content=b'ok')
    monkeypatch.setattr(network.httpx,'Client',lambda **kw:real(transport=httpx.MockTransport(handler),**kw))
    monkeypatch.setattr(network.time,'sleep',lambda _:None)
    assert network.fetch_bytes('https://irsa.ipac.caltech.edu/SIA',{},10)==b'ok' and len(calls)==2


def test_retry_429_respects_long_wait(monkeypatch):
    real=httpx.Client
    monkeypatch.setattr(network.httpx,'Client',lambda **kw:real(transport=httpx.MockTransport(lambda req:httpx.Response(429,headers={'Retry-After':'100'})),**kw))
    with pytest.raises(httpx.HTTPStatusError): network.fetch_bytes('https://irsa.ipac.caltech.edu/SIA',{},10)


def test_network_deadline_stops_retry(monkeypatch):
    real=httpx.Client; calls=[]
    def handler(request):
        calls.append(request)
        return httpx.Response(503,headers={'Retry-After':'2'})
    monkeypatch.setattr(network.httpx,'Client',lambda **kw:real(transport=httpx.MockTransport(handler),**kw))
    with pytest.raises(httpx.ReadTimeout):
        network.fetch_bytes('https://irsa.ipac.caltech.edu/SIA',{},10,deadline=network.time.monotonic()+1)
    assert len(calls)==1


def item(id, t, band='D2'):
    return {'id':id*64,'band':band,'time_start_mjd':t,'release':'qr2','calibration_level':2,'observation_id':id}


def test_pair_search_prefilter_and_empty(monkeypatch):
    items=[item('a',60001),item('b',60002),item('c',60003,'D3'),item('d',60001)]
    assert len(pair_finder.rank_pairs(items))==2
    monkeypatch.setattr(pair_finder.spherex_client,'search',lambda *a:[])
    result=pair_finder.find_pairs(1,2)
    assert result['evaluated_count']==0 and result['pairs']==[]
    assert TestClient(app).post('/api/temporal/pairs',json={'ra':360,'dec':0}).status_code==422


def test_pair_search_reports_rejection(monkeypatch):
    monkeypatch.setattr(pair_finder.spherex_client,'search',lambda *a:[item('a',60001),item('b',60002)])
    monkeypatch.setattr(temporal,'compare',lambda *a:{'compatible':False,'reasons':['incompatible'],'coverage_fraction':.5,'spectral_match_fraction':0.,'spectral_status':'aproximada_no_verificada','fits_a':{'calibration':{'verified':False}},'fits_b':{'calibration':{'verified':False}},'id':'x'})
    result=pair_finder.find_pairs(1,2)
    assert result['evaluated_count']==1 and result['accepted_count']==0 and result['pairs'][0]['reasons']==['incompatible']


def test_pair_search_reports_controlled_acceptance(monkeypatch):
    monkeypatch.setattr(pair_finder.spherex_client,'search',lambda *a:[item('a',60001),item('b',60002)])
    monkeypatch.setattr(temporal,'compare',lambda *a:{'compatible':True,'reasons':[],'coverage_fraction':.9,'spectral_match_fraction':1.,'spectral_status':'calibrada','fits_a':{'calibration':{'verified':True}},'fits_b':{'calibration':{'verified':True}},'id':'x'})
    result=pair_finder.find_pairs(1,2)
    assert result['accepted_count']==1 and result['pairs'][0]['status']=='aceptado_exploratorio'


def test_rank_by_image_center():
    a,b,c=item('a',60000),item('b',60001),item('c',60002)
    a['image_center']={'ra':10,'dec':0};b['image_center']={'ra':20,'dec':0};c['image_center']={'ra':10.01,'dec':0}
    assert pair_finder.rank_pairs([a,b,c])[0] == (a,c)


def test_wcs_wave_alone_cannot_authorize_difference():
    from test_temporal import science, item as temporal_item
    a,b=science(),science()
    a['calibration']={'verified':False};b['calibration']={'verified':False}
    result=temporal.compare_arrays(a,b,temporal_item('a',60001),temporal_item('b',60002))
    assert not result['compatible'] and 'difference' not in result['views'] and result['spectral_status']=='aproximada_no_verificada'


@pytest.mark.skipif(os.getenv('SPHERALYX_LIVE_PAIRS') != '1', reason='Consulta IRSA opcional')
def test_live_pair_search():
    result=pair_finder.find_pairs(83.8221,-5.3911,release='qr2',max_pairs=1)
    assert result['mode']=='real' and result['evaluated_count']<=1
    for pair in result['pairs']:
        assert pair['status'] in ('rechazado','aceptado_exploratorio','error')
