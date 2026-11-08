import io
import os
import base64

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient
from PIL import Image

from backend.main import app
from backend.astronomy import temporal, spherex_client as sc


def science(offset=0, shift=0):
    w = WCS(naxis=2)
    w.wcs.crpix = [10 + shift, 10]; w.wcs.cdelt = [-.001, .001]
    w.wcs.crval = [20, 30]; w.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    image = np.arange(400, dtype=float).reshape(20, 20) + offset
    return {'image': image, 'variance': np.ones_like(image), 'valid': np.ones_like(image, dtype=bool),
            'wcs': w, 'wavelength': np.ones_like(image)*1.5, 'bandwidth': np.ones_like(image)*.05,
            'unit': 'MJy / sr', 'detector': 2, 'quality': 'Pass', 'calibration': {'verified': True, 'source': 'synthetic-test'}}


def item(id, time):
    return {'id': id*64, 'band': 'D2', 'time_start_mjd': time, 'release': 'qr2', 'calibration_level': 2}


def test_reproject_difference_and_masks():
    a, b = science(), science(offset=2, shift=1)
    a['valid'][0, 0] = False; b['valid'][4, 4] = False
    result = temporal.compare_arrays(a, b, item('a', 1), item('b', 2))
    assert result['compatible'] and result['coverage_fraction'] < 1
    assert result['spectral_match_fraction'] == 1 and result['views']['difference'].startswith('data:image/png;base64,')
    assert result['variance_approximate_pixels'] > 0
    assert result['difference_variance_approximate_median'] == pytest.approx(2)


def test_difference_pixel_value():
    a, b = science(), science(offset=2)
    result = temporal.compare_arrays(a, b, item('a', 1), item('b', 2))
    png = base64.b64decode(result['views']['difference'].split(',')[1])
    pixel = np.asarray(Image.open(io.BytesIO(png)))[10, 10]
    # D = +2 en la escala simétrica [-2, +2]: blanco, y cubierto.
    assert pixel[0] >= 254 and pixel[3] == 255


@pytest.mark.parametrize('change', ['band', 'epoch', 'release', 'quality', 'spectral', 'coverage', 'unit', 'missing_spectral'])
def test_incompatible(change):
    a, b, x, y = science(), science(), item('a', 1), item('b', 2)
    if change == 'band': y['band'] = 'D3'
    if change == 'epoch': y['time_start_mjd'] = 1
    if change == 'release': y['release'] = 'qr3'
    if change == 'quality': b['quality'] = 'Fail'
    if change == 'spectral': b['wavelength'] += .1
    if change == 'coverage': b['valid'][:] = False
    if change == 'unit': b['unit'] = 'Jy'
    if change == 'missing_spectral': b['wavelength'] = None
    result = temporal.compare_arrays(a, b, x, y)
    assert not result['compatible'] and 'difference' not in result['views'] and result['reasons']


def test_read_nan_flags_variance():
    a = science(); data = a['image'].copy(); data[1, 1] = np.nan
    flags = np.zeros(data.shape, dtype=np.int32); flags[2, 2] = 1 << 2; flags[3, 3] = 1 << 21
    variance = np.ones_like(data); variance[4, 4] = -1
    image_hdu = fits.ImageHDU(data, header=a['wcs'].to_header(), name='IMAGE')
    image_hdu.header['BUNIT']='MJy / sr'; image_hdu.header['DETECTOR']=2; image_hdu.header['L2DQAFLG']='Pass'
    variance_hdu = fits.ImageHDU(variance, name='VARIANCE'); variance_hdu.header['BUNIT']='MJy2 / sr2'
    out=io.BytesIO(); fits.HDUList([fits.PrimaryHDU(),image_hdu,fits.ImageHDU(flags,name='FLAGS'),variance_hdu]).writeto(out)
    result=temporal.read_science(out.getvalue())
    assert not result['valid'][1,1] and not result['valid'][2,2] and result['valid'][3,3] and not result['valid'][4,4]
    assert result['wavelength'] is None
    variance_hdu.header['BUNIT']='Jy'
    out=io.BytesIO(); fits.HDUList([fits.PrimaryHDU(),image_hdu,fits.ImageHDU(flags,name='FLAGS'),variance_hdu]).writeto(out)
    with pytest.raises(ValueError): temporal.read_science(out.getvalue())


