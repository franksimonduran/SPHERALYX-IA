"""Cliente SIA2 de IRSA. Los identificadores son opacos y efímeros por proceso."""
from __future__ import annotations

import csv
import hashlib
import io
import math
import re
import threading
import time
from collections import OrderedDict
from urllib.parse import urlsplit

import httpx
from astropy.time import Time
from .network import fetch_bytes

SIA_URL = "https://irsa.ipac.caltech.edu/SIA"
COLLECTIONS = {"qr2": "spherex_qr2", "qr3": "spherex_qr3"}
MAX_RESULTS = 100
MAX_SIA_BYTES = 4 * 1024 * 1024
CACHE_TTL = 1800
MAX_CACHE = 1000
_cache: OrderedDict[str, tuple[float, dict]] = OrderedDict()
_lock = threading.Lock()
ID_PATTERN = re.compile(r"^[a-f0-9]{64}$")


class IrsaError(Exception):
    """Error externo; no expone internals ni detalles potencialmente sensibles."""


class UnknownObservation(Exception):
    pass


def allowed_url(url: str) -> bool:
    """Solo productos locales SPHEREx de IRSA, sin redirecciones ni query."""
    try:
        parsed = urlsplit(url)
        path = parsed.path
        return (parsed.scheme == "https" and parsed.netloc == "irsa.ipac.caltech.edu"
                and path.startswith("/ibe/data/spherex/") and path.endswith(".fits")
                and not parsed.query and not parsed.fragment and "%" not in path
                and all(part not in (".", "..", "") for part in path.split("/")[1:])
                and re.fullmatch(r"/[A-Za-z0-9_./-]+", path) is not None)
    except ValueError:
        return False


def _number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def normalize(row: dict, release: str, ra: float, dec: float) -> dict | None:
    url = row.get("access_url", "").strip()
    if not allowed_url(url) or row.get("dataproduct_subtype", "science").lower() != "science":
        return None
    # El centro forma parte de la identidad: el mismo producto puede recortarse en distintas posiciones.
    identifier = hashlib.sha256(f"{url}|{ra:.10f}|{dec:.10f}".encode()).hexdigest()
    mjd = _number(row.get("t_min"))
    try:
        observed_utc = Time(mjd, format='mjd', scale='utc').isot if mjd is not None else None
    except (ValueError, OverflowError):
        observed_utc = None
    return {"id": identifier, "mode": "real", "release": release,
            "observation_id": row.get("obs_id") or None,
            "publisher_id": row.get("obs_publisher_did") or None,
            "band": row.get("energy_bandpassname") or None,
            "wavelength_min_m": _number(row.get("em_min")),
            "wavelength_max_m": _number(row.get("em_max")),
            "time_start_mjd": mjd, "time_end_mjd": _number(row.get("t_max")), "observation_time_utc": observed_utc,
            "release_date": row.get("obs_release_date") or None,
            "facility": row.get("facility_name") or None, "instrument": row.get("instrument_name") or None,
            "image_center": {"ra": _number(row.get("s_ra")), "dec": _number(row.get("s_dec"))},
            "coverage_region": row.get("s_region") or None,
            "grouping": {"region": {"ra": ra, "dec": dec}, "detector": row.get("energy_bandpassname") or None,
                         "epoch_mjd": mjd, "spectral_compatibility": "no verificada; requiere WCS espectral por píxel"},
            "detector": row.get("energy_bandpassname") or None,
            "calibration_level": _number(row.get("calib_level")),
            "collection": row.get("obs_collection") or COLLECTIONS[release],
            "reference_url": url, "search_center": {"ra": ra, "dec": dec},
            "preview_url": f"/api/observations/{identifier}/preview"}


def _store(item: dict) -> None:
    with _lock:
        _cache[item["id"]] = (time.monotonic() + CACHE_TTL, item)
        _cache.move_to_end(item["id"])
        while len(_cache) > MAX_CACHE:
            _cache.popitem(last=False)


def get_observation(identifier: str) -> dict:
    if not ID_PATTERN.fullmatch(identifier):
        raise UnknownObservation()
    with _lock:
        entry = _cache.get(identifier)
        if entry is None or entry[0] < time.monotonic():
            _cache.pop(identifier, None)
            raise UnknownObservation()
        return dict(entry[1])


def search(ra: float, dec: float, radius: float, release: str) -> list[dict]:
    params = {"COLLECTION": COLLECTIONS[release], "POS": f"CIRCLE {ra:.10f} {dec:.10f} {radius:.10f}",
              "MAXREC": MAX_RESULTS, "RESPONSEFORMAT": "CSV"}
    try:
        text = fetch_bytes(SIA_URL, params, MAX_SIA_BYTES, timeout=30).decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames or "access_url" not in reader.fieldnames:
            raise IrsaError("Formato de respuesta IRSA no reconocido")
        results = []
        for row in reader:
            item = normalize(row, release, ra, dec)
            if item:
                _store(item)
                results.append(item)
        return results
    except httpx.TimeoutException as exc:
        raise IrsaError("IRSA agotó el tiempo de espera") from exc
    except (httpx.HTTPError, UnicodeError, csv.Error) as exc:
        raise IrsaError("No se pudo consultar IRSA") from exc
    except ValueError as exc:
        raise IrsaError("Respuesta de IRSA demasiado grande") from exc
