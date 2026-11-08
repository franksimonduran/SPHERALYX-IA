import json
from pathlib import Path

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
    assert result['search'] == {'status': 'error', 'error': 'IRSA no disponible'}
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
