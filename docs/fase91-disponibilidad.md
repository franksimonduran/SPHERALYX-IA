# Fase 9.1: disponibilidad real SPHEREx

**Ejecución real:** 8 de noviembre de 2026, 19:04:48–19:11:54 UTC, Windows/Python 3.12, sin manifiesto de calibración configurado. Diez consultas SIA2 (cinco campos × QR2/QR3), máximo 100 filas por consulta y radio 0,1°. La ejecución sufrió al menos un HTTP 503 que se resolvió mediante reintento. Los resultados son un sondeo limitado, no un censo exhaustivo ni detecciones de las fuentes.

**Resumen:** ocho consultas devolvieron 100 productos normalizados (posible truncamiento); dos devolvieron cero. En cada uno de los ocho casos con resultados se seleccionó un par por la política existente, se recuperaron ambos recortes FITS y se generaron vistas individuales y vistas A/B alineadas. **Los ocho pares fueron rechazados para comparación calibrada**, todos por ausencia de CWAVE/CBAND verificados; no se generó ninguna vista de diferencia. La presencia de vistas A/B no demuestra que el objetivo esté en ellas ni que la respuesta espectral sea equivalente. La aplicación restringe animación y superposición a pares compatibles, por lo que ninguno habilitó esas funciones.

## Centros utilizados

| Campo | RA ° | Dec ° | Referencia y época |
| --- | ---: | ---: | --- |
| Barnard's Star | 269.44626788 | +4.76820441 | SIMBAD J2000, extrapolación angular aproximada a J2026 |
| Epsilon Indi B | 331.09861270 | −56.80078102 | Scholz et al., posición 2MASS 1999.855, extrapolación aproximada a J2026 |
| WISE 0855 | 133.75989006 | −7.24223708 | Posición JWST redondeada de 2023-12-02, extrapolación aproximada a J2026 |
| RW Aurigae | 76.95652603 | +30.40143817 | SIMBAD J2000, sin propagación |
| R Draconis | 248.16761083 | +66.75497942 | SIMBAD J2000, sin propagación |

Véanse las referencias específicas, movimiento propio y advertencias en `data/samples/campos-spherex-fase91.json` y [metodología](fase91-metodologia.md). Las extrapolaciones omiten paralaje y velocidad radial; no son efemérides de cada exposición. La búsqueda SIA requiere intersección con el círculo, no que el centro se encuentre dentro de cada imagen. No se ha verificado la presencia o detectabilidad de cada objetivo.

## Matriz de disponibilidad y compatibilidad temporal

Las fechas son UTC y los números de cobertura corresponden a la **fracción espacial válida sobre la rejilla del primer recorte**, no a fotometría ni a cobertura del objeto. `WCS-WAVE` es un diagnóstico no calibrado. Un resultado `100` alcanza el límite y puede ocultar más productos; `0` indica solo que no se obtuvieron productos normalizados en esta consulta, no ausencia absoluta en IRSA.

| Campo | Colección | Productos | FITS / PNG individuales | A/B alineadas | Cobertura | Calibración / diferencia |
| --- | --- | ---: | --- | --- | ---: | --- |
| Barnard's Star | QR2 | 100 | 2 / 2 | Sí, D6 | 86,91 % | No verificada; bloqueada |
| Barnard's Star | QR3 | 100 | 2 / 2 | Sí, D2 | 84,14 % | No verificada; bloqueada |
| Epsilon Indi B | QR2 | 100 | 2 / 2 | Sí, D6 | 87,07 % | No verificada; bloqueada |
| Epsilon Indi B | QR3 | 100 | 2 / 2 | Sí, D6 | 79,58 % | No verificada; bloqueada |
| WISE 0855 | QR2 | 100 | 2 / 2 | Sí, D3 | 91,61 % | No verificada; bloqueada |
| WISE 0855 | QR3 | 0 | No se intentó | No evaluada | — | No evaluada |
| RW Aurigae | QR2 | 100 | 2 / 2 | Sí, D2 | 95,49 % | No verificada; bloqueada |
| RW Aurigae | QR3 | 100 | 2 / 2 | Sí, D4 | 89,09 % | No verificada; bloqueada |
| R Draconis | QR2 | 100 | 2 / 2 | Sí, D6 | 88,85 % | No verificada; bloqueada |
| R Draconis | QR3 | 0 | No se intentó | No evaluada | — | No evaluada |

