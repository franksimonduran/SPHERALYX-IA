# Fase 9.1: disponibilidad SPHEREx — informe preliminar

**Estado: exploración no concluida.** No se ha incorporado un resultado consolidado para los cinco campos ni se certifica que haya imágenes recuperables, pares visualizables o comparaciones científicas autorizadas. La ausencia de resultados aquí no significa que IRSA carezca de observaciones.

## Comprobación puntual registrada

El 8 de noviembre de 2026, una consulta real con el cliente existente a IRSA SIA2 para la posición histórica de Barnard (RA 269.45207696°, Dec +4.69336497°, radio 0,1°, colección QR3) devolvió **100 productos normalizados**, el límite solicitado. Uno de ellos fue `ivo://irsa.ipac/spherex_qr3?2026W33_2A_0594_3/D6`, fecha SIA `2026-08-16T15:06:13.162` UTC, banda `SPHEREx-D6`, nivel 2. Esta prueba no recuperó su FITS ni comprobó que la estrella o el centro estuvieran en él. Los 100 productos pueden ser una respuesta truncada. Es una búsqueda exploratoria con el centro histórico, distinta de la posición aproximada propagada utilizada por la herramienta de cinco campos.

## Matriz de compatibilidad: pendiente

| Campo | Observaciones | FITS recuperados | A/B visualizable | Comparación autorizada |
| --- | --- | --- | --- | --- |
| Barnard's Star | Consulta puntual QR3: 100 productos; no exhaustiva | No comprobado en esa consulta | No comprobado | No comprobada |
| Epsilon Indi B | Resultado consolidado pendiente | Pendiente | Pendiente | Pendiente |
| WISE 0855 | Resultado consolidado pendiente | Pendiente | Pendiente | Pendiente |
| RW Aurigae | Resultado consolidado pendiente | Pendiente | Pendiente | Pendiente |
| R Draconis | Resultado consolidado pendiente | Pendiente | Pendiente | Pendiente |

La ejecución de los cinco campos se inició por separado; hasta revisar y documentar su salida no se le atribuyen cifras ni resultados. Repetir con los comandos y centros de [metodología](fase91-metodologia.md). Las consultas son dinámicas y no necesariamente devolverán los mismos productos.

## Límites

Una observación SIA, un recorte FITS, dos vistas A/B y una comparación científicamente autorizada son niveles de evidencia distintos. No se han verificado asociaciones de calibración CWAVE/CBAND para este informe; WCS-WAVE es una aproximación visual. No se ha detectado movimiento real validado ni Planet X.

En la ejecución local preparatoria: **78 pruebas aprobadas, 4 omitidas**, con una advertencia de Starlette/TestClient; la auditoría frontend con mocks y `pip check` también pasaron. Las cuatro pruebas omitidas son las opcionales IRSA descritas en `docs/informe-pruebas.md`; estas pruebas no constituyen la exploración de los cinco campos.
