"""Descarga limitada de recortes IRSA y visualización, no fotometría."""
from __future__ import annotations

import io
import logging
import threading
import time
from collections import OrderedDict

import httpx
import numpy as np
from astropy.io import fits
from PIL import Image

from .spherex_client import IrsaError, allowed_url
from .network import fetch_bytes

MAX_DOWNLOAD = 32 * 1024 * 1024
MAX_PIXELS = 4_000_000
CUTOUT_SIZE_DEG = 0.1
_previews: OrderedDict[str, tuple[float, bytes, dict]] = OrderedDict()
_lock = threading.Lock()
_cutouts: OrderedDict[str, tuple[float, bytes]] = OrderedDict()
log = logging.getLogger(__name__)


def process_fits(raw: bytes) -> tuple[bytes, dict]:
    try:
        with fits.open(io.BytesIO(raw), memmap=False, lazy_load_hdus=False) as hdus:
            if "IMAGE" not in hdus or hdus["IMAGE"].data is None:
                raise ValueError("Falta extensión IMAGE")
            source = hdus["IMAGE"].data
            if source.ndim != 2 or source.size > MAX_PIXELS or not source.size:
                raise ValueError("Dimensiones de imagen no admitidas")
            image = np.asarray(source, dtype=np.float64)
            valid = np.isfinite(image)
            if not valid.any():
                raise ValueError("Imagen sin píxeles finitos")
            flags_count = None
            if "FLAGS" in hdus and hdus["FLAGS"].data is not None:
                flags = np.asarray(hdus["FLAGS"].data)
                if flags.shape != image.shape:
                    raise ValueError("FLAGS no coincide con IMAGE")
                flags_count = int(np.count_nonzero(flags))
            lo, hi = np.percentile(image[valid], [1, 99])
            if hi <= lo:
                hi = lo + 1.0
            normalized = np.zeros(image.shape, dtype=np.uint8)
            normalized[valid] = (255 * np.clip((image[valid] - lo) / (hi - lo), 0, 1)).astype(np.uint8)
            out = io.BytesIO()
            Image.fromarray(np.flipud(normalized)).save(out, format="PNG")
            info = {"image_extension": "IMAGE", "flags_extension": "FLAGS" if flags_count is not None else None,
                    "invalid_pixels": int((~valid).sum()), "nonzero_flag_pixels": flags_count,
                    "shape": list(image.shape), "unit": hdus["IMAGE"].header.get("BUNIT"),
                    "visualization": "Escala lineal percentiles 1–99; no son mediciones científicas.",
                    "flags_note": "Se cuentan flags no nulos, sin interpretarlos ni excluirlos de la imagen."}
            return out.getvalue(), info
    except (OSError, TypeError, KeyError, IndexError) as exc:
        raise ValueError("FITS inválido o no compatible") from exc


def download_cutout(observation: dict, *, deadline=None) -> bytes:
    url = observation["reference_url"]
    if not allowed_url(url):
        raise IrsaError("URL del archivo no permitida")
    center = observation["search_center"]
    key = observation['id']
    with _lock:
        cached = _cutouts.get(key)
        if cached and cached[0] > time.monotonic():
            _cutouts.move_to_end(key)
            log.info('Recorte: caché local encontrada')
            return cached[1]
    log.info('Recorte: caché local no disponible; descargando')
    try:
        options = {'timeout': 20, 'attempts': 2, 'deadline': deadline} if deadline is not None else {}
        raw = fetch_bytes(url, {"center": f"{center['ra']},{center['dec']}", "size": CUTOUT_SIZE_DEG}, MAX_DOWNLOAD, **options)
    except httpx.TimeoutException as exc:
        raise IrsaError("IRSA agotó el tiempo de espera al obtener el recorte") from exc
    except httpx.HTTPError as exc:
        raise IrsaError("No se pudo obtener el recorte de IRSA") from exc
    except ValueError as exc:
        raise IrsaError("Recorte IRSA supera el límite de descarga") from exc
    with _lock:
        _cutouts[key] = (time.monotonic()+1800, raw)
        _cutouts.move_to_end(key)
        while len(_cutouts)>8 or sum(len(v[1]) for v in _cutouts.values())>64*1024*1024:
            _cutouts.popitem(last=False)
    return raw


def get_preview(observation: dict) -> tuple[bytes, dict]:
    key = observation["id"]
    with _lock:
        cached = _previews.get(key)
        if cached and cached[0] > time.monotonic():
            _previews.move_to_end(key)
            return cached[1], cached[2]
    try:
        png, info = process_fits(download_cutout(observation))
    except ValueError as exc:
        raise IrsaError("El recorte FITS no contiene una imagen compatible") from exc
    with _lock:
        _previews[key] = (time.monotonic() + 1800, png, info)
        _previews.move_to_end(key)
        while len(_previews) > 32:
            _previews.popitem(last=False)
    return png, info
