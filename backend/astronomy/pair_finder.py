"""Búsqueda acotada y reproducible de pares preliminares de IRSA."""
from __future__ import annotations

import argparse
import itertools
import json
import logging
import math
import threading
import time

from . import spherex_client, temporal

MAX_PAIRS = 3
log = logging.getLogger(__name__)
_search_lock = threading.BoundedSemaphore(1)


def rank_pairs(observations):
    """Solo pares con detector, colección, época y nivel de calibración conocidos."""
    groups = {}
    for item in observations:
        if (not item.get('id') or not item.get('band') or item.get('time_start_mjd') is None
                or item.get('calibration_level') != 2 or item.get('release') not in ('qr2', 'qr3')):
            continue
        groups.setdefault((item['release'], item['band']), []).append(item)
    candidates = []
    for key in sorted(groups):
        for a, b in itertools.combinations(groups[key], 2):
            if a['id'] == b['id'] or a['time_start_mjd'] == b['time_start_mjd']: continue
            # Similitud del centro no comprueba orientación ni longitud de onda.
            ca, cb = a.get('image_center') or {}, b.get('image_center') or {}
            values = [ca.get('ra'), ca.get('dec'), cb.get('ra'), cb.get('dec')]
            if all(isinstance(v, (int, float)) and math.isfinite(v) for v in values):
                r1,d1,r2,d2 = map(math.radians, values)
                cosine = math.sin(d1)*math.sin(d2)+math.cos(d1)*math.cos(d2)*math.cos(r1-r2)
                separation = math.degrees(math.acos(max(-1.,min(1.,cosine))))
            else:
                separation = float('inf')
            candidates.append((separation, abs(a['time_start_mjd']-b['time_start_mjd']), a, b))
    return [(a,b) for _,_,a,b in sorted(candidates, key=lambda x: (x[0], x[1], x[2]['id'], x[3]['id']))]


def find_pairs(ra, dec, radius=.01, release='qr2', max_pairs=MAX_PAIRS):
    if not all(math.isfinite(x) for x in (ra, dec, radius)) or not (0 <= ra < 360 and -90 <= dec <= 90 and 0 < radius <= .25):
        raise ValueError('Coordenadas o radio inválidos')
    if release not in ('qr2','qr3') or not 1 <= max_pairs <= MAX_PAIRS:
        raise ValueError('Colección o límite inválido')
    if not _search_lock.acquire(blocking=False): raise RuntimeError('Ya hay una búsqueda de pares en curso')
    started = time.monotonic()
    try:
        observations = spherex_client.search(ra, dec, radius, release)
        ranked = rank_pairs(observations)
        evaluated = []
        for a, b in ranked[:max_pairs]:
            t = time.monotonic()
            entry = {'a': temporal.metadata(a), 'b': temporal.metadata(b), 'detector': a['band'], 'release': release}
            try:
                result = temporal.compare(a,b)
                entry.update({'status': 'aceptado_exploratorio' if result['compatible'] else 'rechazado',
                              'reasons': result['reasons'], 'coverage_fraction': result['coverage_fraction'],
                              'spectral_match_fraction': result['spectral_match_fraction'], 'spectral_status': result['spectral_status'],
                              'calibration_a': result['fits_a']['calibration'], 'calibration_b': result['fits_b']['calibration'],
                              'result_id': result['id']})
            except (spherex_client.IrsaError, ValueError, RuntimeError) as exc:
                log.warning('Par %s / %s no evaluado: %s', a['id'], b['id'], exc)
                entry.update({'status':'error', 'reasons':[str(exc)], 'coverage_fraction':None,
                              'spectral_match_fraction':None, 'spectral_status':'no_evaluada'})
            entry['elapsed_seconds'] = round(time.monotonic()-t, 3)
            log.info('Par %s / %s: %s en %.3fs', a['id'], b['id'], entry['status'], entry['elapsed_seconds'])
            evaluated.append(entry)
        return {'mode':'real', 'query':{'ra':ra,'dec':dec,'radius':radius,'release':release},
                'observations_count':len(observations), 'candidates_prefiltered':len(ranked),
                'evaluated_count':len(evaluated), 'accepted_count':sum(x['status']=='aceptado_exploratorio' for x in evaluated),
                'max_pairs':max_pairs, 'elapsed_seconds':round(time.monotonic()-started,3), 'pairs':evaluated,
                'notice':'Búsqueda limitada; el orden SIA y el límite de 100 filas pueden omitir pares. No demuestra movimiento.'}
    finally:
        _search_lock.release()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ra',type=float);parser.add_argument('dec',type=float)
    parser.add_argument('--radius',type=float,default=.01);parser.add_argument('--release',choices=['qr2','qr3'],default='qr2')
    parser.add_argument('--max-pairs',type=int,choices=range(1,MAX_PAIRS+1),default=MAX_PAIRS)
    args=parser.parse_args()
    print(json.dumps(find_pairs(args.ra,args.dec,args.radius,args.release,args.max_pairs),ensure_ascii=False,indent=2))


if __name__ == '__main__': main()
