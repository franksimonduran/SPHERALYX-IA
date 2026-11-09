# SPHERALYX AI

**Versión candidata de entrega: `0.3.0-rc1`** · Prototipo independiente para demostración local · No apto para producción pública.

**Licencia:** el propietario autorizó la publicación del código, la documentación y el logotipo, pero todavía no ha elegido una licencia. Las atribuciones de terceros requieren revisión; véase [licencias y atribuciones](docs/licencias-atribuciones.md).

SPHERALYX AI combina una interfaz educativa con consultas opcionales a NASA/IPAC IRSA y experimentos astronómicos sintéticos reproducibles. **No ha detectado Planet X ni validado movimiento en imágenes reales de SPHEREx.** No es un producto oficial de NASA y no incorpora una red neuronal entrenada.

| Procedencia | Qué se muestra | Qué no significa |
| --- | --- | --- |
| **DEMO SIMULADA** | Campo, animación y candidatos ilustrativos. | No son observaciones. |
| **OBSERVACIÓN REAL** | Consulta opcional a IRSA y PNG visual de un recorte FITS. | Una vista o residuo no es un descubrimiento. |
| **EXPERIMENTO SINTÉTICO** | FITS generados, detección, asociación y clasificación experimental. | Las métricas no validan el desempeño sobre SPHEREx. |

La identificación `0.3.0-rc1` corresponde a una candidata de demostración. Requiere las comprobaciones manuales de [entrega](docs/lista-verificacion.md).

### Documentos de entrega

- [Instalación Windows/Python 3.12](docs/instalacion.md) · [Demostración offline](docs/guia-demostracion.md) · [Instrucciones para jueces](docs/instrucciones-jueces.md)
- [Ficha de funcionalidades y resultados](docs/ficha-resultados.md) · [Limitaciones](docs/limitaciones-entrega.md)
- [Presentación de siete diapositivas](docs/presentacion.md) · [Guion de vídeo](docs/guion-video.md) · [Lista de verificación](docs/lista-verificacion.md)
- [Informe de pruebas](docs/informe-pruebas.md)
- [Paquete e inventario](docs/paquete-entrega.md) · [Licencias y atribuciones pendientes](docs/licencias-atribuciones.md)
- [Fase 9.1: metodología y visor temporal](docs/fase91-metodologia.md) · [Disponibilidad SPHEREx](docs/fase91-disponibilidad.md)
- [Lista cronológica REAL y filtros](docs/lista-cronologica-real.md)
- [Interfaz Cosmic Explorer y límites visuales](docs/cosmic-explorer-interfaz.md)
- [Preparación de entrega y despliegue local](docs/entrega-space-apps-2026.md) · [QA de integración y bloqueo temporal](docs/informe-qa-integracion.md) · [Borrador de notas de release](docs/notas-release-borrador.md)

AstroMotion incluye además un **EXPERIMENTO SINTÉTICO** independiente: genera FITS artificiales y mide asociaciones y desplazamientos con un detector tradicional. No son observaciones SPHEREx ni descubrimientos NASA. Véase [metodología y limitaciones](docs/astromotion-sintetico.md).

El **Validation Lab** ejecuta lotes sintéticos reproducibles y compara dos estrategias de asociación; sus métricas no representan observaciones reales. Ver [metodología, API y límites](docs/validation-lab.md).

El laboratorio también incluye una [clasificación multiepoca sintética](docs/clasificacion-sintetica.md), con registro por referencias artificiales, trayectorias y matriz de confusión. No confirma movimiento real.

Prototipo independiente para NASA Space Apps Challenge 2026, desafío Planet X and SPHEREx. El frontend combina una **DEMO local simulada** con una búsqueda **REAL** de imágenes de SPHEREx en NASA/IPAC IRSA. No constituye un producto oficial de NASA y no realiza descubrimientos científicos ni entrenamiento de IA.

## Requisitos e instalación

Se recomienda Python 3.12. Desde la raíz del proyecto, en Windows:

