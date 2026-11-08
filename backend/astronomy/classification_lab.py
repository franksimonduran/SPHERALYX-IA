"""Clasificación multiepoca exclusivamente sobre FITS sintéticos controlados."""
from __future__ import annotations

import base64
import io

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from PIL import Image
from scipy.spatial.distance import cdist

from . import motion_detection as motion
from .validation_lab import rates

# Catálogo de referencia artificial e independiente de las fuentes objetivo.
ANCHORS = np.array([[12., 12.], [64., 12.], [116., 12.],
                    [12., 116.], [64., 116.], [116., 116.]])
CLASSES = ('stationary', 'possibly_moving', 'ambiguous', 'insufficient')


def generate(seed=700, source_count=20, epochs=4, interval=10., noise=3.,
             density='sparse', psf='constant', displacement=3., moving_fraction=.4,
             registration_shift=1., artifacts=2):
    """FITS, verdad objetivo, referencias catalogadas y traslaciones inyectadas."""
    rng = np.random.default_rng(seed)
    low, high = (38., 90.) if density == 'dense' else (24., 104.)
    start = rng.uniform(low, high, (source_count, 2))
    angles = rng.uniform(0, 2*np.pi, source_count)
    moving = rng.random(source_count) < moving_fraction
    # Desplazamiento de referencia a 10 días; magnitudes diversas.
    magnitude = rng.uniform(.6, 1., source_count) * displacement * moving
    velocity = np.column_stack((np.cos(angles), np.sin(angles))) * magnitude[:, None] / 10.
    brightness = rng.uniform(20., 180., source_count)
    variation = rng.uniform(.8, 1.2, source_count)
    widths = rng.uniform(2.3, 3.8, source_count) if psf == 'variable' else np.full(source_count, 3.)
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [64, 64]; wcs.wcs.cdelt = [-1/3600, 1/3600]
    wcs.wcs.crval = [83., -5.]; wcs.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    y, x = np.mgrid[:128, :128]
    images, translations, truth_positions = [], [], []
    for epoch in range(epochs):
        dt = epoch * interval
        shift = np.zeros(2) if epoch == 0 else rng.uniform(-registration_shift, registration_shift, 2)
        translations.append(shift.tolist())
        current = start + velocity * dt
        truth_positions.append(current.tolist())
        image = rng.normal(100., noise, (128, 128))
        for (px, py), amp, width, var in zip(current, brightness, widths, variation):
            sigma = width * (1 + .08*epoch if psf == 'variable' else 1) / 2.35482
            image += amp * var**epoch * np.exp(-((x-px-shift[0])**2+(y-py-shift[1])**2)/(2*sigma**2))
        for px, py in ANCHORS:
            image += 220 * np.exp(-((x-px-shift[0])**2+(y-py-shift[1])**2)/(2*(3/2.35482)**2))
        for _ in range(artifacts):
            ax, ay = rng.integers(1, 127, 2); image[ay, ax] += rng.uniform(50, 200)
        header = wcs.to_header(); header['MJD-OBS'] = 60000. + dt; header['SYNTH'] = True
        stream = io.BytesIO(); fits.PrimaryHDU(image.astype('float32'), header=header).writeto(stream)
        images.append(stream.getvalue())
    return images, {'positions': truth_positions, 'velocity_px_day': velocity.tolist(),
                    'moving': moving.tolist(), 'brightness': brightness.tolist(),
                    'translations': translations}


def register(detections, max_shift=4.):
    """Traslación mediana de referencias conocidas; mínimo 3 pares exclusivos."""
    reference = [{'x': float(x), 'y': float(y)} for x, y in ANCHORS]
    pairs, _ = motion.associate(detections, reference, max_shift)
    if len(pairs) < 3:
        return None, [], None
    offsets = np.array([[detections[i]['x']-ANCHORS[j, 0], detections[i]['y']-ANCHORS[j, 1]] for i, j in pairs])
    shift = np.median(offsets, axis=0)
    scatter = np.linalg.norm(offsets-shift, axis=1)
    # Rechazo robusto de contaminación de referencias; fallo en vez de extrapolar.
    keep = scatter <= max(.3, float(np.median(scatter))*3)
    if keep.sum() < 3:
        return None, [], None
    shift = np.median(offsets[keep], axis=0)
    scatter = np.linalg.norm(offsets[keep]-shift, axis=1)
    uncertainty = max(.03, float(np.median(scatter)) / np.sqrt(int(keep.sum())))
    return shift, [pairs[k][0] for k in range(len(pairs)) if keep[k]], uncertainty


