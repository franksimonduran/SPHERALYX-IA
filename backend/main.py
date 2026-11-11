"""API de SPHERALYX: búsquedas reales, sin mezclar con la demostración local."""
import os
import threading
import time
from collections import deque
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, Field

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from fastapi.staticfiles import StaticFiles

from .astronomy import fits_processor, spherex_client, temporal, pair_finder, datalink, gaia_client, wise_client
from .astronomy import motion_detection, validation_lab, classification_lab

app = FastAPI(title="SPHERALYX AI", version="0.3.0-rc1")
origins = [x.strip() for x in os.getenv("SPHERALYX_CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"], expose_headers=["X-Flagged-Pixels", "X-Invalid-Pixels", "X-Preview-Scientific"])


_catalog_access = deque()
_catalog_access_lock = threading.Lock()
CATALOG_WINDOW_SECONDS = 600
CATALOG_MAX_REQUESTS = 40  # global per Render worker; protects external ESA/NASA upstream
_catalog_semaphore = threading.BoundedSemaphore(3)

def _flag(name):
    return os.getenv(name, '').strip().lower() in ('1', 'true', 'yes')

@app.middleware('http')
async def offline_guard(request, call_next):
    """SPHEREx permanece offline; permitir catálogos solamente con opt-in explícito."""
    offline = _flag('SPHERALYX_OFFLINE')
    catalogs_online = _flag('SPHERALYX_CATALOGS_ONLINE')
    path = request.url.path
    # Los ensayos con datos sinteticos son pruebas internas, nunca parte de la API publica.
    # Activacion explicita solo en entornos privados de QA (no habilitar en Render).
    if (path == '/api/experimental' or path.startswith('/api/experimental/')) and not _flag('SPHERALYX_INTERNAL_EXPERIMENTS'):
        return JSONResponse(status_code=404, content={
            'detail': 'Los experimentos sintéticos no están disponibles en esta plataforma de observaciones reales.'
        })
    is_catalog = path == '/api/gaia' or path.startswith('/api/gaia/') or path == '/api/wise' or path.startswith('/api/wise/')
    is_irsa = path == '/api/observations' or path.startswith('/api/observations/') or path == '/api/temporal' or path.startswith('/api/temporal/')
    if offline and (is_irsa or (is_catalog and not catalogs_online)):
        return JSONResponse(status_code=503, content={'detail':'Modo offline del servidor: servicio solicitado desactivado'})
    if is_catalog and catalogs_online:
        # Cuota global: evita exposición sin controles a TAP público.
        now = time.monotonic()
        with _catalog_access_lock:
            while _catalog_access and now - _catalog_access[0] >= CATALOG_WINDOW_SECONDS:
                _catalog_access.popleft()
            if len(_catalog_access) >= CATALOG_MAX_REQUESTS:
                return JSONResponse(status_code=429, content={'detail':'Límite de consultas a Gaia/WISE alcanzado. Vuelve más tarde.'}, headers={'Retry-After':'600'})
            _catalog_access.append(now)
        if not _catalog_semaphore.acquire(blocking=False):
            return JSONResponse(status_code=429, content={'detail':'Demasiadas consultas a catálogos en paralelo. Intenta otra vez.'}, headers={'Retry-After':'15'})
        try:
            return await call_next(request)
        finally:
            _catalog_semaphore.release()
    return await call_next(request)


@app.get("/health")
def health():
    offline = _flag('SPHERALYX_OFFLINE')
    catalogs_online = _flag('SPHERALYX_CATALOGS_ONLINE')
    return {"status":"ok","service":"spheralyx",
            "data_mode":"offline" if offline else "real",
            "catalog_mode":"real" if catalogs_online or not offline else "offline",
            "upstream_checked":False}


@app.get("/api/observations")
def observations(ra: float = Query(ge=0, lt=360, allow_inf_nan=False),
                 dec: float = Query(ge=-90, le=90, allow_inf_nan=False),
                 radius: float = Query(default=0.01, gt=0, le=0.25, allow_inf_nan=False),
                 release: Literal["qr2", "qr3"] = "qr3"):
    try:
        items = spherex_client.search(ra, dec, radius, release)
    except spherex_client.IrsaError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"mode": "real", "source": "NASA/IPAC IRSA SIA2", "release": release,
            "query": {"ra": ra, "dec": dec, "radius_deg": radius}, "count": len(items),
            "limit": spherex_client.MAX_RESULTS, "observations": items,
            "notice": "La intersección no garantiza que el centro esté dentro de todas las imágenes; bandas distintas no son automáticamente comparables."}


