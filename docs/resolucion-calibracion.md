# Resolución de calibración SPHEREx: investigación DataLink

## Alcance y resultado

Se encontró el servicio oficial IRSA `https://irsa.ipac.caltech.edu/datalink/links` a partir de una consulta TAP a `ivoa.obscore`: la columna `access_url` de una imagen SPHEREx contiene un enlace DataLink. La [documentación del visualizador](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/visualization.html) indica que su menú de archivos relacionados usa DataLink, pero **no se ha capturado el tráfico del navegador del Data Explorer** y no se demuestra que el menú use exactamente la misma consulta examinada aquí.

Para la observación QR2 `ivo://irsa.ipac/spherex_qr2?2025W37_1A_0685_1/D2`, la consulta real:

```text
https://irsa.ipac.caltech.edu/datalink/links?ID=ivo%3A%2F%2Firsa.ipac%2Fspherex_qr2%3F2025W37_1A_0685_1%2FD2
```

devolvió HTTP 200 y un VOTable con `QUERY_STATUS=OK`, dos filas y un descriptor:

| Semántica | Referencia | Tipo |
| --- | --- | --- |
| `#this` | [Imagen científica original](https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/level2/2025W37_1A/l2b-v20-2025-272/2/level2_2025W37_1A_0685_1D2_spx_l2b-v20-2025-272.fits) | `image/fits` |
| `#cutout` | `service_def=ibe-cutout` | `image/fits` |

El descriptor `ibe-cutout` tiene `accessURL=https://irsa.ipac.caltech.edu/ibe/cutout`, parámetros `ra` (`ref=col_13`), `dec` (`ref=col_14`), `size` (valor predeterminado 0.01) y `path` (`ref=col_12`). El descriptor examinado **no contiene `standardID`**. En estas dos filas no hay `#calibration`, `spectral_wcs`, ni identificador de archivo de calibración. Las consultas reales a `ivo://irsa.ipac/spherex_qr2?2025W37_1A_0685_1/D5` y `ivo://irsa.ipac/spherex_qr2?2026W10_2B_0315_3/D6` devolvieron igualmente `#this` y `#cutout` únicamente. Esto describe las respuestas examinadas, no todos los productos ni todos los posibles servicios DataLink de IRSA.

El recorte científico D2 consultado tiene `DETECTOR=2`, `DETCOORD=sky` y dos entradas de historia `spectral_wcs`: primero `bd447bc4-4f65-481b-84e9-a5f30a4f8715` y después `a9cb438e-e37d-4888-a1a5-5a9db6ad0737`. El código actual conserva la última como referencia del producto, pero la respuesta DataLink **no vincula ninguno de estos UUID a un FITS de calibración**.

## Directorio y cabecera de calibración

El [inventario oficial en la nube](https://nasa-irsa-spherex.s3.amazonaws.com/?list-type=2&prefix=qr2%2Fspectral_wcs%2F&max-keys=10) listó seis productos QR2 `cal-wcs-v4-2025-254`, uno por detector. Se consultaron solo los primeros 8640 bytes mediante HTTP Range del [archivo oficial D2](https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/spectral_wcs/cal-wcs-v4-2025-254/2/spectral_wcs_D2_spx_cal-wcs-v4-2025-254.fits), de 33 312 960 bytes: HTTP 206, `DETCOORD=sky`, comentarios `CWAVE ... SpecCal 20250901`, `CBAND ... SpecCal 20250901`, y encabezado `CWAVE` con `DETECTOR=2`, `BUNIT=um`. En la cabecera primaria examinada no se encontró UUID que la vincule con los UUID de historia del recorte. No se descargó el archivo completo, no se calculó SHA-256 y **no se registró ningún manifiesto**: compartir detector o ser el único producto listado no prueba la relación.

IRSA documenta que [las calibraciones no están disponibles por SIA2](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/) y que para ciencia deben usarse [CWAVE y CBAND, no la aproximación WCS-WAVE](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/). Haría falta un registro oficial UUID→producto/versionado, una respuesta DataLink con relación explícita al UUID exacto, o confirmación documentada de IRSA/SSDC. También debe comprobarse si el UUID de historia es el del archivo distribuido o de un producto interno actualizado posteriormente. La coincidencia de fecha, versión de nombre, forma de tabla o detector no basta.

## Implementación y seguridad

`GET /api/observations/{id}/calibration-links` consulta el endpoint DataLink fijo usando exclusivamente el `obs_publisher_did` de una observación previamente encontrada en SIA2. Devuelve enlaces, descriptores y posibles candidatos, con `uuid_association_verified=false`. Un enlace cuyo nombre incluya `spectral_wcs` se marca solo como candidato, nunca como demostración de correspondencia. No se siguen URLs o descriptores retornados, ni se aceptan URLs del usuario; se limita la respuesta, se comprueban formato/ID/errores y se reutilizan los límites de tiempo y reintentos del cliente IRSA. Errores HTTP y VOTable no válidos se traducen en errores controlados. Esta interfaz **no modifica manifiestos ni desbloquea comparaciones**.

El manifiesto administrativo existente sigue requiriendo evidencia externa y permanece bajo control del administrador. No hay integración automática de descarga de calibraciones porque no se obtuvo una relación UUID↔producto autoritativa. Las validaciones de integridad y orientación de una calibración local no demuestran su relación científica.

## Reevaluación real

Se repitió el buscador acotado en QR2, RA 83.8221°, Dec −5.3911°, radio 0.01°, máximo un par: 100 imágenes devueltas por SIA2, 784 pares prefiltrados, **1 evaluado y 0 aceptados**. Fue el par D5 `2025W37_1A_0685_1` / `2026W11_1A_0682_3`, ya documentado en [comparacion-temporal.md](comparacion-temporal.md). Cobertura válida 67.62 %, coincidencia *aproximada WCS-WAVE* 0 %, UUID de ambos recortes `e106c789-52b3-4e5e-b7b2-23dc3aa2f86b`. El resultado se rechazó por calibración no verificada y discrepancia espectral preliminar; no se generó diferencia. Este es un intento adicional del mismo par, no un nuevo par distinto. Sin relación oficial nueva, no se puede realizar una comparación real calibrada reproducible.

## Reproducción

En Python 3.12: `python -m backend.astronomy.pair_finder 83.8221 -5.3911 --release qr2 --max-pairs 1`. Las pruebas unitarias están en `tests/test_datalink.py`. Para consultar IRSA opcionalmente: `$env:SPHERALYX_LIVE_DATALINK='1'; python -m pytest tests/test_datalink.py -q`. La disponibilidad de IRSA puede variar; una respuesta sin relación no prueba que no exista otra interfaz o producto.
