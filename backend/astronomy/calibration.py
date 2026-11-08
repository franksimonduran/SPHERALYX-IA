"""Selección explícita de calibraciones locales verificadas por manifiesto administrativo.

El manifiesto no es una entrada de usuario HTTP. La asociación UUID/producto debe
documentarla y verificarla externamente el administrador con fuentes IRSA.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import re
from pathlib import Path

import numpy as np
from astropy.io import fits
from urllib.parse import urlsplit

UUID = re.compile(r'^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
MAX_FILE = 40 * 1024 * 1024


def spectral_uuid(header):
    history = header.get('HISTORY', [])
    if isinstance(history, str): history = [history]
    matches = []
    for line in history:
        match = re.search(r'\[CALIB\]\s+spectral_wcs\s+([0-9a-fA-F-]{36})', str(line))
        if match and UUID.fullmatch(match.group(1).lower()): matches.append(match.group(1).lower())
    return matches[-1] if matches else None


def select_record(records, uuid, detector, release):
    if not uuid or not UUID.fullmatch(uuid): return None
    matching = [r for r in records if r.get('uuid') == uuid and r.get('detector') == detector and r.get('release') == release]
    return matching[0] if len(matching) == 1 else None


def calibrated_maps(header, shape, release):
    """CWAVE/CBAND en píxeles activos; falla cerrado ante asociación dudosa."""
    uuid = spectral_uuid(header)
    info = {'source': 'WCS-WAVE', 'verified': False, 'uuid': uuid, 'reason': 'Calibración CWAVE/CBAND no verificada'}
    manifest = os.environ.get('SPHERALYX_CALIBRATION_MANIFEST')
    if not manifest: return None, None, info
    try:
        manifest_path = Path(manifest).resolve(strict=True)
        records = json.loads(manifest_path.read_text(encoding='utf-8'))
        detector = int(header['DETECTOR'])
        record = select_record(records, uuid, detector, release)
        if not record: raise ValueError('No existe una asociación única UUID/detector/colección')
        if not re.fullmatch(r'[a-f0-9]{64}', record.get('sha256', '')): raise ValueError('SHA-256 ausente')
        version = str(record.get('version', ''))
        source = urlsplit(str(record.get('source_url', '')))
        pattern = rf'^/ibe/data/spherex/{release}/spectral_wcs/cal-wcs-v{re.escape(version)}-(\d{{4}}-\d{{3}})/{detector}/spectral_wcs_D{detector}_spx_cal-wcs-v{re.escape(version)}-\1\.fits$'
        if not re.fullmatch(r'\d+', version) or source.scheme != 'https' or source.netloc != 'irsa.ipac.caltech.edu' or source.query or source.fragment or not re.fullmatch(pattern, source.path):
            raise ValueError('Versión, colección, detector o procedencia IRSA incompatibles')
        path = (manifest_path.parent / record['file']).resolve(strict=True)
        if not path.is_relative_to(manifest_path.parent): raise ValueError('Archivo fuera del directorio del manifiesto')
        if path.name != Path(source.path).name: raise ValueError('El nombre del archivo no coincide con la procedencia')
        if path.stat().st_size > MAX_FILE: raise ValueError('Calibración demasiado grande')
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != record['sha256']: raise ValueError('SHA-256 incorrecto')
        with fits.open(io.BytesIO(raw), memmap=False) as hdus:
            cw, cb = hdus['CWAVE'], hdus['CBAND']
            if cw.data is None or cb.data is None or cw.data.shape != cb.data.shape or cw.data.ndim != 2:
                raise ValueError('Dimensiones CWAVE/CBAND incorrectas')
            if int(cw.header['DETECTOR']) != detector or int(cb.header['DETECTOR']) != detector:
                raise ValueError('Detector de calibración incompatible')
            if cw.header.get('BUNIT', '').strip().lower() not in ('um', 'micron') or cb.header.get('BUNIT', '').strip().lower() not in ('um', 'micron'):
                raise ValueError('Unidades CWAVE/CBAND no verificadas')
            if hdus[0].header.get('DETCOORD') != header.get('DETCOORD') or not header.get('DETCOORD'):
                raise ValueError('Orientación detector no verificada')
            x0, y0 = 1-float(header['CRPIX1A']), 1-float(header['CRPIX2A'])
            if not x0.is_integer() or not y0.is_integer(): raise ValueError('Origen detector no entero')
            x, y = int(x0), int(y0); height, width = shape
            if x < 0 or y < 0 or y+height > cw.data.shape[0] or x+width > cw.data.shape[1]:
                raise ValueError('Recorte fuera de la calibración')
            wavelength = np.array(cw.data[y:y+height, x:x+width], dtype=float)
            bandwidth = np.array(cb.data[y:y+height, x:x+width], dtype=float)
        info = {'source':'CWAVE/CBAND', 'verified':True, 'uuid':uuid, 'version':record['version'],
                'sha256':record['sha256'], 'source_url':record['source_url'], 'detector':detector, 'release':release,
                'note':'Asociación UUID/producto declarada y verificada externamente por el administrador.'}
        return wavelength, bandwidth, info
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        info['reason'] = str(exc)
        return None, None, info
