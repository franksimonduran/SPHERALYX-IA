"""Cliente TAP/ADQL acotado para Gaia DR3 (ESA Gaia Archive).

Servidor, tabla y columnas son fijos: nunca se aceptan URLs ni consultas ADQL
arbitrarias desde el cliente. Los identificadores source_id se conservan como
cadena para evitar pérdida de precisión en enteros de 64 bits en JavaScript.
No se invierten paralajes en distancias físicas ni se inventan fuentes.
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

from .network import fetch_bytes

GAIA_TAP_URL = "https://gea.esac.esa.int/tap-server/tap/sync"
GAIA_TABLE = "gaiadr3.gaia_source"
GAIA_COLUMNS = (
    "source_id",
    "ra",
    "dec",
    "l",
    "b",
    "ref_epoch",
    "phot_g_mean_mag",
    "bp_rp",
    "phot_bp_mean_mag",
    "phot_rp_mean_mag",
    "pmra",
    "pmra_error",
    "pmdec",
    "pmdec_error",
    "parallax",
    "parallax_error",
    "ruwe",
)
MAX_RESULTS = 200
DEFAULT_LIMIT = 120
MAX_RADIUS_DEG = 0.25
MAX_GAIA_BYTES = 2 * 1024 * 1024
CACHE_TTL = 1800
MAX_CACHE = 256
SOURCE_ID_PATTERN = re.compile(r"^\d{1,25}$")

_cache: OrderedDict[tuple[float, float, float, int], tuple[float, dict]] = OrderedDict()
_lock = threading.Lock()


class GaiaError(Exception):
    """Error externo de consulta a ESA Gaia TAP; no expone detalles internos."""


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


def angular_separation_arcsec(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    """Separación angular esférica en segundos de arco sobre ICRS."""
    r1, d1, r2, d2 = map(math.radians, (ra1, dec1, ra2, dec2))
    dlon = r2 - r1
    dlat = d2 - d1
    a = math.sin(dlat / 2.0) ** 2 + math.cos(d1) * math.cos(d2) * math.sin(dlon / 2.0) ** 2
    angle_rad = 2.0 * math.asin(min(1.0, math.sqrt(max(0.0, a))))
    return round(math.degrees(angle_rad) * 3600.0, 4)


def validate_cone(ra: float, dec: float, radius: float, limit: int = DEFAULT_LIMIT) -> None:
    if isinstance(limit, bool) or not isinstance(limit, int) or not (1 <= limit <= MAX_RESULTS):
        raise ValueError(f"El límite debe ser un entero entre 1 y {MAX_RESULTS}")
    if (
        isinstance(ra, bool)
        or isinstance(dec, bool)
        or isinstance(radius, bool)
        or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (ra, dec, radius))
    ):
        raise ValueError("RA, Dec y radio deben ser números finitos")
    if not (0.0 <= ra < 360.0 and -90.0 <= dec <= 90.0 and 0.0 < radius <= MAX_RADIUS_DEG):
        raise ValueError(f"Parámetros fuera de rango: RA [0, 360), Dec [-90, 90], radio (0, {MAX_RADIUS_DEG}]")


def build_adql(ra: float, dec: float, radius: float, limit: int = DEFAULT_LIMIT) -> str:
    """Construye una consulta ADQL parametrizada y fija sobre gaiadr3.gaia_source."""
    validate_cone(ra, dec, radius, limit)
    columns = ", ".join(GAIA_COLUMNS)
    top = limit + 1
    return (
        f"SELECT TOP {top} {columns} "
        f"FROM {GAIA_TABLE} "
        f"WHERE 1 = CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra:.10f}, {dec:.10f}, {radius:.10f})) "
        f"ORDER BY phot_g_mean_mag ASC, source_id ASC"
    )


def normalize_row(row: dict, center_ra: float, center_dec: float) -> dict | None:
    lowered = {(k or "").strip().lower(): v for k, v in row.items()}
    raw_id = str(lowered.get("source_id") or "").strip().strip('"')
    if not SOURCE_ID_PATTERN.fullmatch(raw_id):
        return None
    ra = _number(lowered.get("ra"))
    dec = _number(lowered.get("dec"))
    if ra is None or dec is None or not (0.0 <= ra < 360.0 and -90.0 <= dec <= 90.0):
        return None
    ref_epoch = _number(lowered.get("ref_epoch"))
    return {
        "source_id": raw_id,
        "catalog": "Gaia DR3",
        "ra": ra,
        "dec": dec,
        "l": _number(lowered.get("l")),
        "b": _number(lowered.get("b")),
        "ref_epoch": ref_epoch,
        "phot_g_mean_mag": _number(lowered.get("phot_g_mean_mag")),
        "bp_rp": _number(lowered.get("bp_rp")),
        "phot_bp_mean_mag": _number(lowered.get("phot_bp_mean_mag")),
        "phot_rp_mean_mag": _number(lowered.get("phot_rp_mean_mag")),
        "pmra": _number(lowered.get("pmra")),
        "pmra_error": _number(lowered.get("pmra_error")),
        "pmdec": _number(lowered.get("pmdec")),
        "pmdec_error": _number(lowered.get("pmdec_error")),
        "parallax": _number(lowered.get("parallax")),
        "parallax_error": _number(lowered.get("parallax_error")),
        "ruwe": _number(lowered.get("ruwe")),
        "separation_arcsec": angular_separation_arcsec(center_ra, center_dec, ra, dec),
    }


def parse_csv(text: str, center_ra: float, center_dec: float, limit: int = DEFAULT_LIMIT) -> tuple[list[dict], bool]:
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise GaiaError("Formato de respuesta Gaia DR3 no reconocido")
    headers = {name.strip().lower() for name in reader.fieldnames if name}
    if not {"source_id", "ra", "dec"}.issubset(headers):
        raise GaiaError("Columnas requeridas de Gaia DR3 ausentes en la respuesta")
    seen: set[str] = set()
    items: list[dict] = []
    for row in reader:
        normalized = normalize_row(row, center_ra, center_dec)
        if not normalized or normalized["source_id"] in seen:
            continue
        seen.add(normalized["source_id"])
        items.append(normalized)
    truncated = len(items) > limit
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
        raw = fetch_bytes(GAIA_TAP_URL, params, MAX_GAIA_BYTES, timeout=25, attempts=2)
        text = raw.decode("utf-8-sig")
        sources, truncated = parse_csv(text, ra, dec, limit)
    except httpx.TimeoutException as exc:
        raise GaiaError("ESA Gaia TAP agotó el tiempo de espera") from exc
    except (httpx.HTTPError, UnicodeError, csv.Error) as exc:
        raise GaiaError("No se pudo consultar ESA Gaia TAP") from exc
    except ValueError as exc:
        raise GaiaError("Respuesta de ESA Gaia TAP demasiado grande o inválida") from exc

    queried_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    result = {
        "mode": "real",
        "source": "ESA Gaia Archive TAP",
        "catalog": "Gaia DR3 (gaiadr3.gaia_source)",
        "reference_epoch": "J2016.0",
        "service_url": GAIA_TAP_URL,
        "query": {"ra": ra, "dec": dec, "radius_deg": radius, "limit": limit},
        "count": len(sources),
        "limit": limit,
        "truncated": truncated,
        "cached": False,
        "queried_at_utc": queried_at,
        "sources": sources,
        "notice": (
            "Posiciones reales Gaia DR3 en época de catálogo (J2016.0, ICRS). "
            "Se representan únicamente como direcciones sobre la esfera celeste; "
            "las paralajes no se invierten en distancias físicas y las fuentes no se "
            "superponen sobre recortes FITS de SPHEREx sin validar WCS, orientación y época."
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
