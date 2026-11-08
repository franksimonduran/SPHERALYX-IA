# Licencias, recursos y atribución — revisión para entrega

Esta revisión identifica metadatos disponibles; **no constituye una autorización legal ni una auditoría exhaustiva**. La publicación requiere confirmación del equipo titular.

## Código y documentación del proyecto

No existe un archivo `LICENSE` ni una declaración de licencia del código propio. El usuario confirmó que tiene derecho a publicar el código y la documentación y autorizó su publicación en GitHub. No ha elegido una licencia; no se ha asignado una por suposición. La revisión detallada de autorías, contribuciones y componentes de terceros sigue pendiente.

## Imagen local

Durante la revisión de fase 8.1 `frontend/assets/logo.png` cambió externamente: el archivo inicialmente inspeccionado era un marcador 1×1; el archivo actual es una imagen de marca de **1254×1254 píxeles**, SHA-256 `221f313c5402697bd30a82f5d019d9f1e14c7217aea5aba56b001356f6a9d81e`. Se conserva sin modificar y se muestra en el encabezado con proporciones conservadas. El usuario confirmó que tiene derecho a publicarlo y autorizó su distribución en GitHub; su origen y autoría detallados no se han verificado de manera independiente. Si el archivo falta o vuelve a ser un marcador, se muestra el símbolo tipográfico existente.

### Pendientes para el titular

- Confirmar autoría y permisos de todas las contribuciones; elegir y agregar la licencia del código y documentación.
- Documentar el origen y la autoría detallada del PNG y confirmar si es el logotipo oficial.
- Revisar avisos `LICENSE` y `NOTICE` de dependencias y componentes binarios si se redistribuyen.
- Revisar términos y atribución de las fuentes tipográficas externas DM Sans y Manrope de Google Fonts; se usan fuentes del sistema como alternativa offline.
- Confirmar las citas, DOI y reconocimientos correspondientes a los datos SPHEREx efectivamente utilizados y las reglas de marca del evento.

## Dependencias

El ZIP incluye el archivo de versiones, **no distribuye los paquetes Python**. En la instalación se obtienen por separado y cada uno mantiene su propia licencia y posibles avisos o componentes incorporados. Se inspeccionaron los metadatos instalados de las 55 entradas bloqueadas; no reemplazan sus textos `LICENSE`, archivos `NOTICE` ni revisión de distribuciones binarias.

| Metadatos declarados o clasificador | Paquetes en `backend/requirements-lock-win-py312.txt` |
| --- | --- |
| MIT | annotated-doc, annotated-types, anyio, charset-normalizer, donfig, fastapi, h11, msgspec, numcodecs, pluggy, PyAVM, pydantic, pydantic_core, pytest, PyYAML, typing-inspection, urllib3, zarr |
| BSD / BSD-2 / BSD-3 | astropy, astropy-iers-data, astropy_healpix, click, cloudpickle, colorama, dask, dask-image, fsspec, httpcore, httpx, idna, ImageIO, iniconfig, locket, partd, photutils, PIMS, pyerfa, Pygments, pypdf, pyvo, reproject, slicerator, starlette, tifffile, toolz, uvicorn |
| Apache-2.0 | google-crc32c, opentelemetry-api, requests |
| MPL-2.0 | certifi |
| PSF-2.0 | typing_extensions |
| Otras / expresiones mixtas | numpy: BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0; packaging: Apache-2.0 OR BSD-2-Clause; pillow: MIT-CMU. |
| Revisión del texto de licencia | scipy: el campo inspeccionado comienza con aviso de copyright; consultar `LICENSE` de la distribución y bibliotecas incluidas. |

Los 55 paquetes son los fijados por la instantánea de Windows/Python 3.12, incluyendo algunos adicionales de pruebas. La interpretación de metadatos y las obligaciones de redistribución de cada dependencia deben revisarse para el medio concreto de entrega. La disponibilidad y las licencias pueden cambiar al resolver dependencias en otras plataformas.

## Datos y fuentes NASA/IPAC

No se incluye un FITS real descargado ni una respuesta IRSA archivada. `data/samples/astromotion-seed42.json` es un resultado **sintético**. Para uso de datos SPHEREx reales, seguir la [página oficial de QR y sus DOI y reconocimiento](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html). Documentación adicional y fuentes están en `README.md` y `docs/comparacion-temporal.md`. El uso de datos públicos no implica respaldo ni afiliación de NASA.
