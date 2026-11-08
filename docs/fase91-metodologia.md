# Fase 9.1: metodología y visor temporal

## Reproducir consultas reales

Desde la raíz, con Python 3.12 y dependencias instaladas:

```powershell
.\.venv312\Scripts\python.exe -m tools.auditoria_irsa_fase91 --output fase91-consulta.json
# Si se interrumpe, reanudar exactamente esa ejecución:
.\.venv312\Scripts\python.exe -m tools.auditoria_irsa_fase91 --output fase91-consulta.json --resume
```

Se requiere acceso a NASA/IPAC IRSA. Una ejecución nueva requiere un **archivo nuevo** y no sobrescribe uno existente. La opción `--resume` solo acepta un archivo de esta versión del auditor con los mismos campos, código y manifiesto de calibración; no migra los JSON históricos. El JSON contiene fechas UTC, parámetros exactos, metadatos SIA, máximo un par seleccionado por campo/colección, diagnósticos, hashes de FITS/PNG, errores, advertencias de reintento y vistas disponibles. No conserva las respuestas SIA originales ni los bytes FITS/PNG; los hashes no permiten reconstruirlos y no demuestran autenticidad independientemente. Las consultas, su orden y productos pueden cambiar. El comando puede tardar varios minutos y consumir red: hace diez búsquedas, hasta veinte recortes y diez comparaciones. No confundir una búsqueda con una detección del objeto.

### Interrupción y recuperación

Cada búsqueda y cada descarga, vista y comparación finalizada se guardan incrementalmente. El resultado parcial indica `finished_utc: null` mientras esté en curso; un caso también puede estar incompleto. Se serializa a un temporal único en el mismo directorio, se sincroniza y se reemplaza el JSON de forma atómica. Ante Ctrl+C, error o cierre brusco se conservan los puntos de control confirmados; la operación en curso puede repetirse. No se garantiza persistencia ante fallo de hardware/sistema de archivos ni resultados aún no escritos. La primera creación reserva el archivo antes de escribir el estado inicial; un fallo en ese instante puede dejar un archivo vacío sin resultados.

El archivo auxiliar `<salida>.lock` identifica el bloqueo y permanece junto al resultado; el bloqueo del sistema operativo se libera al finalizar o abortar el proceso. No ejecutar simultáneamente dos auditorías sobre el mismo archivo, ni borrar o reemplazar el lock mientras exista una ejecución activa. Los temporales abandonados por una terminación brusca no se interpretan como resultados ni se borran automáticamente. No usar la salida sobre una carpeta compartida cuyos bloqueos o reemplazos atómicos no estén garantizados.

Si falla la escritura del punto de control (por ejemplo, por falta de espacio), la auditoría se detiene en lugar de atribuir el fallo a una imagen FITS. Tras resolver el problema de almacenamiento, reanudar desde el último JSON confirmado; el trabajo de la etapa que no llegó a guardarse puede repetirse.

Se registran hashes de la configuración y del código de los módulos implicados, además del manifiesto de calibración cuando está configurado. Si cambian, `--resume` falla cerrado; conservar el archivo original e iniciar otra ejecución con un nombre nuevo. En una descarga guardada parcialmente, la herramienta vuelve a obtener el recorte y verifica su SHA-256 antes de generar el PNG o comparar. Si los bytes cambiaron, registra el error y no mezcla resultados. Los errores de red ya registrados se consideran casos terminados y no se reintentan automáticamente al reanudar; para una nueva tentativa conservando la evidencia anterior, iniciar otro archivo. Un caso sin resultados es diferente de un error de búsqueda.

El archivo no registra ni compara automáticamente las versiones instaladas de Python y las dependencias. Para reproducibilidad, conservar por separado `python --version` y `python -m pip freeze`, y no reanudar con un entorno distinto sin evaluar sus efectos. La salida tampoco conserva las respuestas originales SIA ni los bytes de los recortes.

Los centros y referencias están en `data/samples/campos-spherex-fase91.json`. Para Barnard, ε Indi B y WISE 0855 se aplica movimiento propio a J2026.0 con `SkyCoord.apply_space_motion`, sin paralaje ni velocidad radial; las coordenadas de WISE 0855 son una posición publicada redondeada de diciembre de 2023. Esta extrapolación angular sirve solo para centrar la búsqueda, no para medir movimiento ni localizar exactamente una fuente. Para RW Aur y R Dra se usa la posición SIMBAD J2000 sin propagación. El radio de búsqueda es 0,1°; el recorte FITS de la aplicación usa tamaño fijo 0,1° por lado, distinto del radio SIA. Para objetos de alto movimiento y recortes cercanos al borde es necesario comprobar la posición por época y la WCS, teniendo en cuenta paralaje y errores. No se afirma que la posición esté contenida en cada producto.

