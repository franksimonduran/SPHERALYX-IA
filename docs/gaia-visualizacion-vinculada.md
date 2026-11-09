# Visualización vinculada Gaia DR3 — SPHERALYX AI

## Propósito y referencia

El modo **Gaia Linked Visualization** adapta al Cosmic Explorer existente tres ideas de [ESA Gaia Archive Visualization](https://gea.esac.esa.int/archive/visualization/): panel de coordenadas galácticas, dispersión color–magnitud y carta visual del cielo. **No se copia la aplicación ESA ni su interfaz** y no se crea otra pantalla. Esta implementación usa solamente fuentes Gaia DR3 de la consulta cónica en ESA TAP y una imagen de archivo CDS bajo demanda.

## Flujo

1. Introducir RA/Dec y radio del cono (máximo 0.25°) y pulsar «Consultar Gaia DR3».
2. El backend ejecuta ADQL sobre `gaiadr3.gaia_source` con columnas fijas `source_id,ra,dec,l,b,ref_epoch,phot_g_mean_mag,bp_rp,` etc. Los IDs se serializan como cadenas y los valores ausentes siguen siendo `null`.
3. El componente `frontend/js/cosmic-3d.js` emite cambios de catálogo validado, sin usar las fuentes de una búsqueda anterior cuando el usuario cambia el campo.
4. `frontend/js/gaia-visualization.js` genera desde los mismos registros:
   - **Mapa galáctico local**: longitud y latitud `l,b` reales, NO un mapa completo de la Vía Láctea.
   - **Color–magnitud aparente**: `BP−RP` frente a `phot_g_mean_mag`. No es diagrama HR intrínseco, no se calcula magnitud absoluta ni se invierte paralaje.
   - **Carta óptica opcional**: Aladin Lite v3 del CDS sobre el estudio DSS2 color. La carta **no es SPHEREx** y no superpone puntos sobre FITS de NASA.
5. Los dos gráficos y la selección en Aladin usan `source_id` para activar el **mismo inspector** y la misma selección de fuente Gaia. Esta acción no ejecuta una búsqueda IRSA.

El radio máximo, límite por consulta, posible truncamiento y fecha UTC se muestran mediante metadatos reales. Nada se rellena con fuentes artificiales si la consulta devuelve cero o falla.

## Archivo externo y licencia

El recurso para imágenes ópticas utiliza [Aladin Lite v3 de CDS](https://cds-astro.github.io/aladin-lite/) mediante `https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js`, activado *solo al pulsar* «Abrir imagen de archivo». La aplicación conserva la marca y el enlace de CDS dentro del visor, tal como exige su documentación. Aladin Lite se distribuye bajo GPL-3.0; revisar compatibilidad de redistribución si el proyecto empaqueta o modifica esa biblioteca. La atribución a DSS2/CDS debe conservarse. No alojamos ni modificamos el código Aladin.

El CDN externo puede fallar, o WebGL2 puede estar deshabilitado: en esos casos la vista Gaia local continúa operativa; nunca se muestra una fotografía de ejemplo como imagen real.

## Publicación Render y controles de uso

`SPHERALYX_OFFLINE=1` mantiene desactivadas las búsquedas, descargas FITS y comparaciones externas SPHEREx en Render. De forma **separada**, `SPHERALYX_CATALOGS_ONLINE=1` habilita solo Gaia y AllWISE; estos endpoints tienen límite global de 40 solicitudes por 10 minutos y máximo 3 operaciones externas concurrentes por proceso. El límite no es distribuido entre múltiples instancias. La publicación del catálogo depende del rendimiento y disponibilidad de ESA/IRSA, no debe anunciarse como servicio garantizado.

El endpoint `/health` informa `catalog_mode` y `data_mode` separadamente. Cuando el servidor indica solo catálogos online, la interfaz mantiene desactivadas las operaciones IRSA pero permite consultas Gaia.

## Validación

- Pruebas Python para `l,b` reales o nulos, ID Gaia como cadena, modo catálogos-online con SPHEREx offline.
- Auditoría frontend con mocks para gráficos, selección vinculada y carga óptica únicamente bajo clic.
- Revisar funcionamiento en Chrome/Edge con WebGL2 y conectividad, tamaños 375/768/1440 px, respuestas truncadas y fallidas.

El usuario debe distinguir siempre **datos Gaia DR3 reales**, **imagen óptica histórica DSS2** y **observaciones FITS SPHEREx**. La ausencia de Gaia o DSS2 no demuestra que haya descubierto un objeto nuevo.


## Disponibilidad de Gaia TAP — ESA y archivo oficial alternativo

En una prueba de producción del 9 de noviembre de 2026, la API pública de SPHERALYX respondió `502` porque ESA Gaia TAP devolvía `HTTP 429` (límite de solicitudes) a una infraestructura de pruebas. La conexión no implicaba que la consulta ADQL ni las coordenadas fueran incorrectas.

Ahora `backend/astronomy/gaia_client.py` intenta primero el TAP oficial de ESA **una sola vez**. Si ESA devuelve limitación `429`, fallo transitorio `502/503/504` o error de conexión/tiempo, usa el TAP oficial **Gaia@AIP** del Leibniz-Institut für Astrophysik Potsdam, centro asociado de distribución de Gaia DR3: https://gaia.aip.de/tap/

Gaia@AIP puede devolver un **VOTable XML** incluso indicando `FORMAT=csv`. Se analiza con `astropy.io.votable` (ya declarado en las dependencias), se convierten las columnas por sus nombres oficiales y se conserva `source_id` como *cadena*. No se fabrican registros ante errores. En cada respuesta aparecen `source` y `service_url`, y la interfaz muestra qué archivo suministró los datos. El fallback no altera las épocas ni la interpretación de magnitudes y paralajes.

La política no reintenta repetidamente contra ESA cuando este impone cuotas, para evitar incrementar la carga sobre sus servidores. Las pruebas Python mockean una respuesta 429 seguida de un VOTable válido, y la auditoría web confirma que la procedencia se mantiene y la interfaz funciona. **Una prueba de extremo a extremo contra la instancia pública sigue siendo necesaria** después del despliegue: el éxito de los tests con respuestas controladas no demuestra disponibilidad permanente de archivos externos.

Fuentes oficiales:
- [ESA Gaia TAP](https://gea.esac.esa.int/tap-server/tap/)
- [Gaia@AIP (TAP y acceso programático)](https://gaia.aip.de/cms/services/scripted-access/)
- [Tabla Gaia DR3 en AIP](https://gaia.aip.de/metadata/gaiadr3/gaia_source/)
