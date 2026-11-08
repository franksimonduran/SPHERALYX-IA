"""Validación acotada de asociaciones en campos artificiales de dos épocas."""
from __future__ import annotations

import io
import time

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from scipy.spatial.distance import cdist

from . import motion_detection as motion

MAX_SCENARIOS = 20
MAX_SOURCES = 100


def generate_scenario(seed, source_count=30, noise=5., density='sparse',
                      displacement=4., psf='constant', artifacts=2):
    """Devuelve FITS y posiciones inyectadas, reproducibles por semilla.

    Las fuentes débiles, variables y móviles son muestras aleatorias del campo.
    Los artefactos (píxeles calientes) solo aparecen en una época.
    """
    rng = np.random.default_rng(seed)
    size = motion.SIZE
    # El campo denso concentra las mismas fuentes en una región más pequeña.
    low, high = (38., 90.) if density == 'dense' else (15., 113.)
    positions = rng.uniform(low, high, (source_count, 2))
    angles = rng.uniform(0, 2 * np.pi, source_count)
    moving = rng.random(source_count) < .4
    offsets = np.column_stack((np.cos(angles), np.sin(angles))) * displacement * moving[:, None]
    # El margen anterior y desplazamiento máximo garantizan posiciones dentro del campo.
    brightness = rng.uniform(12., 180., source_count)
    variability = np.where(rng.random(source_count) < .3, rng.uniform(.5, 1.5, source_count), 1.)
    widths = rng.uniform(2., 4., source_count) if psf == 'variable' else np.full(source_count, 3.)
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [size / 2, size / 2]
    wcs.wcs.cdelt = [-motion.SCALE / 3600, motion.SCALE / 3600]
    wcs.wcs.crval = [83., -5.]
    wcs.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    y, x = np.mgrid[:size, :size]
    images, truth = [], []
    for epoch in range(2):
        image = rng.normal(100., noise, (size, size))
        current = positions + epoch * offsets
        for index, (px, py) in enumerate(current):
            # En el modo variable cambia la PSF tanto espacial como temporalmente.
            sigma = widths[index] * (1.15 if epoch and psf == 'variable' else 1.) / 2.35482
            amplitude = brightness[index] * (variability[index] if epoch else 1.)
            image += amplitude * np.exp(-((x-px)**2 + (y-py)**2) / (2 * sigma**2))
        for _ in range(artifacts):
            ax, ay = rng.integers(1, size-1, size=2)
            image[ay, ax] += rng.uniform(50., 200.)
        header = wcs.to_header()
        header['MJD-OBS'] = 60000. + epoch * 10.
        header['SYNTH'] = (True, 'Synthetic data, not SPHEREx')
        stream = io.BytesIO()
        fits.PrimaryHDU(image.astype('float32'), header=header).writeto(stream)
        images.append(stream.getvalue())
        truth.append(current.tolist())
    return images, truth


def baseline_associate(a, b, tolerance):
    """Vecino más cercano voraz uno a uno, sin rechazo de ambigüedad."""
    if not a or not b:
        return []
    distances = cdist([[p['x'], p['y']] for p in a], [[p['x'], p['y']] for p in b])
    candidates = sorted((float(distances[i, j]), int(i), int(j))
                        for i, j in zip(*np.where(distances <= tolerance)))
    used_a, used_b, pairs = set(), set(), []
    for _, i, j in candidates:
        if i not in used_a and j not in used_b:
            pairs.append((i, j)); used_a.add(i); used_b.add(j)
    return pairs


def score(a, b, truth, pairs, wcs):
    """VP/FP/FN de asociaciones, correspondencia de verdad única a 1.5 px."""
    points = [[{'x': x, 'y': y} for x, y in epoch] for epoch in truth]
    maps = [dict(motion.associate(detections, actual, 1.5)[0])
            for detections, actual in ((a, points[0]), (b, points[1]))]
    errors = []
    for i, j in pairs:
        if i not in maps[0] or j not in maps[1] or maps[0][i] != maps[1][j]:
            continue
        index = maps[0][i]
        detected_a = wcs.pixel_to_world(a[i]['x'], a[i]['y'])
        detected_b = wcs.pixel_to_world(b[j]['x'], b[j]['y'])
        true_a = wcs.pixel_to_world(*truth[0][index])
        true_b = wcs.pixel_to_world(*truth[1][index])
        errors.append(abs(float(detected_a.separation(detected_b).arcsec - true_a.separation(true_b).arcsec)))
    tp = len(errors)
    return {'tp': tp, 'fp': len(pairs)-tp, 'fn': len(truth[0])-tp, 'errors_arcsec': errors}


