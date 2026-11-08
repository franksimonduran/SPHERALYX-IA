"""Inspección de relaciones DataLink de IRSA, sin inferir calibraciones.

El endpoint es fijo; nunca se siguen automáticamente URLs o service_def de la
respuesta. Los enlaces son indicios, no demuestran por sí solos un UUID FITS.
"""
from __future__ import annotations

import re
from xml.etree import ElementTree as ET

import httpx

from .network import fetch_bytes
from .spherex_client import IrsaError

LINKS_URL = 'https://irsa.ipac.caltech.edu/datalink/links'
MAX_RESPONSE = 1024 * 1024
PUBLISHER_ID = re.compile(r'^ivo://irsa\.ipac/spherex_qr[23](?:_deep)?\?[A-Za-z0-9_]+/D[1-6]$')


def parse_links(raw: bytes, publisher_id: str) -> dict:
    if not PUBLISHER_ID.fullmatch(publisher_id):
        raise ValueError('Identificador de publicación SPHEREx no válido')
    if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('DTD no admitido')
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise ValueError('Respuesta DataLink no es VOTable XML válida') from exc
    namespace = '{http://www.ivoa.net/xml/VOTable/v1.3}'
    if root.tag != namespace + 'VOTABLE':
        raise ValueError('Formato DataLink no compatible')
    resources = root.findall(namespace + 'RESOURCE')
    results = [r for r in resources if r.get('type') == 'results']
    if len(results) != 1:
        raise ValueError('Se requiere un recurso DataLink de resultados')
    for info in results[0].findall(namespace + 'INFO'):
        if info.get('name') == 'QUERY_STATUS' and info.get('value') != 'OK':
            raise ValueError('IRSA indicó un error DataLink')
    table = results[0].find(namespace + 'TABLE')
    if table is None: raise ValueError('DataLink no devolvió una tabla')
    names = [field.get('name', '').lower() for field in table.findall(namespace + 'FIELD')]
    if not {'id', 'semantics', 'access_url', 'service_def', 'error_message'}.issubset(names) or len(set(names)) != len(names):
        raise ValueError('Columnas DataLink ausentes o duplicadas')
    tabledata = table.find(namespace + 'DATA/' + namespace + 'TABLEDATA')
    if tabledata is None:
        raise ValueError('Serialización DataLink no compatible')
    rows = []
    for tr in tabledata.findall(namespace + 'TR'):
        cells = [''.join(cell.itertext()).strip() for cell in tr.findall(namespace + 'TD')]
        if len(cells) != len(names): raise ValueError('Fila DataLink incompleta')
        row = dict(zip(names, cells))
        if row['id'] != publisher_id: raise ValueError('El identificador DataLink no coincide')
        rows.append({key: row.get(key) or None for key in ('id', 'semantics', 'access_url', 'service_def', 'error_message', 'description', 'content_type')})
    services = []
    for resource in resources:
        if resource.get('type') != 'meta' or resource.get('utype') != 'adhoc:service': continue
        params = {p.get('name'): p.get('value') for p in resource.findall(namespace + 'PARAM')}
        inputs = []
        for group in resource.findall(namespace + 'GROUP'):
            if group.get('name') == 'inputParams':
                inputs.extend({'name': p.get('name'), 'ref': p.get('ref'), 'value': p.get('value')} for p in group.findall(namespace + 'PARAM'))
        services.append({'id': resource.get('ID'), 'access_url': params.get('accessURL'),
                         'standard_id': params.get('standardID'), 'inputs': inputs})
    candidates = [r for r in rows if 'spectral_wcs' in ((r['description'] or '') + ' ' + (r['access_url'] or '')).lower()]
    return {'publisher_id': publisher_id, 'service_url': LINKS_URL, 'links': rows, 'services': services,
            'spectral_candidates': candidates, 'uuid_association_verified': False,
            'notice': 'La respuesta se ofrece como evidencia de consulta; no demuestra por sí sola la asociación con el UUID del FITS.'}


def inspect(publisher_id: str) -> dict:
    if not PUBLISHER_ID.fullmatch(publisher_id):
        raise ValueError('Identificador de publicación SPHEREx no válido')
    try:
        raw = fetch_bytes(LINKS_URL, {'ID': publisher_id}, MAX_RESPONSE, timeout=30)
        return parse_links(raw, publisher_id)
    except httpx.TimeoutException as exc:
        raise IrsaError('Tiempo de espera agotado en DataLink de IRSA') from exc
    except httpx.HTTPError as exc:
        raise IrsaError('No se pudo consultar DataLink de IRSA') from exc
    except ValueError as exc:
        raise IrsaError('Respuesta DataLink de IRSA no válida') from exc
