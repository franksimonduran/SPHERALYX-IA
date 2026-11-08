import os

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.astronomy import datalink, spherex_client
from backend.main import app

PID = 'ivo://irsa.ipac/spherex_qr2?2025W37_1A_0685_1/D2'
URL = 'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/level2/example.fits'


def votable(identifier=PID, status='OK'):
    return f'''<?xml version="1.0"?><VOTABLE xmlns="http://www.ivoa.net/xml/VOTable/v1.3">
    <RESOURCE type="meta" utype="adhoc:service" ID="cutout"><PARAM name="accessURL" value="https://irsa.ipac.caltech.edu/ibe/cutout"/><GROUP name="inputParams"><PARAM name="ra" ref="col_13" value=""/></GROUP></RESOURCE>
    <RESOURCE type="results"><INFO name="QUERY_STATUS" value="{status}"/><TABLE>
    <FIELD name="id"/><FIELD name="semantics"/><FIELD name="access_url"/><FIELD name="service_def"/><FIELD name="error_message"/><FIELD name="description"/><FIELD name="content_type"/>
    <DATA><TABLEDATA><TR><TD>{identifier}</TD><TD>#this</TD><TD>{URL}</TD><TD/><TD/><TD>science</TD><TD>image/fits</TD></TR>
    <TR><TD>{identifier}</TD><TD>#cutout</TD><TD/><TD>cutout</TD><TD/><TD>cutout</TD><TD>image/fits</TD></TR></TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>'''.encode()


def test_parse_links_and_descriptor():
    result = datalink.parse_links(votable(), PID)
    assert [row['semantics'] for row in result['links']] == ['#this', '#cutout']
    assert result['services'][0]['id'] == 'cutout'
    assert result['services'][0]['inputs'][0]['ref'] == 'col_13'
    assert result['uuid_association_verified'] is False and not result['spectral_candidates']


def test_calibration_link_is_candidate_not_uuid_proof():
    xml = votable().replace(b'>science<', b'>spectral_wcs calibration<')
    result = datalink.parse_links(xml, PID)
    assert len(result['spectral_candidates']) == 1 and not result['uuid_association_verified']


@pytest.mark.parametrize('raw', [b'not xml', b'<!DOCTYPE x [<!ENTITY a "x">]><x/>', votable(status='ERROR'), votable(identifier='ivo://irsa.ipac/spherex_qr2?other/D2')])
def test_fail_closed(raw):
    with pytest.raises(ValueError): datalink.parse_links(raw, PID)


def test_fixed_url_and_errors(monkeypatch):
    def mock(url, params, limit, timeout):
        assert url == datalink.LINKS_URL and params == {'ID': PID}
        return votable()
    monkeypatch.setattr(datalink, 'fetch_bytes', mock)
    assert len(datalink.inspect(PID)['links']) == 2
    with pytest.raises(ValueError): datalink.inspect('https://example.org/')
    def fail(*args, **kwargs): raise httpx.ConnectTimeout('timeout')
    monkeypatch.setattr(datalink, 'fetch_bytes', fail)
    with pytest.raises(spherex_client.IrsaError): datalink.inspect(PID)


def test_api_integration(monkeypatch):
    item = spherex_client.normalize({'access_url': URL, 'obs_publisher_did': PID}, 'qr2', 83.8221, -5.3911)
    spherex_client._store(item)
    monkeypatch.setattr(datalink, 'fetch_bytes', lambda *args, **kwargs: votable())
    client = TestClient(app)
    response = client.get('/api/observations/' + item['id'] + '/calibration-links')
    assert response.status_code == 200 and response.json()['mode'] == 'real'
    assert not response.json()['uuid_association_verified']
    assert client.get('/api/observations/invalid/calibration-links').status_code == 404
    def fail(*args, **kwargs): raise httpx.ConnectTimeout('offline')
    monkeypatch.setattr(datalink, 'fetch_bytes', fail)
    assert client.get('/api/observations/' + item['id'] + '/calibration-links').status_code == 502


@pytest.mark.skipif(os.getenv('SPHERALYX_LIVE_DATALINK') != '1', reason='IRSA opcional')
def test_real_irsa_datalink():
    result = datalink.inspect(PID)
    assert result['publisher_id'] == PID and not result['uuid_association_verified']
    assert any(row['semantics'] == '#this' for row in result['links'])
