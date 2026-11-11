from fastapi.testclient import TestClient
import json
from pathlib import Path

import pytest

from backend.main import app
from backend.astronomy import spherex_client


def test_server_offline_blocks_real_not_synthetic(monkeypatch):
    monkeypatch.setenv('SPHERALYX_OFFLINE', '1')
    def forbidden(*args, **kwargs):
        raise AssertionError('Se intentó acceso a IRSA')
    monkeypatch.setattr(spherex_client, 'search', forbidden)
    client = TestClient(app)
    assert client.get('/api/observations?ra=1&dec=1').status_code == 503
    assert client.post('/api/temporal/pairs', json={'ra': 1, 'dec': 1}).status_code == 503
    assert client.post('/api/temporal/compare', json={'a': 'a'*64, 'b': 'b'*64}).status_code == 503
    assert client.post('/api/experimental/motion', json={'seed': 42}).status_code == 200
    assert client.get('/health').json()['data_mode'] == 'offline'
    assert client.get('/').status_code == 200



def test_synthetic_experiments_are_hidden_and_blocked_in_public_mode(monkeypatch):
    """El despliegue público solo ofrece observaciones y catálogos reales."""
    monkeypatch.delenv('SPHERALYX_INTERNAL_EXPERIMENTS', raising=False)
    client = TestClient(app)
    paths = ('/api/experimental/motion', '/api/experimental/validation', '/api/experimental/classification')
    for path in paths:
        response = client.post(path, json={})
        assert response.status_code == 404
        assert 'no están disponibles' in response.json()['detail']
    schema = client.get('/openapi.json').json()
    assert all(path not in schema['paths'] for path in paths)

def test_offline_disabled_by_default(monkeypatch):
    monkeypatch.delenv('SPHERALYX_OFFLINE', raising=False)
    monkeypatch.setattr(spherex_client, 'search', lambda *args: [])
    response = TestClient(app).get('/api/observations?ra=1&dec=1')
    assert response.status_code == 200 and response.json()['mode'] == 'real'


def test_release_identifier_matches_api():
    root = Path(__file__).resolve().parents[1]
    version = (root / 'VERSION').read_text(encoding='utf-8').strip()
    assert TestClient(app).get('/openapi.json').json()['info']['version'] == version


def test_archived_synthetic_sample():
    sample = json.loads((Path(__file__).resolve().parents[1] / 'data/samples/astromotion-seed42.json').read_text(encoding='utf-8'))
    actual = TestClient(app).post('/api/experimental/motion', json=sample['parameters']).json()['metrics']
    for key in ('true_positive', 'false_positive', 'false_negative', 'precision', 'recall'):
        assert actual[key] == sample['metrics'][key]
    assert actual['mean_absolute_displacement_error_arcsec'] == pytest.approx(sample['metrics']['mean_absolute_displacement_error_arcsec'], abs=1e-5)
