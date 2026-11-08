# Instalación desde cero — Windows y Python 3.12

**Candidata `0.3.0-rc1`**, prototipo local. Necesitas Windows x64, Python 3.12, PowerShell, acceso a Internet para descargar paquetes y un navegador moderno. Para la auditoría automatizada también se necesita Node con `WebSocket` nativo y Chrome o Edge. El recorrido offline posterior no necesita Internet, pero sí el servidor Python local.

Desde la raíz del proyecto:

```powershell
py -3.12 --version
py -3.12 -m venv .venv312
.\.venv312\Scripts\python.exe -m pip install -r backend/requirements-lock-win-py312.txt
.\.venv312\Scripts\python.exe -m pip check
.\.venv312\Scripts\python.exe -m pytest tests -q
node frontend/tests/audit.mjs
```

No hace falta activar el entorno. Si el ejecutable del navegador no está en una ruta habitual, define `$env:CHROME_PATH` con su ruta antes de ejecutar la auditoría. El archivo de versiones es una instantánea probada en Windows x64, CPython 3.12.0; incluye paquetes adicionales y no contiene hashes. No garantiza instalación en otras plataformas o disponibilidad futura de paquetes.

## Arranque offline

```powershell
$env:SPHERALYX_OFFLINE='1'
.\.venv312\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Abre <http://127.0.0.1:8000/> y marca **Modo demostración offline**. No abras el HTML mediante `file://`. La variable bloquea endpoints reales en el servidor; la casilla evita consultas reales desde esa interfaz. Para volver a consultas IRSA detén el servidor, ejecuta `Remove-Item Env:SPHERALYX_OFFLINE` y reinícialo; desmarca también la casilla. IRSA requiere conexión y puede no estar disponible.

Si el puerto está ocupado, usa `--port 8001` y abre `http://127.0.0.1:8001/`. Detén el servidor con Ctrl+C. Las rutas `/docs` y `/health` ofrecen el esquema API y estado local; `upstream_checked: false` no prueba disponibilidad de IRSA.
