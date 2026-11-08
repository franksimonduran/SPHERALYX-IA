"""Comparación exploratoria de recortes SPHEREx; no estima significancia ni movimiento."""
from __future__ import annotations

import base64
import io
import logging
import re
import threading
import time
import uuid
from collections import OrderedDict
from contextlib import contextmanager

import numpy as np
from astropy import units as u
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
from PIL import Image
from reproject import reproject_interp

from .fits_processor import download_cutout, MAX_PIXELS
from . import calibration

# Bits excluidos por el Spectrophotometry Tool de IRSA; SOURCE (21) se conserva.
BAD_BITS = sum(1 << bit for bit in (2, 6, 9, 10, 11, 15, 17, 26, 27, 28, 29))
SPECTRAL_FRACTION = 0.1  # umbral conservador exploratorio, no validación instrumental
MIN_COVERAGE = 0.2
_semaphore = threading.BoundedSemaphore(2)
_results: OrderedDict[str, tuple[float, dict]] = OrderedDict()
_lock = threading.Lock()
log = logging.getLogger(__name__)
COMPARISON_BUDGET_SECONDS = 90.0


class TemporalTimeout(RuntimeError):
    """Presupuesto cooperativo agotado entre etapas de comparación."""


def _check_deadline(deadline):
    if deadline is not None and time.monotonic() >= deadline:
        raise TemporalTimeout('Tiempo de comparación agotado; inténtalo de nuevo.')


@contextmanager
def _stage(name):
    start = time.monotonic()
    try:
        yield
    finally:
        log.info('Comparación temporal etapa=%s duración=%.3fs', name, time.monotonic()-start)


def metadata(item):
    result = dict(item)
    mjd = item.get('time_start_mjd')
    result['observation_time_utc'] = Time(mjd, format='mjd', scale='utc').isot if mjd is not None else None
    result['wcs'] = 'Disponible únicamente tras cargar el FITS; SIA no contiene la WCS completa.'
    return result


def read_science(raw, release=None):
    try:
        started = time.monotonic()
        with fits.open(io.BytesIO(raw), memmap=False, lazy_load_hdus=False) as hdus:
            log.info('Comparación temporal etapa=apertura_fits duración=%.3fs', time.monotonic()-started)
            if any(name not in hdus or hdus[name].data is None for name in ('IMAGE', 'FLAGS', 'VARIANCE')):
                raise ValueError('Faltan IMAGE, FLAGS o VARIANCE')
            hdu = hdus['IMAGE']; header = hdu.header
            image = np.asarray(hdu.data, dtype=float)
            if image.ndim != 2 or not image.size or image.size > MAX_PIXELS:
                raise ValueError('Dimensiones FITS no admitidas')
            flags = np.asarray(hdus['FLAGS'].data)
            variance = np.asarray(hdus['VARIANCE'].data, dtype=float)
            if flags.shape != image.shape or variance.shape != image.shape or flags.dtype.kind not in 'iu':
                raise ValueError('FLAGS o VARIANCE incompatibles con IMAGE')
            sky = WCS(header, hdus).celestial
            if not sky.has_celestial:
                raise ValueError('Falta WCS celeste')
            unit = u.Unit(header.get('BUNIT', ''))
            if not unit.is_equivalent(u.MJy / u.sr):
                raise ValueError('Unidad no compatible con brillo superficial MJy/sr')
            variance_unit = u.Unit(hdus['VARIANCE'].header.get('BUNIT', ''))
            if not variance_unit.is_equivalent((u.MJy / u.sr) ** 2):
                raise ValueError('Unidad de VARIANCE ausente o incompatible')
            image *= unit.to(u.MJy / u.sr)
            variance *= variance_unit.to((u.MJy / u.sr) ** 2)
            valid = np.isfinite(image) & np.isfinite(variance) & (variance >= 0) & ((flags.astype(np.uint64) & BAD_BITS) == 0)
            # La WCS espectral alternativa W es una tabla en coordenadas de detector.
            # El SIP celeste no debe aplicarse a esta WCS independiente.
            spectral_header = header.copy()
            for key in list(spectral_header.keys()):
                if re.match(r'^(A|B|AP|BP)_(ORDER|\d+_\d+)$', key):
                    del spectral_header[key]
            try:
                wave = WCS(spectral_header, hdus, key='W')
                if list(wave.world_axis_units) != ['um', 'um']:
                    raise ValueError('Unidades espectrales inesperadas')
                yy, xx = np.indices(image.shape)
                wavelength, bandwidth = wave.all_pix2world(xx, yy, 0)
                wavelength = np.asarray(wavelength, dtype=float)
                bandwidth = np.asarray(bandwidth, dtype=float)
            except Exception:
                wavelength = bandwidth = None
            with _stage('calibracion'):
                calibrated_wave, calibrated_band, calibration_info = calibration.calibrated_maps(header, image.shape, release)
            if calibration_info['verified']:
                wavelength, bandwidth = calibrated_wave, calibrated_band
            return {'image': image, 'variance': variance, 'valid': valid, 'wcs': sky,
                    'wavelength': wavelength, 'bandwidth': bandwidth,
                    'calibration': calibration_info,
                    'unit': 'MJy / sr', 'date_obs': header.get('DATE-OBS'),
                    'detector': header.get('DETECTOR'), 'quality': header.get('L2DQAFLG'),
                    'wcs_ctype': list(sky.wcs.ctype), 'wcs_frame': header.get('RADESYS'),
                    'shape': list(image.shape)}
    except (OSError, KeyError, TypeError) as exc:
        raise ValueError('FITS inválido o incompleto') from exc


