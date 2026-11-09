import os

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.astronomy import gaia_client as gc, wise_client as wc

client = TestClient(app)

SAMPLE_GAIA_CSV = (
    "source_id,ra,dec,ref_epoch,phot_g_mean_mag,bp_rp,phot_bp_mean_mag,phot_rp_mean_mag,"
    "pmra,pmra_error,pmdec,pmdec_error,parallax,parallax_error,ruwe\n"
    "3017364063331140096,83.822100,-5.391100,2016.0,11.452,0.612,11.720,11.108,"
    "1.250,0.032,-0.840,0.029,2.410,0.035,1.021\n"
    "3017364063331140097,83.823500,-5.390200,2016.0,16.810,,,,-2.100,0.120,,,,,\n"
)

SAMPLE_WISE_CSV = (
    "designation,ra,dec,w1mpro,w1sigmpro,w2mpro,w2sigmpro,w3mpro,w3sigmpro,w4mpro,w4sigmpro,ph_qual,cc_flags,ext_flg\n"
    "J053517.30-052327.9,83.822083,-5.391083,8.912,0.023,8.451,0.021,6.120,0.045,3.810,,AAAB,0000,0\n"
    "J053517.64-052324.7,83.823500,-5.390194,13.420,0.050,13.110,0.062,,,,,BBNN,dd00,1\n"
)


@pytest.fixture(autouse=True)
def _clear_catalog_caches():
    gc.clear_cache()
    wc.clear_cache()
    yield
    gc.clear_cache()
    wc.clear_cache()


@pytest.mark.parametrize(
    "query",
    [
        "ra=-1&dec=0",
        "ra=360&dec=0",
        "ra=0&dec=-91",
        "ra=0&dec=91",
        "ra=nan&dec=0",
        "ra=0&dec=0&radius=0",
        "ra=0&dec=0&radius=0.251",
        "ra=0&dec=0&limit=0",
        "ra=0&dec=0&limit=201",
    ],
)
def test_invalid_catalog_queries(query):
    assert client.get("/api/gaia/sources?" + query).status_code == 422
    assert client.get("/api/wise/sources?" + query).status_code == 422


def test_gaia_parse_and_preserve_64bit_source_id_and_nulls():
    sources, truncated = gc.parse_csv(SAMPLE_GAIA_CSV, 83.8221, -5.3911, limit=10)
    assert not truncated
    assert len(sources) == 2
    first, second = sources
    assert isinstance(first["source_id"], str)
    assert first["source_id"] == "3017364063331140096"
    assert first["phot_g_mean_mag"] == pytest.approx(11.452)
    assert first["parallax"] == pytest.approx(2.41)
    assert first["ruwe"] == pytest.approx(1.021)
    assert first["separation_arcsec"] == pytest.approx(0.0, abs=1e-3)

    assert second["source_id"] == "3017364063331140097"
    assert second["bp_rp"] is None
    assert second["phot_bp_mean_mag"] is None
    assert second["pmra"] is None
    assert second["pmdec"] == pytest.approx(-2.1)
    assert second["parallax"] is None
    assert second["ruwe"] is None



def test_gaia_galactic_columns_are_real_and_nullable():
    query = gc.build_adql(83.8221, -5.3911, 0.02, 8)
    assert "source_id, ra, dec, l, b, ref_epoch" in query
    text = (
        "source_id,ra,dec,l,b,ref_epoch,phot_g_mean_mag,bp_rp\n"
        "3017364063331140096,83.8221,-5.3911,209.014,-19.381,2016.0,11.452,0.612\n"
        "3017364063331140097,83.8235,-5.3902,,,2016.0,16.810,\n"
    )
    sources, truncated = gc.parse_csv(text, 83.8221, -5.3911, limit=8)
    assert not truncated
    assert sources[0]["l"] == pytest.approx(209.014)
    assert sources[0]["b"] == pytest.approx(-19.381)
    assert sources[1]["l"] is None and sources[1]["b"] is None
    assert isinstance(sources[0]["source_id"], str)


def test_catalog_only_mode_keeps_irsa_offline(monkeypatch):
    monkeypatch.setenv("SPHERALYX_OFFLINE", "1")
    monkeypatch.setenv("SPHERALYX_CATALOGS_ONLINE", "1")
    monkeypatch.setattr(gc, "search_cone", lambda *args: {"mode": "real", "sources": [], "count": 0})
    assert client.get("/health").json()["catalog_mode"] == "real"
    assert client.get("/api/gaia/sources?ra=83&dec=-5&radius=0.02").status_code == 200
    assert client.get("/api/observations?ra=83&dec=-5").status_code == 503


