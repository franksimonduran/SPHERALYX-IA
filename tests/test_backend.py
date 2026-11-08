import io
import os

import httpx
import numpy as np
import pytest
from astropy.io import fits
from fastapi.testclient import TestClient
from PIL import Image

from backend.main import app
from backend.astronomy import fits_processor as fp, spherex_client as sc

client = TestClient(app)
URL = "https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/level2/example.fits"


@pytest.mark.parametrize("query", ["ra=-1&dec=0", "ra=360&dec=0", "ra=0&dec=-91", "ra=0&dec=91", "ra=nan&dec=0", "ra=0&dec=0&radius=0", "ra=0&dec=0&radius=0.251", "ra=0&dec=0&release=qr1"])
def test_invalid(query):
    assert client.get("/api/observations?" + query).status_code == 422


def test_health():
    assert client.get('/health').json()['upstream_checked'] is False


def test_empty(monkeypatch):
    monkeypatch.setattr(sc, 'search', lambda *args: [])
    response = client.get('/api/observations?ra=0&dec=-90&radius=0.25')
    assert response.status_code == 200 and response.json()['observations'] == []
    assert response.json()['mode'] == 'real'


def test_upstream_error(monkeypatch):
    def fail(*args):
        raise sc.IrsaError('No se pudo consultar IRSA')
    monkeypatch.setattr(sc, 'search', fail)
    assert client.get('/api/observations?ra=1&dec=1').status_code == 502


def test_sia_csv_and_network_failure(monkeypatch):
    real_client = httpx.Client
    body = 'access_url,obs_id,energy_bandpassname,dataproduct_subtype\n' + URL + ',obs-1,D2,science\n'
    def factory(handler):
        return lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)
    def ok(request):
        assert request.url.params['COLLECTION'] == 'spherex_qr2'
        assert request.url.params['POS'].startswith('CIRCLE ')
        return httpx.Response(200, text=body)
    monkeypatch.setattr(sc.httpx, 'Client', factory(ok))
    items = sc.search(1, 2, .01, 'qr2')
    assert len(items) == 1 and items[0]['band'] == 'D2'
    def empty(request):
        return httpx.Response(200, text='access_url,obs_id\n')
    monkeypatch.setattr(sc.httpx, 'Client', factory(empty))
    assert sc.search(1, 2, .01, 'qr2') == []
    def timeout(request):
        raise httpx.ConnectTimeout('offline', request=request)
    monkeypatch.setattr(sc.httpx, 'Client', factory(timeout))
    with pytest.raises(sc.IrsaError, match='tiempo'):
        sc.search(1, 2, .01, 'qr2')


def test_normalization_and_id():
    row = {'access_url': URL, 'obs_id': 'obs', 'energy_bandpassname': 'D2', 'em_min': '1e-6', 't_min': 'nan'}
    item = sc.normalize(row, 'qr2', 1, 2)
    assert item['band'] == 'D2' and item['wavelength_min_m'] == 1e-6 and item['time_start_mjd'] is None
    sc._store(item)
    assert client.get('/api/observations/' + item['id']).json()['reference_url'] == URL
    assert client.get('/api/observations/invalid').status_code == 404
    assert sc.normalize({**row, 'access_url': 'https://evil.example/test.fits'}, 'qr2', 1, 2) is None
    assert not sc.allowed_url('https://irsa.ipac.caltech.edu/ibe/data/spherex/../other.fits')
    assert not sc.allowed_url(URL + '?url=https://example.com')


def sample_fits():
    image = np.arange(100, dtype=np.float32).reshape(10, 10)
    image[0, 0] = np.nan
    flags = np.zeros((10, 10), dtype=np.int16)
    flags[1, 1] = 8
    hdu = fits.ImageHDU(image, name='IMAGE')
    hdu.header['BUNIT'] = 'MJy/sr'
    buffer = io.BytesIO()
    fits.HDUList([fits.PrimaryHDU(), hdu, fits.ImageHDU(flags, name='FLAGS')]).writeto(buffer)
    return buffer.getvalue()


def test_fits_png():
    png, info = fp.process_fits(sample_fits())
    assert Image.open(io.BytesIO(png)).format == 'PNG'
    assert info['invalid_pixels'] == 1 and info['nonzero_flag_pixels'] == 1
    assert info['image_extension'] == 'IMAGE'
    with pytest.raises(ValueError):
        fp.process_fits(b'not fits')


def test_preview_endpoint_mock(monkeypatch):
    item = sc.normalize({'access_url': URL}, 'qr2', 1, 2)
    sc._store(item)
    monkeypatch.setattr(fp, 'get_preview', lambda _: fp.process_fits(sample_fits()))
    response = client.get('/api/observations/' + item['id'] + '/preview')
    assert response.status_code == 200 and response.headers['content-type'] == 'image/png'
    assert response.headers['x-preview-scientific'] == 'false'


@pytest.mark.skipif(os.getenv('SPHERALYX_LIVE_TEST') != '1', reason='Prueba real opcional')
def test_live_irsa():
    items = sc.search(156.09328159, -41.64466331, .01, 'qr2')
    assert items
    png, info = fp.get_preview(items[0])
    assert png.startswith(b'\x89PNG') and info['image_extension'] == 'IMAGE'
