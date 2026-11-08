# Informe QA de integración

## Alcance y estado

Ejecución local Windows, 8 de noviembre de 2026. Rama `main`; HEAD `3692bfa05c2bab81830af5d1b47ccd9fe4b4528c` (`Document real SPHEREx availability audit`). El árbol tiene numerosas modificaciones y archivos sin seguimiento previos; los resultados corresponden a ese árbol de trabajo, **no solo al commit**. `git diff --cached --name-only` estaba vacío: no había archivos preparados. No se modificaron algoritmos ni se prepararon archivos para commit.

Entorno existente: CPython 3.12.0 (`.venv312`), Node v26.13.0, FastAPI 0.162.2, Uvicorn 0.54.0, NumPy 2.5.4, Astropy 7.2.3 y Photutils 2.3.0. Python 3.12 es la versión recomendada por el proyecto. No se realizó una instalación limpia ni se verificó exhaustivamente la reproducibilidad del lock.

## Aprobadas

- `.\.venv312\Scripts\python -m pytest tests -q`: **89 aprobadas, 4 omitidas**, una advertencia de deprecación Starlette/TestClient con httpx. Repetición con `-rs`: mismo resultado.
- `.\.venv312\Scripts\python -m pip check`: `No broken requirements found`.
- `node frontend/tests/audit.mjs`: aprobada en Chrome headless con respuestas de API **simuladas**. Cubre navegación y controles, 375/430/768/1024/1440 px, menú y foco, selección, búsqueda vacía, error y cancelación, estados y bloqueos temporales, modo offline, separación REAL/sintética y laboratorios. No es prueba E2E del navegador contra el backend local.
- `python -m uvicorn backend.main:app --host 127.0.0.1 --port 18765`: `/health` 200 (`upstream_checked: false`), `/docs` 200 y `/openapi.json` 200. Parámetro RA inválido: 422; preview de ID desconocido: 404; identificadores temporales inválidos: 422.
- Contra ese backend local: `/api/experimental/motion` 200; `/api/experimental/validation` 200 con dos escenarios; `/api/experimental/classification` 200 con tres imágenes y cinco trayectorias. Son experimentos sintéticos, no observaciones.
- Servidor separado con `SPHERALYX_OFFLINE=1`: `/health` indica offline; búsqueda, preview y comparación responden 503; experimento sintético responde 200. La auditoría frontend comprueba que la casilla offline no inicia solicitudes de observaciones ni temporales; esto no es captura de tráfico a nivel de red.
- IRSA en vivo: QR2 RA 83.8221°, Dec −5.3911°, radio 0.01° devolvió 200 y 100 productos (límite; posible truncamiento); primer recorte devolvió PNG 200, 2.220 bytes y `X-Preview-Scientific: false`. Otra búsqueda QR3 devolvió 100 productos. QR3 RA 133.75989006°, Dec −7.24223708°, radio 0.1° devolvió 200 y cero productos normalizados. Cero no implica ausencia absoluta de datos.
- Revisión básica de seguridad: validación de rangos y de IDs; URL de FITS restringida al host/ruta IRSA, descargas limitadas y sin seguir redirecciones; metadatos externos mostrados con `textContent`; el catálogo interpolado en HTML contiene datos locales. Son observaciones puntuales, no una auditoría de seguridad completa.
- Índice Git vacío. Entre los 70 archivos rastreados no aparecieron nombres de entornos, credenciales habituales ni archivos FITS/ZIP/llaves; búsqueda heurística limitada de patrones de secretos en contenido rastreado: cero coincidencias. Ningún archivo rastreado o no ignorado sin seguimiento superó 5 MiB. No se inspeccionaron todos los archivos ignorados ni se garantiza ausencia de secretos.
- `git diff --check`: sin errores de whitespace; Git emitió avisos de conversión LF/CRLF.

## Fallida / bloqueo para entrega

**Seguimiento posterior:** véase [diagnóstico temporal](diagnostico-timeout-temporal.md). Una nueva prueba real acotada completó con otro par posiblemente distinto y la calibración bloqueada; no identifica la causa del timeout original ni demuestra un límite duro.

- Una comparación temporal real QR2 en RA 269.44626788°, Dec +4.76820441°, radio 0.1°, con dos productos de igual banda y épocas distintas, **agotó los 120 s del cliente HTTP** sin recibir respuesta. No se determinó si el retraso ocurrió en IRSA, descarga o procesamiento. Por tanto no quedó validado el resultado ni el comportamiento completo de ese par real en esta ejecución; debe investigarse y repetirse antes de depender de la comparación en vivo para la entrega. Cancelar una petición del cliente no demuestra que se detenga el trabajo del servidor. Las pruebas simuladas y unitarias sí verifican los bloqueos existentes, pero no sustituyen esa prueba en vivo.

## Omitidas

Cuatro pruebas opcionales dependientes de IRSA: `tests/test_backend.py:106`, `tests/test_datalink.py:68`, `tests/test_pair_finder.py:115` y `tests/test_temporal.py:107`. Las consultas manuales indicadas arriba no equivalen a ejecutar esas cuatro pruebas.

## No ejecutadas

- Instalación desde cero del lock y pruebas en otras versiones de Python o sistemas operativos.
- Navegador conectado al backend local y flujo temporal real completo, incluidos prueba de cancelación real y respuesta compatible real con calibración verificada.
- Auditoría formal de seguridad, rastreo de todos los archivos ignorados, inspección exhaustiva de dependencias o búsqueda integral de secretos.
- Auditoría formal WCAG, lectores de pantalla y dispositivos físicos; véase `auditoria-frontend-accesibilidad.md`.

## Regresiones corregidas

Ninguna durante esta auditoría. No se ocultaron fallos ni se redujo cobertura. La advertencia de TestClient y el timeout de comparación permanecen pendientes de investigación.