def test_gaia_missing_epoch_remains_null():
    # No atribuir al registro una época que no se recibió realmente del servicio.
    text = SAMPLE_GAIA_CSV.replace("2016.0,16.810", ",16.810")
    sources, truncated = gc.parse_csv(text, 83.8221, -5.3911, limit=10)
    assert len(sources) == 2 and not truncated
    assert sources[0]["ref_epoch"] == 2016.0
    assert sources[1]["ref_epoch"] is None


def test_gaia_truncation_and_cache(monkeypatch):
    real_client = httpx.Client
    calls = 0

    def handler(request):
        nonlocal calls
        calls += 1
        assert str(request.url).startswith(gc.GAIA_TAP_URL)
        assert "FROM gaiadr3.gaia_source" in request.url.params["QUERY"]
        assert "SELECT TOP 2 " in request.url.params["QUERY"]
        return httpx.Response(200, text=SAMPLE_GAIA_CSV)

    monkeypatch.setattr(
        gc.httpx,
        "Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )

    resp1 = client.get("/api/gaia/sources?ra=83.8221&dec=-5.3911&radius=0.05&limit=1")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["mode"] == "real"
    assert data1["truncated"] is True
    assert data1["cached"] is False
    assert data1["count"] == 1
    assert data1["sources"][0]["source_id"] == "3017364063331140096"

    resp2 = client.get("/api/gaia/sources?ra=83.8221&dec=-5.3911&radius=0.05&limit=1")
    assert resp2.status_code == 200
    assert resp2.json()["cached"] is True
    assert calls == 1


def test_gaia_empty_and_upstream_error(monkeypatch):
    real_client = httpx.Client

    def empty_handler(request):
        return httpx.Response(200, text="source_id,ra,dec\n")

    monkeypatch.setattr(
        gc.httpx,
        "Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(empty_handler), **kwargs),
    )
    resp = client.get("/api/gaia/sources?ra=10&dec=10&radius=0.02")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 0 and body["sources"] == [] and body["truncated"] is False

    def timeout_handler(request):
        raise httpx.ConnectTimeout("timeout", request=request)

    monkeypatch.setattr(
        gc.httpx,
        "Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(timeout_handler), **kwargs),
    )
    err_resp = client.get("/api/gaia/sources?ra=20&dec=20&radius=0.02")
    assert err_resp.status_code == 502
    assert "tiempo" in err_resp.json()["detail"].lower()


def test_wise_parse_and_endpoint(monkeypatch):
    real_client = httpx.Client

    def handler(request):
        assert str(request.url).startswith(wc.WISE_TAP_URL)
        assert "FROM allwise_p3as_psd" in request.url.params["QUERY"]
        return httpx.Response(200, text=SAMPLE_WISE_CSV)

    monkeypatch.setattr(
        wc.httpx,
        "Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    resp = client.get("/api/wise/sources?ra=83.8221&dec=-5.3911&radius=0.05&limit=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "real"
    assert data["reference_epoch"] is None
    assert "J2000" in data["coordinate_reference"]
    assert "no es una época de observación" in data["epoch_notice"]
    assert data["association_status"] == "candidata_por_proximidad_no_confirmada"
    assert data["count"] == 2
    first = data["sources"][0]
    assert first["designation"] == "J053517.30-052327.9"
    assert first["w1mpro"] == pytest.approx(8.912)
    assert first["w4sigmpro"] is None
    assert first["ph_qual"] == "AAAB"
    assert first["association_status"] == "candidata_no_confirmada"


def test_offline_guard_blocks_gaia_and_wise(monkeypatch):
    monkeypatch.setenv("SPHERALYX_OFFLINE", "1")
    assert client.get("/api/gaia/sources?ra=83.8221&dec=-5.3911&radius=0.05").status_code == 503
    assert client.get("/api/wise/sources?ra=83.8221&dec=-5.3911&radius=0.05").status_code == 503
    assert client.post("/api/experimental/motion", json={"seed": 42}).status_code == 200


@pytest.mark.skipif(os.getenv("SPHERALYX_LIVE_TEST") != "1", reason="Prueba real opcional")
def test_live_gaia_and_wise():
    gaia = gc.search_cone(83.8221, -5.3911, 0.02, limit=10)
    assert gaia["mode"] == "real" and gaia["count"] >= 1
    assert isinstance(gaia["sources"][0]["source_id"], str)

    wise = wc.search_cone(83.8221, -5.3911, 0.02, limit=10)
    assert wise["mode"] == "real" and wise["count"] >= 1
    assert isinstance(wise["sources"][0]["designation"], str)
