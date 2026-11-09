"""Cliente TAP/ADQL acotado para AllWISE (NASA/IPAC IRSA TAP).

Consulta exclusivamente el servicio oficial de IRSA (`https://irsa.ipac.caltech.edu/TAP/sync`)
sobre la tabla documentada `allwise_p3as_psd`. No acepta URLs ni ADQL arbitrarios.
Las proximidades angulares con otras fuentes se etiquetan siempre como asociaciones
candidatas no confirmadas y nunca se realizan restas directas con imágenes SPHEREx.
"""
from __future__ import annotations

import csv
import io
import math
import re
import threading
import time
from collections import OrderedDict
from datetime import datetime, timezone

import httpx

from .gaia_client import angular_separation_arcsec, validate_cone
from .network import fetch_bytes

WISE_TAP_URL = "https://irsa.ipac.caltech.edu/TAP/sync"
WISE_TABLE = "allwise_p3as_psd"
WISE_COLUMNS = (
    "designation",
    "ra",
    "dec",
    "w1mpro",
    "w1sigmpro",
    "w2mpro",
    "w2sigmpro",
    "w3mpro",
    "w3sigmpro",
    "w4mpro",
    "w4sigmpro",
    "ph_qual",
    "cc_flags",
    "ext_flg",
)
MAX_RESULTS = 200
DEFAULT_LIMIT = 120
MAX_RADIUS_DEG = 0.25
MAX_WISE_BYTES = 2 * 1024 * 1024
CACHE_TTL = 1800
MAX_CACHE = 256
DESIGNATION_PATTERN = re.compile(r"^[A-Za-z0-9_.+-]{1,40}$")

_cache: OrderedDict[tuple[float, float, float, int], tuple[float, dict]] = OrderedDict()
_lock = threading.Lock()


class WiseError(Exception):
    """Error externo de consulta al catálogo AllWISE en IRSA TAP."""


def _number(value) -> float | None:
    if value is None:
        return None
    text = str(value).strip().strip('"')
    if not text or text.lower() in ("null", "nan", "none"):
        return None
    try:
        n = float(text)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def _int_or_none(value) -> int | None:
    if value is None:
        return None
    text = str(value).strip().strip('"')
    if not text or text.lower() in ("null", "nan", "none"):
        return None
    try:
        return int(text)
    except (TypeError, ValueError):
        return None