def test_api_validation(monkeypatch):
    client=TestClient(app)
    assert client.post('/api/temporal/compare',json={'a':'invalid','b':'b'*64}).status_code == 422
    assert client.get('/api/temporal/results/not-valid').status_code == 404
    a, b = item('a', 1), item('b', 2); sc._store(a); sc._store(b)
    monkeypatch.setattr(temporal, 'compare', lambda x,y: {'mode':'real','compatible':False,'reasons':['prueba']})
    response=client.post('/api/temporal/compare',json={'a':a['id'],'b':b['id']})
    assert response.status_code == 200 and response.json()['compatible'] is False


def test_api_pipeline_with_mock_cutouts(monkeypatch, caplog):
    import logging
    caplog.set_level(logging.INFO, logger=temporal.__name__)
    client=TestClient(app)
    a, b = item('c', 60003), item('d', 60004)
    for entry in (a, b):
        entry.update({'observation_id':'synthetic-test', 'reference_url':'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/example.fits'})
        sc._store(entry)
    monkeypatch.setattr(temporal, 'download_cutout', lambda entry, **kwargs: entry['id'].encode())
    def read(raw, release=None):
        result = science(offset=0 if raw.startswith(b'c') else 2)
        result.update({'shape':[20,20], 'date_obs':'2025-01-01', 'wcs_ctype':['RA---TAN','DEC--TAN'], 'wcs_frame':'ICRS'})
        return result
    monkeypatch.setattr(temporal, 'read_science', read)
    response=client.post('/api/temporal/compare',json={'a':a['id'],'b':b['id']})
    assert response.status_code == 200 and response.json()['compatible']
    assert all(stage in caplog.text for stage in ('recuperacion_descarga_a', 'lectura_fits_a', 'reproyeccion', 'vistas'))
    assert client.get('/api/temporal/results/' + response.json()['id']).json()['views']['difference'].startswith('data:image/png;base64,')


def test_timeout_releases_semaphore_and_api_reports_504(monkeypatch):
    a, b = item('e', 60003), item('f', 60004)
    for entry in (a, b): sc._store(entry)
    monkeypatch.setattr(temporal, 'COMPARISON_BUDGET_SECONDS', 0)
    for _ in range(3):
        response = TestClient(app).post('/api/temporal/compare', json={'a':a['id'],'b':b['id']})
        assert response.status_code == 504
    assert temporal._semaphore.acquire(blocking=False)
    temporal._semaphore.release()


def test_comparison_busy_and_failure_release(monkeypatch):
    a, b = item('a', 1), item('b', 2)
    assert temporal._semaphore.acquire(blocking=False)
    assert temporal._semaphore.acquire(blocking=False)
    try:
        with pytest.raises(RuntimeError, match='demasiadas'): temporal.compare(a, b)
    finally:
        temporal._semaphore.release(); temporal._semaphore.release()
    def fail(*args, **kwargs): raise sc.IrsaError('error simulado')
    monkeypatch.setattr(temporal, 'download_cutout', fail)
    for _ in range(3):
        with pytest.raises(sc.IrsaError): temporal.compare(a, b)


@pytest.mark.skipif(os.getenv('SPHERALYX_LIVE_TEMPORAL') != '1', reason='IRSA opcional')
def test_live_pair_irsa():
    observations = sc.search(83.8221, -5.3911, .01, 'qr2')
    a, b = next((a, b) for i, a in enumerate(observations) for b in observations[i+1:]
                if a['band'] == b['band'] and a['time_start_mjd'] != b['time_start_mjd'])
    result = temporal.compare(a, b)
    assert result['mode'] == 'real' and result['a']['id'] != result['b']['id']
    assert result['compatible'] or 'difference' not in result['views']