@app.get("/api/gaia/sources")
def gaia_sources(ra: float = Query(ge=0, lt=360, allow_inf_nan=False),
                 dec: float = Query(ge=-90, le=90, allow_inf_nan=False),
                 radius: float = Query(default=0.05, gt=0, le=gaia_client.MAX_RADIUS_DEG, allow_inf_nan=False),
                 limit: int = Query(default=gaia_client.DEFAULT_LIMIT, ge=1, le=gaia_client.MAX_RESULTS)):
    try:
        return gaia_client.search_cone(ra, dec, radius, limit)
    except gaia_client.GaiaError as exc:
        raise HTTPException(502, str(exc)) from exc


@app.get("/api/wise/sources")
def wise_sources(ra: float = Query(ge=0, lt=360, allow_inf_nan=False),
                 dec: float = Query(ge=-90, le=90, allow_inf_nan=False),
                 radius: float = Query(default=0.05, gt=0, le=wise_client.MAX_RADIUS_DEG, allow_inf_nan=False),
                 limit: int = Query(default=wise_client.DEFAULT_LIMIT, ge=1, le=wise_client.MAX_RESULTS)):
    try:
        return wise_client.search_cone(ra, dec, radius, limit)
    except wise_client.WiseError as exc:
        raise HTTPException(502, str(exc)) from exc


def _get(identifier: str):
    try:
        return spherex_client.get_observation(identifier)
    except spherex_client.UnknownObservation as exc:
        raise HTTPException(404, "Observación desconocida o caducada; repite la búsqueda") from exc


@app.get("/api/observations/{identifier}")
def observation(identifier: str):
    return _get(identifier)


@app.get("/api/observations/{identifier}/preview")
def preview(identifier: str):
    item = _get(identifier)
    try:
        png, info = fits_processor.get_preview(item)
    except spherex_client.IrsaError as exc:
        raise HTTPException(502, str(exc)) from exc
    return Response(png, media_type="image/png", headers={
        "Cache-Control": "private, max-age=300", "X-Preview-Scientific": "false",
        "X-Invalid-Pixels": str(info["invalid_pixels"]),
        "X-Flagged-Pixels": str(info["nonzero_flag_pixels"]) if info["nonzero_flag_pixels"] is not None else "unknown"})


@app.get("/api/observations/{identifier}/metadata")
def observation_metadata(identifier: str):
    return temporal.metadata(_get(identifier))


@app.get('/api/observations/{identifier}/calibration-links')
def calibration_links(identifier: str):
    observation = _get(identifier)
    publisher_id = observation.get('publisher_id')
    if not publisher_id or not datalink.PUBLISHER_ID.fullmatch(publisher_id):
        raise HTTPException(422, 'La observación no tiene un identificador de publicación SPHEREx válido')
    try:
        result = datalink.inspect(publisher_id)
    except spherex_client.IrsaError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {'mode': 'real', 'observation_id': identifier, **result}


class ComparisonRequest(BaseModel):
    a: str = Field(pattern=r'^[a-f0-9]{64}$')
    b: str = Field(pattern=r'^[a-f0-9]{64}$')


class PairSearchRequest(BaseModel):
    ra: float = Field(ge=0, lt=360, allow_inf_nan=False)
    dec: float = Field(ge=-90, le=90, allow_inf_nan=False)
    radius: float = Field(default=.01, gt=0, le=.25, allow_inf_nan=False)
    release: Literal['qr2', 'qr3'] = 'qr2'
    max_pairs: int = Field(default=3, ge=1, le=3)