def make_tracks(epochs, tolerance):
    """Enlaza detecciones consecutivas, sin reutilización ni resolver ambigüedad."""
    tracks = [{'points': [(0, i)], 'ambiguous': False} for i in range(len(epochs[0]))]
    for epoch in range(1, len(epochs)):
        active = [t for t in tracks if t['points'][-1][0] == epoch-1 and not t['ambiguous']]
        a = [epochs[epoch-1][t['points'][-1][1]] for t in active]; b = epochs[epoch]
        if not a or not b:
            continue
        distances = cdist([[p['x'], p['y']] for p in a], [[p['x'], p['y']] for p in b])
        edges = distances <= tolerance
        for i, track in enumerate(active):
            neighbors = np.flatnonzero(edges[i])
            if len(neighbors) > 1 or (len(neighbors) == 1 and edges[:, neighbors[0]].sum() > 1):
                track['ambiguous'] = True
            elif len(neighbors) == 1:
                track['points'].append((epoch, int(neighbors[0])))
    return tracks


def classify(points, times, ambiguous=False, significance=4., min_snr=6., max_residual=3.):
    """Ajuste lineal ponderado; errores heurísticos, no significancia calibrada."""
    if ambiguous:
        return {'class': 'ambiguous'}
    if len(points) < 3 or min(p['snr_peak'] for p in points) < min_snr:
        return {'class': 'insufficient'}
    t = np.asarray(times, dtype=float); t -= t[0]
    xy = np.array([[p['x'], p['y']] for p in points])
    sigma = np.array([p['sigma_total'] for p in points])
    design = np.column_stack((np.ones(len(t)), t))
    covariance = np.linalg.inv(design.T @ (design / sigma[:, None]**2))
    fit = covariance @ (design.T @ (xy / sigma[:, None]**2))
    residual = xy - design @ fit
    reduced = float(np.sum((residual / sigma[:, None])**2) / (2*len(t)-4))
    sigma_v = float(np.sqrt(covariance[1, 1]))
    velocity = fit[1]
    sig = float(np.linalg.norm(velocity) / sigma_v)
    if reduced > max_residual:
        label = 'ambiguous'
    elif sig >= significance:
        label = 'possibly_moving'
    elif sig <= 2.:
        label = 'stationary'
    else:
        label = 'insufficient'
    # Eje x WCS apunta al oeste: aproximación tangente este/norte en arcsec.
    vector = [-float(velocity[0]), float(velocity[1])]
    return {'class': label, 'velocity_east_north_arcsec_day': vector,
            'velocity_sigma_per_axis_arcsec_day': sigma_v,
            'displacement_east_north_arcsec': [v*float(t[-1]) for v in vector],
            'displacement_sigma_per_axis_arcsec': sigma_v*float(t[-1]),
            'significance_heuristic': sig, 'reduced_residual_heuristic': reduced}