Las coordenadas SIMBAD son referencias de una base dinámica que compila fuentes de literatura; para su uso científico deben citarse también las publicaciones originales indicadas en los registros. Atribución solicitada: “This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France” ([Wenger et al. 2000](https://ui.adsabs.harvard.edu/abs/2000A%26AS..143....9W/abstract)). Para datos QR2/QR3, utilizar los DOI y reconocimiento de la [documentación IRSA](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html).

Se usa exactamente el cliente del proyecto: SIA2 `COLLECTION=spherex_qr2/qr3`, `POS=CIRCLE`, CSV y `MAXREC=100`. La cantidad devuelta es la de productos aceptados por el filtro de URL/subtipo de la aplicación, no necesariamente todas las filas SIA ni todas las observaciones existentes. Incluso con menos de 100 productos normalizados podría haber truncamiento si hubo filas descartadas. El indicador `possibly_truncated` solo marca que se llegó a 100; **no certifica exhaustividad si es falso**. La posición central de un producto y su polígono SIA no prueban que el centro solicitado esté dentro del recorte ni que se detecte el objetivo.

Se elige el primer par del orden `rank_pairs` (misma colección/banda y épocas distintas), priorizando centros cercanos, no tiempo máximo ni detección del objeto. Si no hay par, se prueban hasta dos productos iniciales sin alegar compatibilidad. Se recuperan recortes y PNG individuales; si ambos están disponibles se ejecuta la comparación existente. Solo se indica A/B alineado cuando el resultado contiene ambas vistas; el frontend actual permite consultar esas vistas, pero **solo habilita animación o superposición si `compatible` es verdadero**. La visualización individual no demuestra registro espacial, compatibilidad espectral, ni identificación de fuente. No se instala un manifiesto de calibración ni se altera la política existente: el resultado refleja el entorno que ejecute el comando.

## Funcionalidades existentes

- `GET /api/observations`: validación RA `[0,360)`, Dec `[-90,90]`, radio `(0,0.25]`, QR2/QR3; búsqueda SIA con límite 100 y resultados en memoria.
- `GET /api/observations/{id}`, `/metadata`, `/preview`: metadatos y PNG de recorte FITS `IMAGE`, escala normalizada no fotométrica; IDs efímeros.
- `POST /api/temporal/pairs`: hasta tres pares prefiltrados y evaluados; se explican motivos y cobertura cuando existe resultado.
- `POST /api/temporal/compare`: comprueba metadatos, FITS, máscaras, WCS y calibración; puede devolver A/B alineadas y cobertura aun cuando rechaza el par, pero diferencia solo si supera todos los controles.
- Panel REAL: selección manual A/B, motivos y vistas disponibles; animación y superposición requieren `compatible`. Secuencia de ocho épocas y candidatos pertenecen a la **DEMO SIMULADA** y son independientes.
- AstroMotion, Validation Lab y clasificación multiepoca operan sobre datos **sintéticos**, no validan el cielo real.

## Pendiente para el visor real y propuesta 9.2

1. Diseñar una lista cronológica de observaciones reales con fecha UTC/MJD, colección, detector y estado de recuperación, sin insinuar que los productos contienen el objetivo.
2. Mostrar claramente resultados truncados, fallos parciales, procedencia por imagen, huellas y disponibilidad; no persistir FITS ni habilitar descargas sin definir almacenamiento y límites.
3. Verificar WCS y posición prevista por época con incertidumbre, movimiento propio y paralaje; no asociar fuentes de manera automática sin validación.
4. Mostrar A/B individuales o alineadas solo con leyendas explícitas y advertencias de que son visualizaciones; conservar la restricción actual de superposición, animación y diferencia hasta que se diseñe y valide cualquier cambio por separado.
5. Resolver con IRSA la procedencia autoritativa UUID↔CWAVE/CBAND; no elegir archivos por nombre o fecha. Conservar los bloqueos actuales y verificar PSF, fondos, calidad, incertidumbres y respuesta espectral antes de inferir movimiento.
6. Probar navegación y respuestas tardías, productos sin cobertura, fechas/bandas desconocidas, campos truncados y cortes de red, con mocks diferenciados de pruebas reales opcionales.

No hay un par real calibrado certificado en este proyecto ni evidencia de detección de Planet X. Ver `docs/comparacion-temporal.md` y el informe específico de esta ejecución.