## Pares efectivamente evaluados

| Campo / colección | IDs de observación A / B | Fecha A / B (UTC) | Banda SIA | Diagnóstico aproximado WCS-WAVE |
| --- | --- | --- | --- | --- |
| Barnard / QR2 | `2026W12_1A_0610_4` / `2026W12_2A_0520_1` | 2026-03-19 09:09:23 / 2026-03-22 08:44:20 | SPHEREx-D6 | 0 % |
| Barnard / QR3 | `2026W34_1A_0363_1` / `2026W39_1A_0371_1` | 2026-08-18 20:48:38 / 2026-09-22 15:04:21 | SPHEREx-D2 | 100 % |
| ε Indi B / QR2 | `2026W18_1A_0490_1` / `2026W18_1A_0529_1` | 2026-04-29 08:46:57 / 2026-04-29 13:37:58 | SPHEREx-D6 | 100 % |
| ε Indi B / QR3 | `2026W39_2A_0647_1` / `2026W39_2A_0682_1` | 2026-09-27 14:07:45 / 2026-09-27 19:01:01 | SPHEREx-D6 | 100 % |
| WISE 0855 / QR2 | `2026W17_2A_0692_1` / `2026W19_2A_0782_1` | 2026-04-26 11:50:10 / 2026-05-09 12:39:49 | SPHEREx-D3 | 100 % |
| RW Aur / QR2 | `2026W09_2A_0503_1` / `2026W11_1A_0042_1` | 2026-03-01 04:55:44 / 2026-03-09 05:12:29 | SPHEREx-D2 | 0 % |
| RW Aur / QR3 | `2026W36_1A_0476_1` / `2026W37_1A_0524_1` | 2026-09-02 02:19:55 / 2026-09-09 21:42:13 | SPHEREx-D4 | 0 % |
| R Dra / QR2 | `2026W01_1A_0534_3` / `2026W01_2A_0426_3` | 2025-12-31 13:57:33 / 2026-01-03 13:41:13 | SPHEREx-D6 | 100 % |

El porcentaje espectral se calcula con WCS-WAVE **aproximada**, no con calibración CWAVE/CBAND. Ni un 100 % autoriza una diferencia ni un 0 % es una medición espectral definitiva. En los tres pares con 0 % la evaluación también informó discrepancia aproximada y cobertura espectral insuficiente. Todos quedaron bloqueados por calibración no verificada. Se evaluó **solo un par por caso**, seleccionado por cercanía angular de centros, por lo que otras parejas podrían arrojar resultados distintos.

Los IDs de publicación, URLs de productos, hashes de los recortes recuperados, posiciones, tiempos completos, motivos y metadatos de cobertura se conservan como [resumen documental JSON](../data/samples/irsa-fase91-20261108-resumen.json). **No se almacenaron los FITS, PNG ni respuestas SIA originales**; los hashes no reemplazan los datos. La repetición depende de la disponibilidad y del orden de IRSA. El JSON no es una captura integral de las 100 filas por búsqueda.

## Pruebas y siguiente fase

**Estabilización posterior:** el auditor ahora permite reanudar ejecuciones propias mediante puntos de control atómicos; véase [metodología](fase91-metodologia.md). La tabla anterior sigue describiendo exclusivamente la ejecución real histórica de 19:04–19:11 UTC, no predice ejecuciones nuevas ni convierte sus resultados en un archivo FITS conservado.

En la revisión local de estabilización, `python -m pytest tests -q` obtuvo **87 aprobadas, 4 omitidas, 1 advertencia**; se ensayaron interrupción, terminación brusca de proceso, reanudación, fallo de reemplazo, bloqueo concurrente, respuesta vacía, fallo de red y posible truncamiento. `pip check` y `node frontend/tests/audit.mjs` pasaron. El frontend usa mocks: no demuestra disponibilidad IRSA ni accesibilidad completa.