def rates(tp, fp, fn):
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None
    return {'precision': precision, 'recall': recall, 'f1': f1}


def aggregate(rows, rng):
    tp, fp, fn = (sum(row[key] for row in rows) for key in ('tp', 'fp', 'fn'))
    errors = [value for row in rows for value in row['errors_arcsec']]
    # Bootstrap de escenarios completos; no trata las fuentes correlacionadas como independientes.
    samples = {'precision': [], 'recall': [], 'f1': []}
    if len(rows) >= 2:
        for _ in range(500):
            selected = [rows[i] for i in rng.integers(0, len(rows), len(rows))]
            metrics = rates(*(sum(row[key] for row in selected) for key in ('tp', 'fp', 'fn')))
            for name, value in metrics.items():
                if value is not None:
                    samples[name].append(value)
    intervals = {key: [float(v) for v in np.percentile(values, [2.5, 97.5])]
                 if len(values) >= 400 else None for key, values in samples.items()}
    return {'tp': tp, 'fp': fp, 'fn': fn, **rates(tp, fp, fn),
            'mean_error_arcsec': float(np.mean(errors)) if errors else None,
            'error_distribution_arcsec': {'count': len(errors), 'values': errors,
                'p50': float(np.percentile(errors, 50)) if errors else None,
                'p90': float(np.percentile(errors, 90)) if errors else None},
            'bootstrap_95': intervals}


def evaluate(seed=42, scenarios=5, source_count=30, noise=5., density='sparse',
             displacement=4., psf='constant', artifacts=2, tolerance=6., threshold=5.):
    if not 1 <= scenarios <= MAX_SCENARIOS or not 0 <= source_count <= MAX_SOURCES:
        raise ValueError('Límite de escenarios o fuentes excedido')
    started = time.perf_counter()
    results = []
    for index in range(scenarios):
        scenario_seed = seed + index
        start = time.perf_counter()
        images, truth = generate_scenario(scenario_seed, source_count, noise, density, displacement, psf, artifacts)
        a, header = motion.detect(images[0], threshold)
        b, _ = motion.detect(images[1], threshold)
        pairs, ambiguous = motion.associate(a, b, tolerance)
        baseline = baseline_associate(a, b, tolerance)
        # Denominador explícito: todas las aristas candidatas dentro de tolerancia.
        if a and b:
            candidates = int(np.count_nonzero(cdist([[p['x'], p['y']] for p in a],
                                                     [[p['x'], p['y']] for p in b]) <= tolerance))
        else:
            candidates = 0
        wcs = WCS(header)
        results.append({'seed': scenario_seed, 'detections': [len(a), len(b)],
                        'ambiguous_edges': ambiguous, 'candidate_edges': candidates,
                        'conservative': score(a, b, truth, pairs, wcs),
                        'baseline': score(a, b, truth, baseline, wcs),
                        'elapsed_seconds': time.perf_counter() - start})
    ambiguous = sum(r['ambiguous_edges'] for r in results)
    candidates = sum(r['candidate_edges'] for r in results)
    return {'label': 'EVALUACIÓN SINTÉTICA',
            'config': {'seed': seed, 'scenarios': scenarios, 'source_count': source_count,
                       'noise': noise, 'density': density, 'displacement': displacement,
                       'psf': psf, 'artifacts': artifacts, 'tolerance': tolerance, 'threshold': threshold},
            'scenarios': results,
            'methods': {name: aggregate([r[name] for r in results], np.random.default_rng(seed + 1000001))
                        for name in ('conservative', 'baseline')},
            'ambiguity': {'ambiguous_edges': ambiguous, 'candidate_edges': candidates,
                          'rate': ambiguous/candidates if candidates else None},
            'elapsed_seconds': time.perf_counter()-started,
            'warnings': ['Solo campos sintéticos: no son observaciones SPHEREx ni descubrimientos NASA.',
                         'Métricas de asociación, no de clasificación de movimiento; verdad emparejada de forma conservadora.',
                         'Intervalos bootstrap entre escenarios generados; no generalizan al cielo real.']}