def _reproject(data, source_wcs, dest_wcs, shape):
    return reproject_interp((data, source_wcs), dest_wcs, shape_out=shape, order='bilinear', return_footprint=True)


def _png(image, low, high):
    valid = np.isfinite(image)
    rgba = np.zeros((*image.shape, 4), dtype=np.uint8)
    scale = max(high - low, 1e-12)
    values = (255 * np.clip((image[valid] - low) / scale, 0, 1)).astype(np.uint8)
    rgba[valid, :3] = values[:, None]; rgba[valid, 3] = 255
    out = io.BytesIO(); Image.fromarray(np.flipud(rgba)).save(out, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(out.getvalue()).decode('ascii')


def compare_arrays(a, b, item_a, item_b, deadline=None):
    def reproject(data):
        _check_deadline(deadline)
        with _stage('reproyeccion'):
            result = _reproject(data, b['wcs'], a['wcs'], shape)
        _check_deadline(deadline)
        return result
    reasons = []
    if item_a['id'] == item_b['id'] or (item_a.get('time_start_mjd') is None or item_b.get('time_start_mjd') is None or item_a.get('time_start_mjd') == item_b.get('time_start_mjd')):
        reasons.append('Se requieren dos exposiciones con épocas distintas conocidas.')
    if not item_a.get('band') or item_a.get('band') != item_b.get('band'):
        reasons.append('Detectores o bandas diferentes o desconocidos.')
    if not a['detector'] or a['detector'] != b['detector']:
        reasons.append('Detectores FITS diferentes o desconocidos.')
    if item_a.get('release') != item_b.get('release'):
        reasons.append('Las colecciones de procesamiento difieren.')
    if item_a.get('calibration_level') != 2 or item_b.get('calibration_level') != 2:
        reasons.append('Nivel de calibración 2 no confirmado en ambas imágenes.')
    if a['quality'] != 'Pass' or b['quality'] != 'Pass':
        reasons.append('Control de calidad L2 no aprobado o desconocido.')
    if a['unit'] != b['unit']:
        reasons.append('Unidades no compatibles.')
    if not a.get('calibration', {}).get('verified') or not b.get('calibration', {}).get('verified'):
        reasons.append('Calibración CWAVE/CBAND no verificada para ambas observaciones; WCS-WAVE es solo para visualización.')
    shape = a['image'].shape
    # Interpolar máscara por separado evita mezclar píxeles inválidos con válidos.
    weight, footprint = reproject(b['valid'].astype(float))
    value, _ = reproject(np.where(b['valid'], b['image'], 0.0))
    variance, _ = reproject(np.where(b['valid'], b['variance'], 0.0))
    common = a['valid'] & np.isfinite(value) & (footprint > 0) & (weight > .999)
    spatial_common = common.copy()
    coverage = float(common.sum() / common.size)
    if coverage < MIN_COVERAGE or common.sum() < 16:
        reasons.append('Cobertura común válida insuficiente (mínimo 20 % y 16 píxeles).')
    spectral_match = None
    if a['wavelength'] is None or b['wavelength'] is None or a['bandwidth'] is None or b['bandwidth'] is None:
        reasons.append('Falta WCS espectral por píxel; la banda del detector no basta.')
    elif common.any():
        wl_b, _ = reproject(b['wavelength'])
        bw_b, _ = reproject(b['bandwidth'])
        good = common & np.isfinite(a['wavelength']) & np.isfinite(a['bandwidth']) & np.isfinite(wl_b) & np.isfinite(bw_b) & (a['bandwidth'] > 0) & (bw_b > 0)
        good &= np.abs(a['wavelength'] - wl_b) <= SPECTRAL_FRACTION * np.minimum(a['bandwidth'], bw_b)
        spectral_match = float(good.sum() / common.sum())
        if spectral_match < .9:
            if a.get('calibration', {}).get('verified') and b.get('calibration', {}).get('verified'):
                reasons.append('Longitud de onda calibrada incompatible o desconocida en más del 10 % de cobertura común.')
            else:
                reasons.append('WCS-WAVE aproximada sugiere discrepancia o faltan valores en más del 10 %; no es una validación científica.')
        common &= good
        if common.sum() / common.size < MIN_COVERAGE or common.sum() < 16:
            reasons.append('Cobertura válida espectralmente compatible insuficiente.')
    aa = np.where(spatial_common, a['image'], np.nan); bb = np.where(spatial_common, value, np.nan)
    views = {}
    _check_deadline(deadline)
    views_started = time.monotonic()
    if spatial_common.any():
        lo, hi = np.percentile(np.concatenate((aa[spatial_common], bb[spatial_common])), [1, 99])
        views['a'] = _png(aa, lo, hi); views['b'] = _png(bb, lo, hi)
        views['coverage'] = _png(spatial_common.astype(float), 0, 1)
        if not reasons:
            difference = np.where(common, bb - aa, np.nan)
            limit = max(float(np.percentile(np.abs(difference[common]), 99)), 1e-12)
            views['difference'] = _png(difference, -limit, limit)
    log.info('Comparación temporal etapa=vistas duración=%.3fs', time.monotonic()-views_started)
    _check_deadline(deadline)
    # La varianza reinterpolada no aplica pesos al cuadrado ni correlaciones.
    variance_valid = common & np.isfinite(variance) & (variance >= 0)
    approx_variance_pixels = int(np.count_nonzero(variance_valid))
    approx_difference_variance = a['variance'][variance_valid] + variance[variance_valid]
    return {'compatible': not reasons, 'reasons': reasons, 'coverage_fraction': coverage,
            'spectral_match_fraction': spectral_match, 'views': views,
            'spectral_status': 'calibrada' if a.get('calibration', {}).get('verified') and b.get('calibration', {}).get('verified') else 'aproximada_no_verificada',
            'variance_approximate_pixels': approx_variance_pixels,
            'difference_variance_approximate_median': float(np.median(approx_difference_variance)) if approx_variance_pixels else None,
            'variance_unit': '(MJy / sr)²',
            'warning': 'Comparación exploratoria: sin ajuste de PSF, fondo ni calibración relativa. Varianza interpolada aproximada, sin significancia estadística; no demuestra movimiento.'}


def compare(item_a, item_b):
    if not _semaphore.acquire(blocking=False):
        raise RuntimeError('Hay demasiadas comparaciones en curso; inténtalo de nuevo.')
    try:
        deadline = time.monotonic() + COMPARISON_BUDGET_SECONDS
        loaded = []
        for label, item in (('a', item_a), ('b', item_b)):
            _check_deadline(deadline)
            with _stage('recuperacion_descarga_'+label):
                raw = download_cutout(item, deadline=deadline)
            _check_deadline(deadline)
            with _stage('lectura_fits_'+label):
                loaded.append(read_science(raw, item['release']))
            _check_deadline(deadline)
        a, b = loaded
        result = compare_arrays(a, b, item_a, item_b, deadline=deadline)
        result.update({'id': uuid.uuid4().hex, 'mode': 'real', 'a': metadata(item_a), 'b': metadata(item_b),
                       'fits_a': {k: a[k] for k in ('shape', 'unit', 'date_obs', 'detector', 'quality', 'wcs_ctype', 'wcs_frame', 'calibration')},
                       'fits_b': {k: b[k] for k in ('shape', 'unit', 'date_obs', 'detector', 'quality', 'wcs_ctype', 'wcs_frame', 'calibration')}})
        with _lock:
            _results[result['id']] = (time.monotonic() + 1800, result)
            while len(_results) > 10: _results.popitem(last=False)
        return result
    finally:
        _semaphore.release()


def get_result(identifier):
    if not re.fullmatch(r'[a-f0-9]{32}', identifier): return None
    with _lock:
        entry = _results.get(identifier)
        if not entry or entry[0] < time.monotonic():
            _results.pop(identifier, None); return None
        return entry[1]
