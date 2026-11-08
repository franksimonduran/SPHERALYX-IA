import numpy as np
from astropy.io import fits
from fastapi.testclient import TestClient

from backend.astronomy import motion_detection as motion
from backend.main import app


def test_fits_reproducible_and_detection():
    images, truth = motion.generate_fits()
    assert images == motion.generate_fits()[0]
    import io
    with fits.open(io.BytesIO(images[0])) as h:
        assert h[0].header['SYNTH']
        assert h[0].data.shape == (128, 128)
    found, _ = motion.detect(images[0])
    assert len(found) == len(truth[0])


def test_empty_noise_and_ambiguity():
    images, _ = motion.generate_fits(sources=[])
    found, _ = motion.detect(images[0], threshold=8)
    assert found == []
    a = [{'x': 0, 'y': 0}, {'x': 2, 'y': 0}]
    b = [{'x': 1, 'y': 0}]
    pairs, ambiguous = motion.associate(a, b, 2)
    assert pairs == [] and ambiguous == 2
    assert motion.associate([], b, 2) == ([], 0)


def test_measurements_and_metrics():
    result = motion.run_experiment()
    assert result['metrics']['true_positive'] == 8
    assert result['metrics']['false_positive'] == 0
    assert result['metrics']['false_negative'] == 0
    assert result['metrics']['mean_absolute_displacement_error_arcsec'] < .1
    values = [m['displacement_arcsec'] for m in result['measurements']]
    assert np.isclose(max(values), np.sqrt(17), atol=.15)
    assert all(m['uncertainty_arcsec'] > 0 for m in result['measurements'])


def test_endpoint_validation_and_isolation():
    client = TestClient(app)
    response = client.post('/api/experimental/motion', json={})
    assert response.status_code == 200
    assert response.json()['label'] == 'EXPERIMENTO SINTÉTICO'
    assert client.post('/api/experimental/motion', json={'tolerance': 100}).status_code == 422
