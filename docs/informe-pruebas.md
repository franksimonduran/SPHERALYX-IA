# Informe de pruebas — candidata 0.3.0-rc1

## Fase 8.1 — revisión de frontend y empaquetado

- Windows y Python 3.12 en `.venv312`: `pytest tests -q` produjo **74 aprobadas, 4 omitidas y 1 advertencia**. Las cuatro omisiones opcionales de IRSA se identifican más abajo; no se ejecutaron en esta revisión.
- `pip check`: sin incompatibilidades declaradas. Se inició Uvicorn en `127.0.0.1:18767`: `/health` y `/` respondieron 200; `upstream_checked: false` no comprueba IRSA.
- `node frontend/tests/audit.mjs`: aprobada con respuestas API simuladas. Comprueba inicialización y ocho opciones, visibilidad de la imagen de marca y su alternativa, navegación, desbordamiento en 375/768/1024/1440, estados de red y separación offline. No es una medición completa de contraste ni una revisión visual manual.
- El fallo del selector comunicado por una auditoría independiente no se reprodujo. La prueba ahora espera navegación completa y opciones inicializadas, y comunica URL, estado y excepciones si agota el tiempo. El criterio de ocho opciones permanece.
- `test_wcs_wave_alone_cannot_authorize_difference` comprueba con datos controlados que sin calibración verificada no aparece la diferencia; no se han modificado algoritmos científicos ni probado todos los datos reales posibles.
- `frontend/assets/logo.png` cambió externamente durante la revisión: inicialmente era un marcador de 1×1; el archivo actual es una imagen de marca 1254×1254 cuya autenticidad y permisos requieren confirmación. La prueba comprueba la visibilidad según dimensiones y simula carga y error; no valida su autoría ni apariencia en todos los dispositivos.
- Permanecen pendientes revisión manual del contraste, tipografía, legibilidad y accesibilidad, prueba offline con red físicamente desconectada, y confirmación de licencias y atribuciones.

## Ejecución local, 8 de noviembre de 2026

Entorno: Windows, CPython 3.12.0, `.venv312`, Node y navegador headless. No se realizó una auditoría formal de seguridad ni de accesibilidad.

| Comprobación | Resultado observado |
| --- | --- |
| `.venv312\Scripts\python -m pytest tests -q` | **74 aprobadas, 4 omitidas, 1 advertencia** tras añadir la prueba del paquete. Las omitidas requieren servicios IRSA y variables de entorno opcionales. |
| `.venv312\Scripts\python -m pip check` | Sin requisitos incompatibles detectados. |
| Suite con las cuatro variables `SPHERALYX_LIVE_*` habilitadas | **76 aprobadas, 1 advertencia**, 87,65 s. Se inició antes de agregar la prueba de coincidencia de versión; por eso contiene una prueba menos que la suite local posterior. |
| Nueva ejecución con las cuatro variables `SPHERALYX_LIVE_*` habilitadas | **77 aprobadas, 1 advertencia**, 56,74 s. Se ejecutó antes de añadir la prueba del empaquetador, que se aprobó después en la suite local. No demuestra una detección científica real. |
| Suite en el entorno limpio instalado en fase 7 | **73 aprobadas, 4 omitidas, 1 advertencia** tras actualizar el proyecto; no se reinstalaron los paquetes en esta fase. |
| `node frontend/tests/audit.mjs` | Aprobada: navegación, anchuras 375/768/1024/1440, DEMO, experimentos y flujos REAL simulados, errores, respuestas tardías y modo offline. |
| Comparación `VERSION` / OpenAPI | Aprobada dentro de pytest. |
| Referencia sintética semilla 42 | Recalculada y comparada dentro de pytest. |
| Enlaces Markdown relativos | 15 archivos examinados; ningún destino local faltante según comprobación de rutas. No comprueba anclas. |

La advertencia `StarletteDeprecationWarning` procede de TestClient usando `httpx`; permanece pendiente de resolver con una actualización de dependencias evaluada. Las pruebas frontend usan respuestas API controladas y no prueban disponibilidad de IRSA. Las pruebas en vivo consultaron búsqueda y recorte, comparación exploratoria, búsqueda acotada de pares y DataLink; su aprobación no certifica un par científicamente válido ni una detección de movimiento. En la fase anterior se instaló el lock en un entorno limpio Windows/Python 3.12; no se repitió aquí esa instalación desde cero.

Las cuatro pruebas que se omiten por defecto son `test_live_irsa` (`SPHERALYX_LIVE_TEST`), `test_live_pair_irsa` (`SPHERALYX_LIVE_TEMPORAL`), `test_live_pair_search` (`SPHERALYX_LIVE_PAIRS`) y `test_real_irsa_datalink` (`SPHERALYX_LIVE_DATALINK`). Para activarlas en PowerShell define cada variable con valor `1` y ejecuta `python -m pytest tests -q`; requieren red y dependen de la disponibilidad de IRSA. Se ejecutaron en la prueba en vivo indicada arriba.

## Revisión de enlaces y contenido

Las páginas principales de IRSA sobre SIA2, Quick Release, recortes, espectrofotometría y productos de datos respondieron durante esta revisión. No se verificaron automáticamente todos los enlaces externos ni se garantiza disponibilidad futura. Los documentos de calibración conservan las limitaciones y fuentes específicas.

La búsqueda por nombres de archivos y patrones comunes de claves no encontró coincidencias en los archivos de proyecto examinados, excluidos entornos virtuales y cachés. Esto **no demuestra ausencia de secretos**; no se ha inspeccionado historial Git porque el directorio no es un repositorio Git. Existen `.venv`, `.venv312`, `__pycache__` y `.pytest_cache` locales: no se eliminaron y deben excluirse de la distribución. El filtro no es una revisión de archivos binarios ni de todo posible secreto.

## Pendiente de validación manual

- Probar el recorrido offline con la red externa físicamente desconectada en el equipo definitivo.
- Revisar contraste, lector de pantalla, navegación y presentación en dispositivos previstos.
- Confirmar reproducción y resultados de IRSA en vivo en el momento de la presentación, si se van a utilizar.
- Revisar credenciales, archivos binarios, licencias y atribuciones antes de publicar; grabar y cronometrar el vídeo. Ver `docs/licencias-atribuciones.md`.
- El identificador `0.3.0-rc1` es una candidata local: no hay tag Git ni artefacto publicado.
