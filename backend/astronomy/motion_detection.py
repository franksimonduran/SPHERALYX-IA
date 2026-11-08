"""Experimento sintético de dos épocas; no procesa observaciones SPHEREx."""
from __future__ import annotations

import io
import warnings

import numpy as np
from astropy.io import fits
from astropy.stats import sigma_clipped_stats
from astropy.wcs import WCS
from photutils.detection import DAOStarFinder
from scipy.spatial.distance import cdist

SIZE = 128
SCALE = 1.0  # arcsec/píxel, parámetro artificial, no instrumental
FWHM = 3.0
TRUTH = [
    (25., 25., 0., 0.), (55., 25., 0., 0.), (95., 30., 0., 0.),
    (30., 75., 0., 0.), (70., 95., 0., 0.), (105., 100., 0., 0.),
    (48., 55., 3., 2.), (90., 65., -4., 1.),
]


def generate_fits(seed=42, sources=TRUTH, noise=2.0):
    """Dos FITS en memoria y verdad (x,y en píxeles de origen cero)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[:SIZE, :SIZE]
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [SIZE / 2, SIZE / 2]
    wcs.wcs.cdelt = [-SCALE / 3600, SCALE / 3600]
    wcs.wcs.crval = [83., -5.]
    wcs.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    images, truth = [], []
    for epoch in range(2):
        image = rng.normal(100, noise, (SIZE, SIZE))
        positions = []
        for sx, sy, dx, dy in sources:
            px, py = sx + epoch * dx, sy + epoch * dy
            positions.append([px, py])
            image += 180 * np.exp(-((x-px)**2 + (y-py)**2) / (2*(FWHM/2.35482)**2))
        header = wcs.to_header()
        header['MJD-OBS'] = 60000. + epoch * 10.
        header['SYNTH'] = (True, 'Synthetic data, not SPHEREx')
        stream = io.BytesIO()
        fits.PrimaryHDU(image.astype('float32'), header=header).writeto(stream)
        images.append(stream.getvalue())
        truth.append(positions)
    return images, truth


def detect(raw, threshold=5.0):
    """Centroides DAO y error heurístico de centroide; sin consultar verdad."""
    with fits.open(io.BytesIO(raw)) as hdus:
        image = np.asarray(hdus[0].data, dtype=float)
        header = hdus[0].header.copy()
    _, median, std = sigma_clipped_stats(image, sigma=3)
    if not np.isfinite(std) or std <= 0:
        return [], header
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        found = DAOStarFinder(fwhm=FWHM, threshold=threshold * std)(image - median)
    if found is None:
        return [], header
    result = []
    for row in found:
        peak = float(row['peak'])
        snr = max(peak / std, 1.)
        result.append({'x': float(row['xcentroid']), 'y': float(row['ycentroid']),
                       'sigma_pixel': float(max(.03, FWHM / (2.355 * snr))), 'snr_peak': float(snr)})
    return result, header


def associate(a, b, tolerance):
    """Acepta solo aristas únicas por ambos extremos; rechaza ambigüedad."""
    if not a or not b:
        return [], 0
    distances = cdist([[p['x'], p['y']] for p in a], [[p['x'], p['y']] for p in b])
    edges = distances <= tolerance
    matches = [(i, j) for i, j in zip(*np.where(edges))
               if edges[i].sum() == 1 and edges[:, j].sum() == 1]
    ambiguous = sum(1 for i, j in zip(*np.where(edges))
                    if edges[i].sum() > 1 or edges[:, j].sum() > 1)
    return matches, ambiguous


def run_experiment(seed=42, tolerance=6.0, threshold=5.0):
    images, truth = generate_fits(seed)
    a, ha = detect(images[0], threshold)
    b, hb = detect(images[1], threshold)
    pairs, ambiguous = associate(a, b, tolerance)
    wcs = WCS(ha)
    days = float(hb['MJD-OBS'] - ha['MJD-OBS'])
    measurements = []
    for i, j in pairs:
        p, q = a[i], b[j]
        c1 = wcs.pixel_to_world(p['x'], p['y'])
        c2 = wcs.pixel_to_world(q['x'], q['y'])
        displacement = float(c1.separation(c2).arcsec)
        error = float(np.hypot(p['sigma_pixel'], q['sigma_pixel']) * SCALE)
        measurements.append({'a': p, 'b': q, 'displacement_arcsec': displacement,
                             'velocity_arcsec_day': displacement/days,
                             'uncertainty_arcsec': error,
                             'uncertainty_velocity_arcsec_day': error/days})
    # Evaluación independiente y conservadora: vecinos únicos a 1.5 píxeles.
    truth_points = [[{'x': x, 'y': y} for x, y in epoch] for epoch in truth]
    mappings = [dict(associate(d, t, 1.5)[0]) for d, t in [(a, truth_points[0]), (b, truth_points[1])]]
    correct = [(k, mappings[0][i]) for k, (i, j) in enumerate(pairs)
               if i in mappings[0] and j in mappings[1] and mappings[0][i] == mappings[1][j]]
    errors = []
    for k, t in correct:
        c1 = wcs.pixel_to_world(*truth[0][t]); c2 = wcs.pixel_to_world(*truth[1][t])
        errors.append(abs(measurements[k]['displacement_arcsec'] - float(c1.separation(c2).arcsec)))
    tp = len(correct); fp = len(pairs)-tp; fn = len(TRUTH)-tp
    return {'label': 'EXPERIMENTO SINTÉTICO', 'seed': seed, 'size': SIZE,
            'epoch_days': days, 'detections': [a, b], 'measurements': measurements,
            'ambiguous_edges': ambiguous,
            'metrics': {'true_positive': tp, 'false_positive': fp, 'false_negative': fn,
                        'precision': tp/len(pairs) if pairs else None,
                        'recall': tp/len(TRUTH) if TRUTH else None,
                        'mean_absolute_displacement_error_arcsec': float(np.mean(errors)) if errors else None},
            'warnings': ['Datos generados artificialmente; no son observaciones SPHEREx ni descubrimientos NASA.',
                         'Incertidumbres heurísticas no calibradas; dos épocas no prueban movimiento real.',
                         'Asociaciones con múltiples vecinos se rechazan; precisión y recuperación corresponden a asociaciones, no a clasificación de movimiento.']}