```powershell
py -3.12 -m venv .venv312
.\.venv312\Scripts\Activate.ps1
python -m pip install -r backend/requirements-lock-win-py312.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

En macOS/Linux: `python3.12 -m venv .venv312`, `source .venv312/bin/activate`, `python -m pip install -r backend/requirements.txt` y el mismo comando `uvicorn`. Esa resolución no está fijada ni verificada en esta auditoría. La aplicación sirve el frontend sin compilación ni npm en <http://127.0.0.1:8000/>; no abras el HTML directamente con `file://`. Documentación interactiva de la API: <http://127.0.0.1:8000/docs>.

Las dependencias se instalan exclusivamente en el entorno virtual. `backend/requirements-lock-win-py312.txt` es una instantánea de versiones verificadas en Windows x64 y CPython 3.12.0; incluye transitivas y paquetes adicionales, pero no hashes. Para otra plataforma usa `backend/requirements.txt`, resuelve y verifica sus propias versiones. El lock no garantiza bit a bit resultados entre arquitecturas ni disponibilidad futura de paquetes.

### Demostración sin red

En la interfaz marca **Modo demostración offline**. Esto evita que la interfaz lance consultas reales; la DEMO y los experimentos sintéticos siguen funcionando con el servidor local. Para bloquear además los endpoints reales a nivel del servidor, configura antes de arrancarlo:

```powershell
$env:SPHERALYX_OFFLINE='1'
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

En macOS/Linux usa `SPHERALYX_OFFLINE=1 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`. El servidor devuelve 503 para `/api/observations` y `/api/temporal` en ese modo. La casilla del navegador no cambia la configuración del servidor, y cancelar una solicitud no detiene necesariamente trabajo ya iniciado. Para volver al modo real, elimina la variable y reinicia. La pantalla incluye un **registro documental archivado** de una consulta real previa; no se conserva su FITS ni su PNG. Consulta el [guion](docs/guia-demostracion.md).

### CORS

El frontend servido por FastAPI usa el mismo origen y no necesita CORS. Por defecto se permiten `http://localhost:8000` y `http://127.0.0.1:8000`. Para otros orígenes autorizados configura antes de arrancar, por ejemplo:

```powershell
$env:SPHERALYX_CORS_ORIGINS='http://localhost:5500,http://127.0.0.1:5500'
```

Si se sirve el frontend desde otro puerto, configure un proxy inverso para dirigir `/api` a FastAPI; el cliente usa rutas relativas. No habilites orígenes abiertos sin evaluar el contexto de despliegue.

## Uso y API

Introduce RA y Dec en el explorador y utiliza **Buscar en IRSA** en el panel REAL. Selecciona QR2 o QR3, el radio en grados y una observación de la lista. Un resultado puede intersectar la región sin contener su centro: en ese caso el recorte puede fallar o estar vacío. La interfaz informa del error sin reemplazarlo con datos de demostración.

| Endpoint | Uso |
| --- | --- |
| `GET /health` | Estado local; `upstream_checked: false` no garantiza que IRSA esté disponible. |
| `GET /api/observations?ra=156.09328159&dec=-41.64466331&radius=0.01&release=qr2` | Consulta SIA2 real: RA `[0,360)`, Dec `[-90,90]`, radio `(0,0.25]` grados; release `qr2` o `qr3`. Máximo 100 filas. |
| `GET /api/observations/{id}` | Metadatos y procedencia de un resultado de la búsqueda. |
| `GET /api/observations/{id}/preview` | PNG del recorte; `X-Invalid-Pixels`, `X-Flagged-Pixels` y `X-Preview-Scientific: false`. |
| `GET /api/gaia/sources?ra=83.8221&dec=-5.3911&radius=0.05&limit=120` | Consulta TAP/ADQL fija sobre `gaiadr3.gaia_source` (ESA Gaia Archive, época `J2016.0`). Conserva `source_id` como cadena y valores ausentes como `null`. |
| `GET /api/wise/sources?ra=83.8221&dec=-5.3911&radius=0.05&limit=120` | Consulta TAP/ADQL fija sobre `allwise_p3as_psd` (NASA/IPAC IRSA TAP). Etiqueta proximidades como asociaciones candidatas no confirmadas. |

