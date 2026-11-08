import json
import logging
import subprocess
import sys
from pathlib import Path

import pytest

from tools import auditoria_irsa_fase91 as audit


def test_centers_are_finite_and_high_motion_is_propagated():
    source = json.loads((Path(__file__).resolve().parents[1] /
                         'data/samples/campos-spherex-fase91.json').read_text(encoding='utf-8'))
    assert len(source['fields']) == 5
    for field in source['fields']:
        ra, dec = audit.center(field, source['target_epoch_jyear'])
        assert 0 <= ra < 360 and -90 <= dec <= 90
    barnard = source['fields'][0]
    _, j2000_dec = audit.center(barnard, 2000.0)
    _, j2026_dec = audit.center(barnard, 2026.0)
    assert j2026_dec > j2000_dec + .07


def test_irsa_failure_is_recorded_not_fabricated(monkeypatch):
    def fail(*args):
        raise audit.spherex_client.IrsaError('IRSA no disponible')
    monkeypatch.setattr(audit.spherex_client, 'search', fail)
    field = {'name': 'test', 'ra_hms': '00 00 00', 'dec_dms': '+00 00 00',
             'pm_ra_cosdec_masyr': None, 'pm_dec_masyr': None, 'reference': 'https://example.org'}
    result = audit.inspect_field(field, 'qr2', 2026, .1)
    assert result['search']['status'] == 'error' and result['search']['error'] == 'IRSA no disponible'
    assert result['fits'] == [] and result['pair'] is None


def test_empty_search_is_not_a_failed_search(monkeypatch):
    monkeypatch.setattr(audit.spherex_client, 'search', lambda *args: [])
    field = {'name': 'test', 'ra_hms': '00 00 00', 'dec_dms': '+00 00 00',
             'pm_ra_cosdec_masyr': None, 'pm_dec_masyr': None, 'reference': 'https://example.org'}
    result = audit.inspect_field(field, 'qr3', 2026, .1)
    assert result['search']['status'] == 'ok' and result['search']['count'] == 0
    assert result['fits'] == [] and result['pair'] is None


def test_audit_records_blocked_pair_without_inventing_difference(monkeypatch):
    items = [{'id': 'a', 'time_start_mjd': 1}, {'id': 'b', 'time_start_mjd': 2}]
    monkeypatch.setattr(audit.spherex_client, 'search', lambda *args: items)
    monkeypatch.setattr(audit.pair_finder, 'rank_pairs', lambda found: [(found[0], found[1])])
    monkeypatch.setattr(audit.fits_processor, 'download_cutout', lambda item: b'FITS controlado')
    monkeypatch.setattr(audit.fits_processor, 'process_fits', lambda raw: (b'PNG controlado', {'shape': [2, 2]}))
    monkeypatch.setattr(audit.temporal, 'compare', lambda *args: {
        'compatible': False, 'reasons': ['Calibración no verificada'],
        'coverage_fraction': .5, 'spectral_match_fraction': None,
        'spectral_status': 'aproximada_no_verificada', 'fits_a': {}, 'fits_b': {},
        'views': {'a': 'controlada', 'b': 'controlada'}})
    field = {'name': 'test', 'ra_hms': '00 00 00', 'dec_dms': '+00 00 00',
             'pm_ra_cosdec_masyr': None, 'pm_dec_masyr': None, 'reference': 'https://example.org'}
    result = audit.inspect_field(field, 'qr2', 2026, .1)
    assert result['pair']['compatible'] is False
    assert result['pair']['available_views'] == ['a', 'b']
    assert all(item['status'] == 'ok' for item in result['fits'])


def sample_source():
    return {'target_epoch_jyear': 2026, 'radius_deg': .1, 'note': 'solo pruebas',
            'fields': [{'name': 'test', 'ra_hms': '00 00 00', 'dec_dms': '+00 00 00',
                        'pm_ra_cosdec_masyr': None, 'pm_dec_masyr': None,
                        'reference': 'https://example.org'}]}


def test_interruption_and_resume_keeps_download_and_skips_search(tmp_path, monkeypatch):
    path = tmp_path / 'resultado.json'
    item = {'id': 'a', 'time_start_mjd': 1}
    searches = []
    monkeypatch.setattr(audit.spherex_client, 'search', lambda *a: searches.append(a) or [item])
    monkeypatch.setattr(audit.pair_finder, 'rank_pairs', lambda found: [])
    monkeypatch.setattr(audit.fits_processor, 'download_cutout', lambda item: b'FITS')
    monkeypatch.setattr(audit.fits_processor, 'process_fits', lambda raw: (_ for _ in ()).throw(KeyboardInterrupt()))
    with pytest.raises(KeyboardInterrupt):
        audit.run(path, sample_source())
    partial = json.loads(path.read_text(encoding='utf-8'))
    assert partial['cases'][0]['search']['status'] == 'ok'
    assert partial['cases'][0]['fits'][0]['download_status'] == 'ok'
    assert partial['cases'][0]['fits'][0]['status'] == 'pending'
    assert partial['cases'][0]['fits'][0]['preview_status'] == 'pending'
    assert partial['cases'][0]['fits'][0]['fits_sha256']
    monkeypatch.setattr(audit.fits_processor, 'process_fits', lambda raw: (b'PNG', {'shape': [2, 2]}))
    completed = audit.run(path, sample_source(), resume=True)
    assert completed['finished_utc'] and len(completed['cases']) == 2
    assert completed['cases'][0]['fits'][0]['preview_status'] == 'ok'
    assert len(searches) == 2  # QR2 no se repite; QR3 se consulta una vez.
    assert json.loads(path.read_text(encoding='utf-8')) == completed


