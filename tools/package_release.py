"""Genera un ZIP fuente reproducible mediante lista permitida, sin borrar archivos."""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
VERSION = '0.3.0-rc1'
PATTERNS = (
    'README.md', 'VERSION', '.gitignore',
    'backend/*.py', 'backend/requirements*.txt', 'backend/astronomy/*.py',
    'frontend/index.html', 'frontend/css/*.css', 'frontend/js/*.js',
    'frontend/tests/*.mjs', 'frontend/assets/logo.png',
    'tests/*.py', 'docs/*.md', 'data/samples/astromotion-seed42.json',
    'data/samples/campos-spherex-fase91.json',
    'tools/package_release.py', 'tools/auditoria_irsa_fase91.py',
)


def files_for_release():
    found = set()
    for pattern in PATTERNS:
        for path in ROOT.glob(pattern):
            if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(ROOT):
                raise ValueError(f'Archivo no permitido: {path}')
            found.add(path.relative_to(ROOT).as_posix())
    required = {'README.md', 'VERSION', 'backend/main.py', 'frontend/index.html',
                'frontend/assets/logo.png', 'data/samples/astromotion-seed42.json'}
    if not required <= found:
        raise ValueError('Faltan archivos requeridos')
    if (ROOT / 'VERSION').read_text(encoding='utf-8').strip() != VERSION:
        raise ValueError('La versión no coincide con la versión del empaquetador')
    return sorted(found)


def entry(path, content):
    info = ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    return info, content


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist' / f'SPHERALYX-AI-{VERSION}.zip')
    args = parser.parse_args()
    paths = files_for_release()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # x evita sobrescribir cualquier archivo existente, incluso del usuario.
    with ZipFile(args.output, mode='x', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        hashes = []
        for name in paths:
            content = (ROOT / name).read_bytes()
            hashes.append(f'{hashlib.sha256(content).hexdigest()}  {name}')
            archive.writestr(*entry(name, content), compresslevel=9)
        archive.writestr(*entry('MANIFEST.sha256', ('\n'.join(hashes)+'\n').encode('utf-8')), compresslevel=9)
    print(f'ZIP: {args.output.resolve()}')
    print(f'Archivos: {len(paths)} más MANIFEST.sha256')
    print(f'SHA-256: {hashlib.sha256(args.output.read_bytes()).hexdigest()}')


if __name__ == '__main__':
    main()