def preview(raw):
    with fits.open(io.BytesIO(raw)) as hdus:
        data = np.asarray(hdus[0].data, dtype=float)
    lo, hi = np.percentile(data, [5, 99.8]); image = np.clip((data-lo)/max(hi-lo, 1e-9), 0, 1)
    stream = io.BytesIO(); Image.fromarray((image*255).astype('uint8')).save(stream, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode('ascii')


def evaluate(seed=700, source_count=20, epochs=4, interval=10., noise=3.,
             density='sparse', psf='constant', displacement=3., moving_fraction=.4,
             registration_shift=1., artifacts=2, tolerance=5., significance=4.,
             min_snr=6., max_residual=3.):
    config = dict(seed=seed, source_count=source_count, epochs=epochs, interval=interval, noise=noise,
                  density=density, psf=psf, displacement=displacement, moving_fraction=moving_fraction,
                  registration_shift=registration_shift, artifacts=artifacts)
    raw, truth = generate(**config)
    detections, registration, reference_indices = [], [], []
    for image in raw:
        detected, _ = motion.detect(image)
        shift, refs, uncertainty = register(detected)
        registration.append({'shift_px': shift.tolist() if shift is not None else None,
                             'uncertainty_px': uncertainty, 'reference_count': len(refs)})
        reference_indices.append(refs)
        detections.append(detected)
    aligned = []
    for detected, reg, refs in zip(detections, registration, reference_indices):
        if reg['shift_px'] is None:
            aligned.append([]); continue
        shift = reg['shift_px']
        aligned.append([{'x': p['x']-shift[0], 'y': p['y']-shift[1],
                         'sigma_total': float(np.hypot(max(.15, p['sigma_pixel']), reg['uncertainty_px'])),
                         'snr_peak': p['snr_peak']} for i, p in enumerate(detected) if i not in refs])
    tracks = make_tracks(aligned, tolerance)
    times = np.arange(epochs)*interval
    truth_maps = []
    for epoch in range(epochs):
        expected = [{'x': p[0], 'y': p[1]} for p in truth['positions'][epoch]]
        truth_maps.append(dict(motion.associate(aligned[epoch], expected, 1.5)[0]))
    result_tracks, by_truth, correct_links, spurious = [], {}, 0, 0
    for track in tracks:
        points = [aligned[e][i] for e, i in track['points']]
        label = classify(points, [times[e] for e, i in track['points']], track['ambiguous'], significance, min_snr, max_residual)
        indices = [truth_maps[e].get(i) for e, i in track['points']]
        correct_links += sum(bool(indices[k] is not None and indices[k] == indices[k+1]) for k in range(len(indices)-1))
        t = indices[0]
        consistent = t is not None and all(index == t for index in indices)
        if t is not None:
            # Una identidad incorrecta no puede acreditarse como detección correcta.
            by_truth[t] = label['class'] if consistent else 'ambiguous'
        if not consistent and label['class'] == 'possibly_moving':
            spurious += 1
        result_tracks.append({'id': len(result_tracks)+1, 'points': [{'epoch': e, **aligned[e][i]} for e, i in track['points']], **label})
    # La matriz incluye todas las fuentes inyectadas, incluso no detectadas.
    matrix = {actual: {predicted: 0 for predicted in CLASSES} for actual in ('stationary', 'moving')}
    for i, moving in enumerate(truth['moving']):
        matrix['moving' if moving else 'stationary'][by_truth.get(i, 'insufficient')] += 1
    tp = matrix['moving']['possibly_moving']; fp = matrix['stationary']['possibly_moving'] + spurious
    fn = sum(matrix['moving'].values()) - tp
    links = sum(len(t['points'])-1 for t in tracks)
    truth_links = source_count*(epochs-1)
    brightness_groups = {}
    for group, predicate in [('faint', lambda value: value < 80), ('bright', lambda value: value >= 80)]:
        selected = [i for i, value in enumerate(truth['brightness']) if predicate(value)]
        moving_count = sum(truth['moving'][i] for i in selected)
        stationary_count = len(selected) - moving_count
        group_tp = sum(truth['moving'][i] and by_truth.get(i) == 'possibly_moving' for i in selected)
        group_fp = sum(not truth['moving'][i] and by_truth.get(i) == 'possibly_moving' for i in selected)
        brightness_groups[group] = {'sources': len(selected), 'moving': moving_count,
            'stationary': stationary_count, 'tp': group_tp, 'fp': group_fp,
            'fn': moving_count-group_tp, **rates(group_tp, group_fp, moving_count-group_tp)}
    vector_errors, velocity_errors = [], []
    for track, result in zip(tracks, result_tracks):
        ids = [truth_maps[e].get(i) for e, i in track['points']]
        if len(ids) != epochs or ids[0] is None or any(i != ids[0] for i in ids) or 'velocity_east_north_arcsec_day' not in result:
            continue
        v = truth['velocity_px_day'][ids[0]]; true_v = np.array([-v[0], v[1]])
        error = float(np.linalg.norm(np.array(result['velocity_east_north_arcsec_day'])-true_v))
        velocity_errors.append(error); vector_errors.append(error * times[-1])
    return {'label': 'CLASIFICACIÓN SINTÉTICA', 'config': {**config, 'tolerance': tolerance,
                'significance': significance, 'min_snr': min_snr, 'max_residual': max_residual},
            'images': [preview(image) for image in raw], 'tracks': result_tracks,
            'registration': registration, 'injected_registration_px': truth['translations'],
            'metrics': {'association': {'tp': correct_links, 'fp': links-correct_links,
                         'fn': truth_links-correct_links, **rates(correct_links, links-correct_links, truth_links-correct_links)},
                        'classification': {'tp': tp, 'fp': fp, 'fn': fn, **rates(tp, fp, fn),
                         'confusion': matrix, 'spurious_moving': spurious,
                         'by_brightness': brightness_groups,
                         'false_motion_rate': matrix['stationary']['possibly_moving']/sum(matrix['stationary'].values()) if sum(matrix['stationary'].values()) else None,
                         'ambiguity_rate': sum(m['ambiguous'] for m in matrix.values())/source_count if source_count else None},
                        'mean_vector_error_arcsec': float(np.mean(vector_errors)) if vector_errors else None,
                        'mean_velocity_error_arcsec_day': float(np.mean(velocity_errors)) if velocity_errors else None,
                        'error_sample_count': len(vector_errors)},
            'warnings': ['EXPERIMENTO SINTÉTICO: no son datos SPHEREx ni descubrimientos NASA.',
                         'Registro por referencias sintéticas conocidas; incertidumbres y umbrales heurísticos no calibrados.',
                         'Clasificación estacionaria significa compatible con reposo, no prueba ausencia de movimiento.']}