def test_resume_detects_changed_fits_and_never_compares(tmp_path, monkeypatch):
    path = tmp_path / 'resultado.json'
    item = {'id': 'a', 'time_start_mjd': 1}
    monkeypatch.setattr(audit.spherex_client, 'search', lambda *a: [item])
    monkeypatch.setattr(audit.pair_finder, 'rank_pairs', lambda found: [])
    monkeypatch.setattr(audit.fits_processor, 'download_cutout', lambda item: b'original')
    monkeypatch.setattr(audit.fits_processor, 'process_fits', lambda raw: (_ for _ in ()).throw(KeyboardInterrupt()))
    with pytest.raises(KeyboardInterrupt):
        audit.run(path, sample_source())
    monkeypatch.setattr(audit.fits_processor, 'download_cutout', lambda item: b'cambiado')
    monkeypatch.setattr(audit.fits_processor, 'process_fits', lambda raw: (b'PNG', {}))
    result = audit.run(path, sample_source(), resume=True)
    assert result['cases'][0]['fits'][0]['preview_status'] == 'error'
    assert 'cambió' in result['cases'][0]['fits'][0]['error']
    assert result['cases'][0]['pair'] is None


def test_truncation_and_empty_search_recorded(tmp_path, monkeypatch):
    items = [{'id': str(i), 'time_start_mjd': i} for i in range(100)]
    monkeypatch.setattr(audit.spherex_client, 'search', lambda ra, dec, radius, release: items if release == 'qr2' else [])
    monkeypatch.setattr(audit.pair_finder, 'rank_pairs', lambda found: [])
    monkeypatch.setattr(audit.fits_processor, 'download_cutout', lambda item: b'FITS')
    monkeypatch.setattr(audit.fits_processor, 'process_fits', lambda raw: (b'PNG', {}))
    output = audit.run(tmp_path / 'out.json', sample_source())
    assert output['cases'][0]['search']['possibly_truncated'] is True
    assert len(output['cases'][0]['search']['observations']) == 100
    assert output['cases'][1]['search']['count'] == 0
    assert output['cases'][1]['fits'] == [] and output['cases'][1]['pair'] is None


def test_resume_rejects_changed_configuration_and_never_overwrites(tmp_path, monkeypatch):
    path = tmp_path / 'out.json'
    monkeypatch.setattr(audit.spherex_client, 'search', lambda *a: [])
    audit.run(path, sample_source())
    original = path.read_bytes()
    with pytest.raises(FileExistsError):
        audit.run(path, sample_source())
    changed = sample_source()
    changed['radius_deg'] = .2
    with pytest.raises(ValueError, match='no coinciden'):
        audit.run(path, changed, resume=True)
    assert path.read_bytes() == original


def test_atomic_write_failure_preserves_previous_json(tmp_path, monkeypatch):
    path = tmp_path / 'out.json'
    path.write_text('{"old": true}', encoding='utf-8')
    def fail(*args):
        raise OSError('sin espacio')
    monkeypatch.setattr(audit.os, 'replace', fail)
    with pytest.raises(OSError, match='sin espacio'):
        audit.save_checkpoint(path, {'new': True})
    assert json.loads(path.read_text(encoding='utf-8')) == {'old': True}
    assert list(tmp_path.glob('*.tmp')) == []


def test_network_error_and_retry_warning_survive_resume(tmp_path, monkeypatch):
    path = tmp_path / 'out.json'
    calls = []
    def search(*args):
        calls.append(args)
        logging.getLogger('backend.astronomy.network').warning('IRSA HTTP 503, reintento')
        raise audit.spherex_client.IrsaError('IRSA no disponible')
    monkeypatch.setattr(audit.spherex_client, 'search', search)
    first = audit.run(path, sample_source())
    assert all(c['search']['status'] == 'error' and c['warnings'] for c in first['cases'])
    resumed = audit.run(path, sample_source(), resume=True)
    assert len(calls) == 2 and resumed == first
    assert resumed['cases'][0]['search']['error'] == 'IRSA no disponible'


def test_lock_prevents_concurrent_execution(tmp_path):
    path = tmp_path / 'out.json'
    with audit.output_lock(path):
        with pytest.raises(RuntimeError, match='Otra auditoría'):
            with audit.output_lock(path):
                pass