def _clean_flag(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip().strip('"')
    if not text or text.lower() in ("null", "nan", "none"):
        return None
    return text


def build_adql(ra: float, dec: float, radius: float, limit: int = DEFAULT_LIMIT) -> str:
    """Construye una consulta ADQL fija sobre allwise_p3as_psd en IRSA TAP."""
    validate_cone(ra, dec, radius, limit)
    columns = ", ".join(WISE_COLUMNS)
    top = limit + 1
    return (
        f"SELECT TOP {top} {columns} "
        f"FROM {WISE_TABLE} "
        f"WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra:.10f}, {dec:.10f}, {radius:.10f})) = 1"
    )


def normalize_row(row: dict, center_ra: float, center_dec: float) -> dict | None:
    lowered = {(k or "").strip().lower(): v for k, v in row.items()}
    designation = str(lowered.get("designation") or "").strip().strip('"')
    if not DESIGNATION_PATTERN.fullmatch(designation):
        return None
    ra = _number(lowered.get("ra"))
    dec = _number(lowered.get("dec"))
    if ra is None or dec is None or not (0.0 <= ra < 360.0 and -90.0 <= dec <= 90.0):
        return None
    return {
        "source_id": designation,
        "designation": designation,
        "catalog": "AllWISE",
        "ra": ra,
        "dec": dec,
        "w1mpro": _number(lowered.get("w1mpro")),
        "w1sigmpro": _number(lowered.get("w1sigmpro")),
        "w2mpro": _number(lowered.get("w2mpro")),
        "w2sigmpro": _number(lowered.get("w2sigmpro")),
        "w3mpro": _number(lowered.get("w3mpro")),
        "w3sigmpro": _number(lowered.get("w3sigmpro")),
        "w4mpro": _number(lowered.get("w4mpro")),
        "w4sigmpro": _number(lowered.get("w4sigmpro")),
        "ph_qual": _clean_flag(lowered.get("ph_qual")),
        "cc_flags": _clean_flag(lowered.get("cc_flags")),
        "ext_flg": _int_or_none(lowered.get("ext_flg")),
        "separation_arcsec": angular_separation_arcsec(center_ra, center_dec, ra, dec),
        "association_status": "candidata_no_confirmada",
    }


def parse_csv(text: str, center_ra: float, center_dec: float, limit: int = DEFAULT_LIMIT) -> tuple[list[dict], bool]:
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise WiseError("Formato de respuesta AllWISE de IRSA no reconocido")
    headers = {name.strip().lower() for name in reader.fieldnames if name}
    if not {"designation", "ra", "dec"}.issubset(headers):
        raise WiseError("Columnas requeridas de AllWISE ausentes en la respuesta")
    seen: set[str] = set()
    items: list[dict] = []
    for row in reader:
        normalized = normalize_row(row, center_ra, center_dec)
        if not normalized or normalized["designation"] in seen:
            continue
        seen.add(normalized["designation"])
        items.append(normalized)
    truncated = len(items) > limit
    items.sort(key=lambda item: (item["separation_arcsec"], item["designation"]))
    return items[:limit], truncated


def search_cone(ra: float, dec: float, radius: float = 0.05, limit: int = DEFAULT_LIMIT) -> dict:
    validate_cone(ra, dec, radius, limit)
    cache_key = (round(ra, 7), round(dec, 7), round(radius, 7), limit)
    now = time.monotonic()
    with _lock:
        cached = _cache.get(cache_key)
        if cached is not None and cached[0] > now:
            _cache.move_to_end(cache_key)
            payload = dict(cached[1])
            payload["cached"] = True
            return payload
        _cache.pop(cache_key, None)

    query = build_adql(ra, dec, radius, limit)
    params = {
        "REQUEST": "doQuery",
        "LANG": "ADQL",
        "FORMAT": "csv",
        "QUERY": query,
    }
    try:
        raw = fetch_bytes(WISE_TAP_URL, params, MAX_WISE_BYTES, timeout=25, attempts=2)
        text = raw.decode("utf-8-sig")
        sources, truncated = parse_csv(text, ra, dec, limit)
    except httpx.TimeoutException as exc:
        raise WiseError("IRSA TAP (AllWISE) agotó el tiempo de espera") from exc
    except (httpx.HTTPError, UnicodeError, csv.Error) as exc:
        raise WiseError("No se pudo consultar AllWISE en IRSA TAP") from exc
    except ValueError as exc:
        raise WiseError("Respuesta de AllWISE en IRSA TAP demasiado grande o inválida") from exc

    queried_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    result = {
        "mode": "real",
        "source": "NASA/IPAC IRSA TAP",
        "catalog": "AllWISE Source Catalog (allwise_p3as_psd)",
        "reference_epoch": None,
        "coordinate_reference": "ICRS / equinoccio J2000",
        "epoch_notice": "AllWISE combina exposiciones de distintas fechas; J2000 no es una época de observación del producto.",
        "service_url": WISE_TAP_URL,
        "association_status": "candidata_por_proximidad_no_confirmada",
        "query": {"ra": ra, "dec": dec, "radius_deg": radius, "limit": limit},
        "count": len(sources),
        "limit": limit,
        "truncated": truncated,
        "cached": False,
        "queried_at_utc": queried_at,
        "sources": sources,
        "notice": (
            "Posiciones y magnitudes infrarrojas reales del catálogo AllWISE (NASA/IPAC IRSA). "
            "Cualquier coincidencia por proximidad angular con Gaia DR3 o SPHEREx es una "
            "asociación candidata no confirmada; no se realizan restas directas entre imágenes WISE y SPHEREx."
        ),
    }
    with _lock:
        _cache[cache_key] = (time.monotonic() + CACHE_TTL, result)
        _cache.move_to_end(cache_key)
        while len(_cache) > MAX_CACHE:
            _cache.popitem(last=False)
    return dict(result)


def clear_cache() -> None:
    with _lock:
        _cache.clear()