@app.post('/api/temporal/pairs')
def search_pairs(request: PairSearchRequest):
    try:
        return pair_finder.find_pairs(request.ra, request.dec, request.radius, request.release, request.max_pairs)
    except spherex_client.IrsaError as exc:
        raise HTTPException(502, str(exc)) from exc
    except temporal.TemporalTimeout as exc:
        raise HTTPException(504, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc


@app.post("/api/temporal/compare")
def compare_observations(request: ComparisonRequest):
    a, b = _get(request.a), _get(request.b)
    try:
        return temporal.compare(a, b)
    except spherex_client.IrsaError as exc:
        raise HTTPException(502, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, f"Datos científicos insuficientes o incompatibles: {exc}") from exc
    except temporal.TemporalTimeout as exc:
        raise HTTPException(504, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc


@app.get("/api/temporal/results/{identifier}")
def temporal_result(identifier: str):
    result = temporal.get_result(identifier)
    if result is None:
        raise HTTPException(404, "Resultado desconocido o caducado")
    return result


class SyntheticRequest(BaseModel):
    seed: int = Field(default=42, ge=0, le=1000000)
    tolerance: float = Field(default=6, ge=0.5, le=12, allow_inf_nan=False)
    threshold: float = Field(default=5, ge=3, le=12, allow_inf_nan=False)


@app.post('/api/experimental/motion')
def synthetic_motion(request: SyntheticRequest):
    return motion_detection.run_experiment(request.seed, request.tolerance, request.threshold)


class ValidationRequest(BaseModel):
    seed: int = Field(default=42, ge=0, le=1000000)
    scenarios: int = Field(default=5, ge=1, le=validation_lab.MAX_SCENARIOS)
    source_count: int = Field(default=30, ge=0, le=validation_lab.MAX_SOURCES)
    noise: float = Field(default=5, ge=1, le=30, allow_inf_nan=False)
    density: Literal['sparse', 'dense'] = 'sparse'
    displacement: float = Field(default=4, ge=0, le=12, allow_inf_nan=False)
    psf: Literal['constant', 'variable'] = 'constant'
    artifacts: int = Field(default=2, ge=0, le=20)
    tolerance: float = Field(default=6, ge=.5, le=12, allow_inf_nan=False)
    threshold: float = Field(default=5, ge=3, le=12, allow_inf_nan=False)


_validation_lock = threading.BoundedSemaphore(1)


@app.post('/api/experimental/validation')
def synthetic_validation(request: ValidationRequest):
    if not _validation_lock.acquire(blocking=False):
        raise HTTPException(503, 'Ya hay una evaluación sintética en curso en este proceso')
    try:
        return validation_lab.evaluate(**request.model_dump())
    finally:
        _validation_lock.release()


class ClassificationRequest(BaseModel):
    seed: int = Field(default=700, ge=0, le=1000000)
    source_count: int = Field(default=20, ge=0, le=60)
    epochs: int = Field(default=4, ge=3, le=6)
    interval: float = Field(default=10, ge=1, le=30, allow_inf_nan=False)
    noise: float = Field(default=3, ge=1, le=30, allow_inf_nan=False)
    density: Literal['sparse', 'dense'] = 'sparse'
    psf: Literal['constant', 'variable'] = 'constant'
    displacement: float = Field(default=3, ge=0, le=6, allow_inf_nan=False)
    moving_fraction: float = Field(default=.4, ge=0, le=1, allow_inf_nan=False)
    registration_shift: float = Field(default=1, ge=0, le=2, allow_inf_nan=False)
    artifacts: int = Field(default=2, ge=0, le=20)
    tolerance: float = Field(default=5, ge=.5, le=12, allow_inf_nan=False)
    significance: float = Field(default=4, ge=2.1, le=10, allow_inf_nan=False)
    min_snr: float = Field(default=6, ge=3, le=30, allow_inf_nan=False)
    max_residual: float = Field(default=3, ge=.5, le=20, allow_inf_nan=False)


@app.post('/api/experimental/classification')
def synthetic_classification(request: ClassificationRequest):
    if not _validation_lock.acquire(blocking=False):
        raise HTTPException(503, 'Ya hay una evaluación sintética en curso en este proceso')
    try:
        return classification_lab.evaluate(**request.model_dump())
    finally:
        _validation_lock.release()


frontend = Path(__file__).resolve().parents[1] / "frontend"
app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
