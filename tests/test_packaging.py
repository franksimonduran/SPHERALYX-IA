import hashlib
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile


def test_package_reproducible_and_manifest(tmp_path):
    root = Path(__file__).resolve().parents[1]
    first, second = tmp_path / 'a.zip', tmp_path / 'b.zip'
    for output in (first, second):
        subprocess.run([sys.executable, str(root / 'tools/package_release.py'), '--output', str(output)],
                       cwd=root, check=True, capture_output=True)
    assert first.read_bytes() == second.read_bytes()
    with ZipFile(first) as archive:
        names = archive.namelist()
        assert 'VERSION' in names and 'frontend/assets/logo.png' in names
        assert 'frontend/assets/lucide/LICENSE.txt' in names
        assert all(f'frontend/assets/lucide/{icon}.svg' in names for icon in ('house','telescope','clock-3','orbit','flask-conical','book-open'))
        assert not any(part in names for part in ('.env', '.venv/', '.venv312/'))
        assert all('__pycache__' not in name and '.pytest_cache' not in name for name in names)
        for line in archive.read('MANIFEST.sha256').decode().splitlines():
            digest, name = line.split('  ', 1)
            assert hashlib.sha256(archive.read(name)).hexdigest() == digest
        assert len(archive.read('MANIFEST.sha256').decode().splitlines()) == len(names)-1
    result = subprocess.run([sys.executable, str(root / 'tools/package_release.py'), '--output', str(first)],
                            cwd=root, capture_output=True)
    assert result.returncode != 0