### Repetición real de estabilización

Una segunda ejecución de los diez casos tuvo lugar el 8 de noviembre de 2026, de **19:25:21 a 19:29:54 UTC**, sin manifiesto de calibración. Los diez conteos y los identificadores de las observaciones seleccionadas coincidieron con la tabla anterior: ocho búsquedas devolvieron 100 productos, WISE 0855 QR3 y R Dra QR3 devolvieron cero. Se recuperaron 16 recortes, 16 vistas individuales y ocho pares alineados A/B; **ocho pares rechazados y ninguna diferencia**. En ε Indi B QR2, IRSA respondió HTTP 503 dos veces y el cliente continuó tras reintentar; el resultado final de esa búsqueda fue satisfactorio. No se observaron errores terminales de búsqueda o descarga en esta ejecución.

La [salida completa de metadatos de la repetición](../data/samples/irsa-fase91-20261108-estabilizacion.json) conserva los productos normalizados y los puntos de control, no las respuestas SIA originales ni los bytes FITS/PNG. Esta ejecución fue iniciada con una versión intermedia del guardado incremental, antes de añadir la huella del código y la captura estructurada de avisos: los reintentos se registraron en la salida de consola, no en su JSON. No se deben atribuir retrospectivamente campos ausentes en el archivo.

La implementación final se comprobó además con [una ejecución real independiente de Barnard](../data/samples/irsa-fase91-20261108-barnard-final.json), 19:29:32–19:30:53 UTC. QR2 y QR3 devolvieron 100 productos cada una, dos recortes por colección y dos pares rechazados sin diferencias; el JSON sí contiene las huellas de siete módulos y una advertencia HTTP 503 recuperada por reintento en cada colección. Esta comprobación final abarcó solo Barnard; los demás campos se registraron en la ejecución anterior.

### Auditoría adicional de los cinco campos

El 8 de noviembre de 2026, **19:34:57–19:39:45 UTC**, se repitieron las diez búsquedas con guardado incremental. La [salida documental completa](../data/samples/irsa-fase91-20261108-auditoria-revision.json) registra parámetros, metadatos, hashes y estados. Los resultados coincidieron con la matriz: ocho consultas de 100 productos normalizados, dos de cero, 16 recortes y ocho pares A/B rechazados; ningún par produjo diferencia. No se registraron advertencias de red ni errores terminales en esta ejecución. Los conteos están sujetos al límite y a los mismos límites de cobertura e identificación explicados arriba.

Esta ejecución terminó antes de una corrección posterior que separa un fallo al guardar un aviso de red de un error del producto FITS. Su identidad de código figura en el JSON; la corrección posterior se probó de forma automatizada, sin atribuirle esta ejecución retrospectivamente. Las respuestas originales y los bytes FITS/PNG no se conservan.

Tras esa corrección, `.venv312\Scripts\python -m pytest tests -q` dio **89 aprobadas, 4 omitidas, 1 advertencia** de Starlette/TestClient, y `pip check` no detectó conflictos. Se añadieron pruebas de errores de almacenamiento tanto al guardar una descarga como al registrar un reintento de red. No se modificó el frontend ni se volvió a ejecutar su auditoría en esta revisión.

- Backend local: **78 aprobadas, 4 omitidas, 1 advertencia** de Starlette/TestClient. Las cuatro omitidas requieren variables `SPHERALYX_LIVE_*`; esta exploración IRSA es independiente de esas pruebas.
- Auditoría frontend: aprobada con respuestas API simuladas. `pip check`: sin incompatibilidades.
- Los algoritmos y bloqueos científicos existentes no se modificaron. No se ha demostrado movimiento real ni descubrimiento de Planet X.
- Recomendación 9.2: lista cronológica REAL con procedencia por producto y avisos de truncamiento; comprobación de WCS y posición por época, incluyendo movimiento propio y paralaje; vistas individuales claramente etiquetadas; preservar el bloqueo de animación/superposición/diferencia hasta su validación. Ver [inventario y metodología](fase91-metodologia.md).