def test_process_termination_releases_lock_and_keeps_checkpoint(tmp_path, monkeypatch):
    path = tmp_path / 'out.json'
    root = Path(__file__).resolve().parents[1]
    code = '''
import os, sys
from tools import auditoria_irsa_fase91 as a
source = {"target_epoch_jyear": 2026, "radius_deg": .1, "note": "solo pruebas", "fields": [
    {"name": "test", "ra_hms": "00 00 00", "dec_dms": "+00 00 00",
     "pm_ra_cosdec_masyr": None, "pm_dec_masyr": None, "reference": "https://example.org"}]}
a.spherex_client.search = lambda *args: [{"id": "a", "time_start_mjd": 1}]
a.pair_finder.rank_pairs = lambda items: []
a.fits_processor.download_cutout = lambda item: b"FITS"
a.fits_processor.process_fits = lambda raw: os._exit(71)
a.run(sys.argv[1], source)
'''
    process = subprocess.run([sys.executable, '-c', code, str(path)], cwd=root, capture_output=True)
    assert process.returncode == 71
    partial = json.loads(path.read_text(encoding='utf-8'))
    assert partial['cases'][0]['fits'][0]['preview_status'] == 'pending'
    monkeypatch.setattr(audit.spherex_client, 'search', lambda *a: [])
    monkeypatch.setattr(audit.fits_processor, 'download_cutout', lambda item: b'FITS')
    monkeypatch.setattr(audit.fits_processor, 'process_fits', lambda raw: (b'PNG', {}))
    result = audit.run(path, sample_source(), resume=True)
    assert result['cases'][0]['fits'][0]['preview_status'] == 'ok'
    assert result['finished_utc']


def test_later_interruption_preserves_completed_case(tmp_path, monkeypatch):
    path = tmp_path / 'out.json'
    calls = []
    def search(ra, dec, radius, release):
        calls.append(release)
        if release == 'qr3':
            raise KeyboardInterrupt()
        return []
    monkeypatch.setattr(audit.spherex_client, 'search', search)
    with pytest.raises(KeyboardInterrupt):
        audit.run(path, sample_source())
    partial = json.loads(path.read_text(encoding='utf-8'))
    assert partial['cases'][0]['finished_utc'] and partial['cases'][0]['search']['count'] == 0
    assert partial['cases'][1]['search'] is None
    monkeypatch.setattr(audit.spherex_client, 'search', lambda *a: calls.append(a[-1]) or [])
    resumed = audit.run(path, sample_source(), resume=True)
    assert calls == ['qr2', 'qr3', 'qr3']
    assert resumed['cases'][0] == partial['cases'][0]


def test_checkpoint_failure_is_not_misreported_as_fits_error(monkeypatch):
    item = {'id': 'a', 'time_start_mjd': 1}
    monkeypatch.setattr(audit.spherex_client, 'search', lambda *a: [item])
    monkeypatch.setattr(audit.pair_finder, 'rank_pairs', lambda found: [])
    monkeypatch.setattr(audit.fits_processor, 'download_cutout', lambda item: b'FITS')
    result = {'field': 'test', 'query': {'ra': 0, 'dec': 0, 'radius_deg': .1, 'release': 'qr2'},
              'source': 'https://example.org', 'search': None, 'fits': [], 'pair': None}
    saves = []
    def checkpoint():
        saves.append(True)
        if len(saves) == 2:
            raise OSError('disco lleno')
    with pytest.raises(OSError, match='disco lleno'):
        audit.inspect_field(sample_source()['fields'][0], 'qr2', 2026, .1, result, checkpoint)
    assert result['fits'][0]['download_status'] == 'ok'
    assert result['fits'][0]['preview_status'] == 'pending'
    assert 'error' not in result['fits'][0]


def test_checkpoint_failure_during_network_warning_propagates(tmp_path, monkeypatch):
    path = tmp_path / 'out.json'
    item = {'id': 'a', 'time_start_mjd': 1}
    monkeypatch.setattr(audit.spherex_client, 'search', lambda *args: [item])
    monkeypatch.setattr(audit.pair_finder, 'rank_pairs', lambda found: [])
    def download(item):
        logging.getLogger('backend.astronomy.network').warning('IRSA HTTP 503, reintento')
        return b'FITS'
    monkeypatch.setattr(audit.fits_processor, 'download_cutout', download)
    original = audit.save_checkpoint
    calls = []
    def save(path, output):
        calls.append(True)
        if len(calls) == 3:
            raise OSError('disco lleno')
        original(path, output)
    monkeypatch.setattr(audit, 'save_checkpoint', save)
    with pytest.raises(audit.CheckpointError, match='persistir'):
        audit.run(path, sample_source())
    partial = json.loads(path.read_text(encoding='utf-8'))
    assert partial['cases'][0]['fits'] == []
    assert partial['cases'][0]['search']['status'] == 'ok'