**Coordenadas de catálogo y épocas:** el campo `ref_epoch` de Gaia es `null` si el registro recibido no incluye una época; la referencia general Gaia DR3 es J2016.0, pero no se completa automáticamente un dato ausente. En AllWISE, `reference_epoch` es `null`: J2000 describe un sistema de referencia de coordenadas, **no una fecha individual de adquisición**, ya que el catálogo agrupa exposiciones. La esfera de Cosmic Explorer es una proyección Canvas 2D de direcciones ICRS, no una reconstrucción espacial ni una escena Three.js/WebGL nativa. Las capas solo se dibujan si RA/Dec/radio siguen coincidiendo con su consulta; en caso contrario se marca **CONSULTA ANTERIOR**. Consultar el [alcance científico y visual](docs/cosmic-explorer-3d.md).

Ejemplo:

```sh
curl "http://127.0.0.1:8000/api/observations?ra=156.09328159&dec=-41.64466331&radius=0.01&release=qr2"
```

Los IDs opacos identifican producto y centro de consulta; se almacenan en memoria hasta 30 minutos y dejan de funcionar al reiniciar o al expirar. Repite la búsqueda si recibes 404. En despliegues con varios procesos se necesita un almacén compartido o afinidad de sesión. Las vistas previas se almacenan en memoria hasta 30 minutos (máximo 32); las descargas se limitan a 32 MiB, los resultados SIA a 4 MiB. Se aceptan solo URLs de productos SPHEREx en `https://irsa.ipac.caltech.edu/ibe/data/spherex/`, sin redirecciones ni URLs proporcionadas por el usuario. El recorte usa el centro consultado y un tamaño fijo de 0.1 grados.

## Consideraciones científicas

- La DEMO (mapa sintético, secuencia, candidatos y AstroMotion AI) no se basa en observaciones reales. El análisis es una ilustración, no un modelo entrenado.
- Los productos del panel REAL proceden del archivo IRSA. Las colecciones y coberturas dependen de su disponibilidad; una respuesta vacía es válida. QR2 y QR3 pueden corresponder a versiones de procesamiento diferentes.
- La vista PNG usa la extensión FITS `IMAGE`, en escala lineal entre los percentiles 1 y 99, para visualización solamente. No conserva valores fotométricos. Los píxeles no finitos se identifican; se cuenta `FLAGS` no nulo cuando existe, pero **no se interpretan los bits ni se aplica una máscara de calidad**. Un flag no nulo no implica necesariamente que el píxel sea inválido. No se utilizan `VARIANCE`, PSF ni calibración espectral para fotometría.
- La vista previa individual se invierte verticalmente para visualizarla y no garantiza orientación norte-arriba. La comparación REAL opcional reproyecta ambos recortes a la WCS de A; la línea temporal y candidatos originales siguen siendo simulados. No se debe inferir movimiento, órbita o descubrimiento.
- El intervalo espectral y fechas son los metadatos disponibles en SIA, no mediciones derivadas por esta aplicación. Un resultado que alcanza el límite de 100 puede estar truncado.

## Fuentes oficiales

