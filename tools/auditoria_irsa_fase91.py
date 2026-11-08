"""Consulta acotada IRSA fase 9.1. Solo red real; no guarda ni fabrica imágenes."""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import tempfile
import warnings
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.time import Time
from erfa import ErfaWarning

from backend.astronomy import fits_processor, pair_finder, spherex_client, temporal

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ROOT / 'data/samples/campos-spherex-fase91.json'


class CheckpointError(Exception):
    """Falló la persistencia durante una operación de red; no es un error FITS."""


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


def inspect_field(field, release, target_year, radius, existing=None, checkpoint=None):
    ra, dec = center(field, target_year)
    result = existing if existing is not None else {'field': field['name'], 'query': {'ra': ra, 'dec': dec, 'radius_deg': radius,
              'release': release}, 'source': field['reference'], 'search': None,
              'fits': [], 'pair': None, 'started_utc': utc_now(), 'finished_utc': None}
    save = checkpoint or (lambda: None)
    if result['search'] is None:
        try:
            observations = spherex_client.search(ra, dec, radius, release)
        except (spherex_client.IrsaError, ValueError) as exc:
            result['search'] = {'status': 'error', 'error': str(exc), 'finished_utc': utc_now()}
            result['finished_utc'] = utc_now()
            save()
            return result
        ranked = pair_finder.rank_pairs(observations)
        result['search'] = {'status': 'ok', 'count': len(observations),
                            'possibly_truncated': len(observations) >= spherex_client.MAX_RESULTS,
                            'truncation_notice': 'Menos de 100 productos normalizados no garantiza que SIA no truncara filas.',
                            'prefiltered_pairs': len(ranked), 'finished_utc': utc_now(),
                            'observations': [summarize(o) for o in observations]}
        # Guardar los datos necesarios para reanudar sin depender de IDs en memoria.
        chosen = list(ranked[0]) if ranked else observations[:2]
        chosen.sort(key=lambda o: o.get('time_start_mjd') if o.get('time_start_mjd') is not None else float('inf'))
        result['selected'] = chosen
        result['has_ranked_pair'] = bool(ranked)
        save()
    if result['search']['status'] != 'ok':
        return result
    chosen = result['selected']
    for item in chosen[len(result['fits']):]:
        record = {'observation': summarize(item), 'status': 'pending',
                  'download_status': 'pending', 'preview_status': 'not_attempted'}
        try:
            raw = fits_processor.download_cutout(item)
        except (spherex_client.IrsaError, ValueError, OSError) as exc:
            record.update(status='error', download_status='error', error=str(exc), finished_utc=utc_now())
            result['fits'].append(record)
            save()
            continue
        record.update(download_status='ok', bytes=len(raw), fits_sha256=hashlib.sha256(raw).hexdigest(),
                      preview_status='pending')
        # Los fallos de persistencia no son errores FITS y deben propagarse.
        result['fits'].append(record)
        save()
        try:
            png, info = fits_processor.process_fits(raw)
            record.update(status='ok', preview_status='ok', png_sha256=hashlib.sha256(png).hexdigest(), preview=info)
        except (spherex_client.IrsaError, ValueError, OSError) as exc:
            record.update(status='error', preview_status='error', error=str(exc))
        record['finished_utc'] = utc_now()
        save()
    # Una descarga guardada antes de una interrupción se reobtiene y verifica antes de procesar.
    for index, record in enumerate(result['fits']):
        if record['preview_status'] != 'pending':
            continue
        try:
            raw = fits_processor.download_cutout(chosen[index])
            if hashlib.sha256(raw).hexdigest() != record['fits_sha256']:
                raise ValueError('El recorte cambió desde la descarga registrada')
            png, info = fits_processor.process_fits(raw)
            record.update(status='ok', preview_status='ok', png_sha256=hashlib.sha256(png).hexdigest(), preview=info)
        except (spherex_client.IrsaError, ValueError, OSError) as exc:
            record.update(status='error', preview_status='error', error=str(exc))
        record['finished_utc'] = utc_now()
        save()
    if result['has_ranked_pair'] and len(chosen) == 2 and all(r['status'] == 'ok' for r in result['fits']) and result['pair'] is None:
        try:
            # Tras reanudar, verificar que la comparación use los mismos recortes.
            for item, record in zip(chosen, result['fits']):
                if hashlib.sha256(fits_processor.download_cutout(item)).hexdigest() != record['fits_sha256']:
                    raise ValueError('El recorte cambió desde la descarga registrada')
            comparison = temporal.compare(*chosen)
            result['pair'] = {key: comparison[key] for key in ('compatible', 'reasons',
                'coverage_fraction', 'spectral_match_fraction', 'spectral_status', 'fits_a', 'fits_b')}
            result['pair']['available_views'] = sorted(comparison['views'])
            result['pair']['status'] = 'evaluado'
        except (spherex_client.IrsaError, ValueError, RuntimeError) as exc:
            result['pair'] = {'status': 'error', 'error': str(exc)}
        result['pair']['finished_utc'] = utc_now()
        save()
    result['finished_utc'] = utc_now()
    save()
    return result


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def run_identity(source):
    manifest = os.environ.get('SPHERALYX_CALIBRATION_MANIFEST')
    calibration = None
    if manifest:
        path = Path(manifest).resolve(strict=True)
        calibration = {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    encoded = json.dumps(source, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    modules = ('tools/auditoria_irsa_fase91.py', 'backend/astronomy/spherex_client.py',
               'backend/astronomy/fits_processor.py', 'backend/astronomy/pair_finder.py',
               'backend/astronomy/temporal.py', 'backend/astronomy/calibration.py', 'backend/astronomy/network.py')
    implementation = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in modules}
    return {'fields_sha256': hashlib.sha256(encoded).hexdigest(), 'calibration_manifest': calibration,
            'implementation_sha256': implementation}


@contextmanager
def output_lock(path):
    """Bloqueo del SO: se libera incluso si el proceso termina bruscamente."""
    lock = path.with_name(path.name + '.lock')
    marker = b'SPHERALYX-IRSA-LOCK\n'
    try:
        with lock.open('xb') as initial:
            initial.write(marker)
    except FileExistsError:
        pass
    if lock.is_symlink():
        raise ValueError('El archivo de bloqueo no puede ser un enlace simbólico')
    with lock.open('r+b') as stream:
        stream.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise RuntimeError('Otra auditoría está usando este archivo') from exc
        try:
            if stream.read() != marker:
                raise ValueError('Archivo de bloqueo desconocido; no se modificará')
            yield
        finally:
            stream.seek(0)
            if os.name == 'nt':
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def save_checkpoint(path, output):
    """Escritura completa y reemplazo atómico dentro del mismo directorio."""
    data = (json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')
    fd, name = tempfile.mkstemp(prefix='.' + path.name + '.', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def run(output_path, source, resume=False):
    path = Path(output_path).absolute()
    identity = run_identity(source)
    with output_lock(path):
        if path.is_symlink():
            raise ValueError('La salida no puede ser un enlace simbólico')
        if resume:
            output = json.loads(path.read_text(encoding='utf-8'))
            if output.get('schema_version') != 1 or output.get('identity') != identity:
                raise ValueError('El archivo, los campos o el manifiesto no coinciden con esta ejecución')
            expected = [(f['name'], r) for f in source['fields'] for r in ('qr2', 'qr3')]
            actual = [(c['field'], c['query']['release']) for c in output['cases']]
            if actual != expected[:len(actual)] or len(actual) > len(expected):
                raise ValueError('Los casos guardados no coinciden con la configuración')
        else:
            output = {'schema_version': 1, 'identity': identity, 'started_utc': utc_now(),
                      'finished_utc': None, 'cases': [], 'notice': source['note'],
                      'target_epoch_jyear': source['target_epoch_jyear'], 'radius_deg': source['radius_deg']}
            # Reserva exclusiva: nunca sobrescribir un archivo existente.
            with path.open('x', encoding='utf-8') as stream:
                json.dump(output, stream, ensure_ascii=False, indent=2, allow_nan=False)
                stream.write('\n')
                stream.flush()
                os.fsync(stream.fileno())
        def save():
            save_checkpoint(path, output)
        for index, (field, release) in enumerate((f, r) for f in source['fields'] for r in ('qr2', 'qr3')):
            if index < len(output['cases']):
                case = output['cases'][index]
                if case.get('finished_utc'):
                    continue
            else:
                ra, dec = center(field, source['target_epoch_jyear'])
                case = {'field': field['name'], 'query': {'ra': ra, 'dec': dec,
                        'radius_deg': source['radius_deg'], 'release': release}, 'source': field['reference'],
                        'search': None, 'fits': [], 'pair': None, 'warnings': [],
                        'started_utc': utc_now(), 'finished_utc': None}
                output['cases'].append(case)
                save()
            print(f"Consultando {field['name']} {release}...", flush=True)
            class NetworkWarningHandler(logging.Handler):
                def emit(self, record):
                    case.setdefault('warnings', []).append({'timestamp_utc': utc_now(), 'message': record.getMessage()})
                    try:
                        save()
                    except Exception as exc:
                        raise CheckpointError('No se pudo persistir el aviso de red') from exc
            logger = logging.getLogger('backend.astronomy.network')
            handler = NetworkWarningHandler(level=logging.WARNING)
            logger.addHandler(handler)
            try:
                inspect_field(field, release, source['target_epoch_jyear'], source['radius_deg'], case, save)
            finally:
                logger.removeHandler(handler)
        if not output.get('finished_utc'):
            output['finished_utc'] = utc_now()
            save()
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path, help='Archivo JSON nuevo; no se sobrescribe')
    parser.add_argument('--resume', action='store_true', help='Reanudar únicamente el archivo parcial indicado')
    args = parser.parse_args()
    source = json.loads(FIELDS.read_text(encoding='utf-8'))
    run(args.output, source, resume=args.resume)


if __name__ == '__main__':
    main()
