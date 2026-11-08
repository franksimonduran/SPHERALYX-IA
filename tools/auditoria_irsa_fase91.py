"""Consulta acotada IRSA fase 9.1. Solo red real; no guarda ni fabrica imágenes."""
from __future__ import annotations

import argparse
import hashlib
import json
import warnings
from datetime import datetime, timezone
from pathlib import Path

from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.time import Time
from erfa import ErfaWarning

from backend.astronomy import fits_processor, pair_finder, spherex_client, temporal

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ROOT / 'data/samples/campos-spherex-fase91.json'


def center(field, target_year):
    kwargs = {'ra': field['ra_hms'], 'dec': field['dec_dms'],
              'unit': (u.hourangle, u.deg), 'frame': 'icrs'}
    if field['pm_ra_cosdec_masyr'] is None or field['pm_dec_masyr'] is None:
        c = SkyCoord(**kwargs)
    else:
        c = SkyCoord(**kwargs, pm_ra_cosdec=field['pm_ra_cosdec_masyr']*u.mas/u.yr,
                     pm_dec=field['pm_dec_masyr']*u.mas/u.yr,
                     obstime=Time(field['epoch_jyear'], format='jyear'))
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', ErfaWarning)
            c = c.apply_space_motion(new_obstime=Time(target_year, format='jyear'))
    return round(c.ra.deg, 8), round(c.dec.deg, 8)


def summarize(item):
    return {key: item.get(key) for key in ('observation_id', 'publisher_id', 'reference_url',
            'release', 'band', 'detector', 'wavelength_min_m', 'wavelength_max_m',
            'time_start_mjd', 'observation_time_utc', 'calibration_level',
            'coverage_region', 'image_center', 'search_center')}


def inspect_field(field, release, target_year, radius):
    ra, dec = center(field, target_year)
    result = {'field': field['name'], 'query': {'ra': ra, 'dec': dec, 'radius_deg': radius,
              'release': release}, 'source': field['reference'], 'search': None,
              'fits': [], 'pair': None}
    try:
        observations = spherex_client.search(ra, dec, radius, release)
    except (spherex_client.IrsaError, ValueError) as exc:
        result['search'] = {'status': 'error', 'error': str(exc)}
        return result
    ranked = pair_finder.rank_pairs(observations)
    result['search'] = {'status': 'ok', 'count': len(observations),
                        'possibly_truncated': len(observations) >= spherex_client.MAX_RESULTS,
                        'prefiltered_pairs': len(ranked),
                        'observations': [summarize(o) for o in observations]}
    # Una sola pareja por campo/colección: no es un muestreo exhaustivo.
    chosen = list(ranked[0]) if ranked else observations[:2]
    chosen.sort(key=lambda o: o.get('time_start_mjd') if o.get('time_start_mjd') is not None else float('inf'))
    for item in chosen:
        record = {'observation': summarize(item), 'status': 'error'}
        try:
            raw = fits_processor.download_cutout(item)
            png, info = fits_processor.process_fits(raw)
            record.update(status='ok', bytes=len(raw), fits_sha256=hashlib.sha256(raw).hexdigest(),
                          png_sha256=hashlib.sha256(png).hexdigest(), preview=info)
        except (spherex_client.IrsaError, ValueError, OSError) as exc:
            record['error'] = str(exc)
        result['fits'].append(record)
    if ranked and len(chosen) == 2 and all(r['status'] == 'ok' for r in result['fits']):
        try:
            comparison = temporal.compare(*chosen)
            result['pair'] = {key: comparison[key] for key in ('compatible', 'reasons',
                'coverage_fraction', 'spectral_match_fraction', 'spectral_status', 'fits_a', 'fits_b')}
            result['pair']['available_views'] = sorted(comparison['views'])
            result['pair']['status'] = 'evaluado'
        except (spherex_client.IrsaError, ValueError, RuntimeError) as exc:
            result['pair'] = {'status': 'error', 'error': str(exc)}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path, help='Archivo JSON nuevo; no se sobrescribe')
    args = parser.parse_args()
    source = json.loads(FIELDS.read_text(encoding='utf-8'))
    output = {'started_utc': datetime.now(timezone.utc).isoformat(), 'cases': [],
              'notice': source['note'], 'target_epoch_jyear': source['target_epoch_jyear']}
    # Reservar el archivo antes de hacer red, para no sobrescribir trabajo previo.
    with args.output.open('x', encoding='utf-8') as stream:
        for field in source['fields']:
            for release in ('qr2', 'qr3'):
                print(f"Consultando {field['name']} {release}...", flush=True)
                output['cases'].append(inspect_field(field, release, source['target_epoch_jyear'], source['radius_deg']))
        output['finished_utc'] = datetime.now(timezone.utc).isoformat()
        json.dump(output, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write('\n')


if __name__ == '__main__':
    main()
