import io

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient

from backend.astronomy import validation_lab as lab
from backend.main import app, _validation_lock


def test_synthetic_generation_and_seed():
    images, truth = lab.generate_scenario(12, 20, 8, 'dense', 8, 'variable', 3)
    assert (images, truth) == lab.generate_scenario(12, 20, 8, 'dense', 8, 'variable', 3)
    assert images != lab.generate_scenario(13, 20, 8, 'dense', 8, 'variable', 3)[0]
    with fits.open(io.BytesIO(images[0])) as hdus:
        assert hdus[0].header['SYNTH'] and hdus[0].data.shape == (128, 128)
    shifts = np.linalg.norm(np.array(truth[1])-truth[0], axis=1)
    assert np.any(np.isclose(shifts, 0)) and np.any(np.isclose(shifts, 8))


def test_metrics_and_empty_cases():
    assert lab.rates(2, 1, 2) == {'precision': 2/3, 'recall': .5, 'f1': 4/7}
    assert lab.rates(0, 0, 0) == {'precision': None, 'recall': None, 'f1': None}
    score = lab.score([], [], [[[10, 10]], [[10, 10]]], [], WCS(naxis=2))
    assert (score['tp'], score['fp'], score['fn']) == (0, 0, 1)
    result = lab.evaluate(seed=1, scenarios=2, source_count=0, noise=1, artifacts=0, threshold=12)
    assert result['methods']['conservative']['recall'] is None
    assert result['ambiguity']['rate'] is None


def test_ambiguous_baseline_comparison():
    a = [{'x': 0, 'y': 0}, {'x': 2, 'y': 0}]
    b = [{'x': 1, 'y': 0}]
    from backend.astronomy.motion_detection import associate
    assert associate(a, b, 2) == ([], 2)
    assert lab.baseline_associate(a, b, 2) == [(0, 0)]


def test_wrong_association_counts_false_positive_and_negative():
    truth = [[[10, 10], [30, 30]], [[10, 10], [30, 30]]]
    detections = [{'x': 10, 'y': 10}, {'x': 30, 'y': 30}]
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    score = lab.score(detections, detections, truth, [(0, 1)], wcs)
    assert (score['tp'], score['fp'], score['fn']) == (0, 1, 2)


def test_batch_reproducibility_and_bounds():
    args = dict(seed=100, scenarios=3, source_count=10, noise=8, density='dense', psf='variable')
    first, second = lab.evaluate(**args), lab.evaluate(**args)
    assert first['methods'] == second['methods']
    assert [s['seed'] for s in first['scenarios']] == [100, 101, 102]
    assert first['ambiguity'] == second['ambiguity']
    with pytest.raises(ValueError):
        lab.evaluate(scenarios=21)
    with pytest.raises(ValueError):
        lab.evaluate(source_count=101)


def test_api_validation_and_concurrency_limit():
    client = TestClient(app)
    for payload in ({'scenarios': 21}, {'source_count': 101}, {'noise': -1},
                    {'density': 'invalid'}, {'displacement': 13}, {'psf': 'other'}):
        assert client.post('/api/experimental/validation', json=payload).status_code == 422
    assert _validation_lock.acquire(blocking=False)
    try:
        assert client.post('/api/experimental/validation', json={}).status_code == 503
    finally:
        _validation_lock.release()
    response = client.post('/api/experimental/validation', json={'scenarios': 2, 'source_count': 8})
    assert response.status_code == 200
    assert response.json()['label'] == 'EVALUACIÓN SINTÉTICA'
