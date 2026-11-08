# Limitaciones científicas y operativas

## Procedencia y ciencia

La DEMO usa posiciones ilustrativas; los experimentos y su archivo de referencia son sintéticos. Las búsquedas REAL consultan NASA/IPAC IRSA y se identifican separadamente. El registro histórico QR2 descrito en la guía es documentación del proyecto, sin respuesta original ni FITS/PNG conservados; no puede reproducir la vista real sin volver a consultar IRSA.

Una vista PNG normalizada no es fotometría. La comparación real requiere calidad, cobertura, WCS, unidades y mapas CWAVE/CBAND asociados mediante evidencia verificada; `WCS-WAVE` aproximada no basta. No existe en esta instalación un par real aceptado y reproducible ni clasificación de movimiento validada sobre SPHEREx. PSF, fondos, errores astrométricos y correlaciones pueden generar residuos. Los experimentos de varias épocas emplean referencias sintéticas conocidas e incertidumbres heurísticas; sus métricas no generalizan al cielo real. No se han entrenado redes neuronales.

Fuentes: [IRSA SIA2](https://irsa.ipac.caltech.edu/ibe/sia.html), [SPHEREx Quick Release](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html), [Cutout Tool](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html) y [Spectrophotometry Tool](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html). Detalles: `docs/comparacion-temporal.md`, `docs/resolucion-calibracion.md` y documentación de experimentos.

## Operación y seguridad

El servidor offline bloquea sus endpoints de observaciones y comparación; no es una política de firewall general. Activar la casilla de interfaz evita llamadas IRSA desde esa interfaz pero no bloquea clientes API externos. Las peticiones ya iniciadas pueden seguir ejecutándose en el servidor tras una cancelación. Los límites HTTP, de memoria y semáforos se aplican por proceso, no de forma distribuida; no hay autenticación ni rate limiting por usuario o IP. El servidor **no es apto para exposición pública** sin controles adicionales.

Las cachés y resultados viven en memoria por proceso y caducan o desaparecen al reiniciar; trabajadores múltiples pueden no compartir identificadores. Las descargas IRSA están restringidas a URLs permitidas, con límites y sin redirecciones automáticas. Las pruebas de navegador usan mocks; no garantizan disponibilidad de IRSA. La instantánea de dependencias no tiene hashes y está fijada para Windows/Python 3.12, no para todas las plataformas. Hay una advertencia de deprecación de TestClient que debe revisarse al actualizar dependencias.