- [IRSA SIA2: colecciones, POS, formato y metadatos](https://irsa.ipac.caltech.edu/ibe/sia.html)
- [IRSA SPHEREx Quick Release](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html)
- [IRSA SPHEREx Cutout Tool](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html)
- [IRSA SPHEREx Spectrophotometry: extensiones IMAGE, FLAGS y VARIANCE](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html)

Para publicaciones con datos SPHEREx, consulta la página oficial para citar la colección adecuada y el reconocimiento requerido (QR2 DOI `10.26131/IRSA652`; QR3 DOI `10.26131/IRSA662`).

## Pruebas

```powershell
python -m pytest tests -q
node frontend/tests/audit.mjs
```

El test del frontend necesita Node con `WebSocket` nativo y Chrome/Edge; admite `CHROME_PATH`. Las pruebas del backend usan datos FITS y respuestas simuladas, sin depender de IRSA. Para ejecutar también la prueba real opcional (requiere red):

```powershell
$env:SPHERALYX_LIVE_TEST='1'
python -m pytest tests/test_backend.py -q
```

La conexión real QR2 se probó con el campo del ejemplo: SIA devolvió observaciones y el recorte generó un PNG. Las pruebas de la fase 3.1 se ejecutaron con Python 3.12.

## Comparación temporal REAL (fase 3)

Después de buscar en IRSA, selecciona dos filas en el panel **Comparación científica aproximada · REAL** y pulsa «Verificar y comparar». Se descargan los FITS originales y se comprueban detector, colección, calibración, calidad, WCS, máscaras, unidades, cobertura y longitud de onda local. Se muestran las razones de incompatibilidad. El panel permite ver A, B y cobertura en la rejilla común; superposición, diferencia y reproducción A/B solo están disponibles si se superan los umbrales exploratorios. La DEMO mantiene controles y estado propios.

- `GET /api/observations/{id}/metadata`: metadatos SIA, fecha UTC y procedencia; la WCS completa se lee del FITS al comparar.
- `POST /api/temporal/compare`: JSON `{"a":"<id>","b":"<id>"}`; devuelve compatibilidad preliminar, motivos, cobertura y vistas PNG como URL de datos. No acepta URLs externas.
- `GET /api/temporal/results/{id}`: resultado efímero (hasta 30 minutos, máximo 10 por proceso). Se permiten dos comparaciones simultáneas por proceso; la API responde 503 si está ocupada.
- `POST /api/temporal/pairs`: busca como máximo tres pares de la búsqueda SIA2; devuelve motivos, cobertura y estado espectral. También disponible por CLI: `python -m backend.astronomy.pair_finder 83.8221 -5.3911 --release qr2 --max-pairs 3`.
- `GET /api/observations/{id}/calibration-links`: inspecciona los enlaces y descriptores DataLink oficiales de IRSA sin seguirlos ni certificar una relación UUID-calibración. Ver [investigación y evidencia](docs/resolucion-calibracion.md).

Las pruebas están en `tests/test_temporal.py`. Ver [método y limitaciones](docs/comparacion-temporal.md). Se realizó una prueba real QR2 en RA 83.8221°, Dec −5.3911°: la WCS aproximada sugirió incompatibilidad local; sin CWAVE/CBAND verificados no se puede confirmarla científicamente. No se verificó todavía un par real que supere todos los criterios.

**Calibración:** IRSA reserva `WCS-WAVE` para visualización. La diferencia se bloquea si no se dispone de CWAVE/CBAND y su asociación UUID/detector/versión/colección verificada mediante manifiesto administrativo. En esta instalación no hay ninguna asociación real certificada. En dos búsquedas documentadas se evaluaron seis pares QR2 y ninguno se aceptó; consulta el detalle y la configuración del manifiesto en la documentación.

## Seguridad y alcance de entrega

El prototipo está pensado para una demostración local, no para exposición pública. Los límites de descarga y los semáforos son por proceso; no hay autenticación, cuotas por IP, protección de abuso, almacenamiento compartido ni seguimiento de trabajos. El estado y los identificadores son efímeros: al reiniciar o usar varios procesos pueden perderse. Para exponerlo se requiere una revisión de seguridad, límites globales y persistencia adecuados. Ver [limitaciones científicas y operativas](docs/limitaciones-entrega.md).

**Impacto y creatividad:** la propuesta combina acceso abierto a observaciones infrarrojas con una interfaz pedagógica que muestra por qué una comparación exige calibración. El laboratorio sintético permite estudiar fallos y falsos positivos sin confundirlos con hallazgos. Su relevancia es metodológica y educativa; no demuestra detección de Planet X ni supone un producto oficial de NASA.
