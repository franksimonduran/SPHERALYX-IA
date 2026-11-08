import numpy as np
from fastapi.testclient import TestClient

from backend.astronomy import classification_lab as lab
from backend.main import app


def points(vx=0., vy=0., n=4, dt=10., noise=.2, snr=30.):
    return [{'x': 30 + vx*k*dt, 'y': 40 + vy*k*dt,
             'sigma_total': noise, 'snr_peak': snr} for k in range(n)]


def test_stationary_moving_and_units():
    times = [0, 10, 20, 30]
    stable = lab.classify(points(), times)
    assert stable['class'] == 'stationary'
    moving = lab.classify(points(vx=.3, vy=.2), times)
    assert moving['class'] == 'possibly_moving'
    assert np.allclose(moving['velocity_east_north_arcsec_day'], [-.3, .2])
    assert np.allclose(moving['displacement_east_north_arcsec'], [-9, 6])


def test_small_displacement_and_low_evidence():
    result = lab.classify(points(vx=.0001, noise=1), [0, 10, 20, 30])
    assert result['class'] != 'possibly_moving'
    assert lab.classify(points(n=2), [0, 10])['class'] == 'insufficient'
    assert lab.classify(points(snr=3), [0, 10, 20, 30])['class'] == 'insufficient'
    assert lab.classify(points(), [0, 10, 20, 30], ambiguous=True)['class'] == 'ambiguous'


def test_times_and_velocity():
    first = lab.classify(points(vx=.12, dt=5), [0, 5, 10, 15])
    second = lab.classify(points(vx=.12, dt=10), [0, 10, 20, 30])
    assert np.allclose(first['velocity_east_north_arcsec_day'], second['velocity_east_north_arcsec_day'])
    assert np.isclose(second['displacement_east_north_arcsec'][0], 2*first['displacement_east_north_arcsec'][0])


def test_ambiguous_tracks_and_registration():
    p = lambda x: {'x': x, 'y': 20, 'sigma_total': .2, 'snr_peak': 20}
    tracks = lab.make_tracks([[p(10), p(12)], [p(11)]], 2)
    assert all(t['ambiguous'] for t in tracks)
    detections = [{'x': x+1, 'y': y-.5} for x, y in lab.ANCHORS]
    shift, refs, _ = lab.register(detections)
    assert len(refs) == 6 and np.allclose(shift, [1, -.5])
    assert lab.register([])[0] is None
    assert lab.make_tracks([[], [], []], 2) == []


def test_reproducible_dense_empty_and_confusion():
    assert lab.generate(seed=123, epochs=3, density='dense') == lab.generate(seed=123, epochs=3, density='dense')
    empty = lab.evaluate(seed=1, source_count=0, moving_fraction=0, epochs=3)
    assert sum(sum(row.values()) for row in empty['metrics']['classification']['confusion'].values()) == 0
    result = lab.evaluate(seed=701, source_count=20, epochs=3, density='dense', psf='variable')
    matrix = result['metrics']['classification']['confusion']
    assert sum(sum(row.values()) for row in matrix.values()) == 20
    assert result == lab.evaluate(seed=701, source_count=20, epochs=3, density='dense', psf='variable')
    stable = lab.evaluate(seed=702, source_count=10, moving_fraction=0)
    assert sum(stable['metrics']['classification']['confusion']['moving'].values()) == 0


def test_endpoint_validation():
    client = TestClient(app)
    for body in ({'epochs': 2}, {'source_count': 61}, {'interval': 0}, {'registration_shift': 3}):
        assert client.post('/api/experimental/classification', json=body).status_code == 422
    response = client.post('/api/experimental/classification', json={'seed': 700, 'epochs': 3})
    assert response.status_code == 200
    assert response.json()['label'] == 'CLASIFICACIÓN SINTÉTICA'
