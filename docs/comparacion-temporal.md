# Comparación temporal exploratoria de SPHEREx

## Selección y controles

La búsqueda SIA2 agrupa descriptivamente por centro solicitado, época MJD y detector; el agrupamiento **no certifica compatibilidad**. Se exigen IDs distintos, tiempos distintos, mismo detector/banda, misma colección y nivel de calibración 2. Los FITS deben incluir calidad `L2DQAFLG=Pass`, detector coincidente, extensiones `IMAGE`, `FLAGS`, `VARIANCE`, WCS celeste y unidades compatibles con MJy/sr y su cuadrado. Las coordenadas de cobertura SIA describen intersección y no garantizan que el centro quede dentro de ambas imágenes.

SPHEREx utiliza un filtro lineal variable: la banda del detector contiene un intervalo amplio y **no implica igual longitud de onda en el mismo punto del cielo**. IRSA indica que `WCS-WAVE` es una aproximación para visualización, con error del orden de 1 nm en condiciones típicas; no es una calibración científica definitiva. El producto independiente Spectral WCS contiene mapas `CWAVE` (centro en µm) y `CBAND` (ancho en µm) por píxel, recomendados por IRSA para análisis. La información `WCS-WAVE` se muestra como diagnóstico aproximado, **nunca autoriza por sí sola una diferencia**.

Con mapas CWAVE/CBAND asociados de forma verificable a las dos exposiciones, se reproyectan los valores de B a A. Para cada píxel común se exige `|λA − λB| ≤ 0.1 × min(ΔλA, ΔλB)`. Como mínimo el 90 % de los píxeles comunes debe cumplirlo. Este umbral sigue siendo una política exploratoria propia, **no un criterio validado por SPHEREx**, ni una prueba de equivalencia de respuesta espectral. Ante cualquier dato o asociación desconocidos, se bloquea la diferencia.

### Selección de calibraciones

Los archivos de calibración no aparecen en SIA2; están en los [directorios de productos](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/). No se ha encontrado una correspondencia oficial verificable automáticamente entre el UUID `HISTORY [CALIB] spectral_wcs` y el nombre/versión del archivo independiente. No se debe suponer que el archivo más reciente corresponde al utilizado por una exposición; especialmente QR2 y QR3 tienen calibraciones distintas.

Para usar CWAVE/CBAND, un administrador debe verificar **fuera de la aplicación** esa correspondencia contra una fuente autoritativa, descargar el FITS y crear un manifiesto JSON local, protegido contra modificaciones no autorizadas. `SPHERALYX_CALIBRATION_MANIFEST` apunta a ese archivo. Cada entrada debe contener `uuid`, `detector` (entero), `release` (`qr2` o `qr3`), `version` (número como texto), `file` (ruta relativa dentro del directorio del manifiesto), `source_url` (URL oficial completa de IRSA) y `sha256` (minúsculas). Una entrada por UUID/detector/colección; las entradas duplicadas se rechazan.

El código comprueba el UUID de `HISTORY`, colección, detector, versión y fecha en la ruta y nombre oficiales, hash SHA-256, tamaño, detector y unidades de ambas extensiones, orientación `DETCOORD` y desplazamiento entero del recorte mediante `CRPIX1A/CRPIX2A`. El SHA-256 comprueba integridad frente al manifiesto, **no prueba** la asociación UUID↔archivo: esa asociación y la autenticidad del manifiesto siguen siendo responsabilidad del administrador. La aplicación no proporciona un mecanismo de carga de archivos o URLs por HTTP. No se ha configurado aquí ningún manifiesto ni certificado una asociación real.

## Máscaras y reproyección

Se leen los arrays originales, no PNG. Se excluyen valores no finitos, varianzas negativas y los bits `SUR_ERROR`, `NONFUNC`, `MISSING_DATA`, `HOT`, `COLD`, `NONLINEAR`, `PERSIST`, `BLOOM`, `SNOWBALL`, `HALO`, `SATELLITE_HALO`, igual que en la lista de exclusión documentada por la herramienta de espectrofotometría IRSA. El bit `SOURCE` no se excluye. Otros artefactos y flags requieren revisión específica; esta política no demuestra que la imagen sea científicamente limpia.

`reproject_interp` interpola B a la WCS de A. Se interpola una máscara booleana por separado; solo se aceptan píxeles con peso válido > 0.999, evitando mezclar vecinos inválidos. La intersección requiere al menos 20 % de la rejilla y 16 píxeles, tanto antes como después del filtro espectral. Son umbrales de interfaz, no garantías científicas. La diferencia exploratoria es `D = B_reproyectada − A` sobre los píxeles comunes. A y B comparten percentiles 1–99 para visualización y D usa una escala simétrica; las imágenes codificadas no conservan los valores físicos.

La API resume la mediana de la aproximación `Var(D) ≈ Var(A) + interp(Var(B))`, en `(MJy/sr)²`, solo en píxeles válidos y espectralmente compatibles. La varianza de B **no** se propaga usando los cuadrados de los pesos de interpolación ni se modelan covarianzas. No se calcula SNR ni significancia. Una propagación rigurosa necesitaría pesos explícitos, covarianzas y validación instrumental. La visualización de cobertura refleja los píxeles espacialmente válidos antes del filtro espectral y no un mapa de sensibilidad.

## Limitaciones

No se homogeneizan PSF, respuesta espectral, fondo, luz zodiacal ni calibración relativa. Residuos pueden deberse a esos efectos, ruido, enmascaramiento o registro imperfecto; **no prueban movimiento**. La compatibilidad devuelta significa únicamente que se superaron filtros heurísticos, no que la pareja sea apta para una publicación. Las vistas alineadas de un par rechazado, cuando existen, no habilitan diferencia, superposición ni animación de comparación. Los resultados se mantienen solo en memoria y no se han diseñado para investigación reproducible distribuida.

## Referencias

- [IRSA: herramienta de espectrofotometría, extensiones y lista de flags](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html)
- [IRSA: observaciones SPHEREx y filtro lineal variable](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html)
- [IRSA: recortes de imágenes espectrales](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html)
- [SPHEREx Explanatory Supplement](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp_QR.pdf)
- [IRSA: WCS-WAVE, CWAVE y CBAND](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/)
- [IRSA: acceso a productos y limitación de SIA2](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/)
- [IRSA: calibraciones espectrales de laboratorio](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/spherex_spectral_calibrations.html) — productos separados, no presumir equivalencia con los usados por el pipeline.

La prueba de un par de IRSA es opcional: en PowerShell, `$env:SPHERALYX_LIVE_TEMPORAL='1'; python -m pytest tests/test_temporal.py -q`. El par puede ser rechazado; la prueba comprueba que, si lo es, no se produce diferencia.

## Búsqueda real de pares: resultado documentado

Consulta QR2, Orión RA 83.8221°, Dec −5.3911°, radio 0.01°: en la primera ejecución SIA2 devolvió 100 observaciones (límite), 784 pares prefiltrados y se evaluaron **3**; **0 aceptados**, 0 errores de descarga. El orden del archivo puede cambiar; estas cifras no son una muestra exhaustiva ni garantizan que no existan pares compatibles. En esa ejecución se priorizó la cercanía temporal. La versión actual prioriza la separación angular entre centros SIA y después la separación temporal; ninguna de esas métricas prueba coincidencia espectral. Máximo tres pares y un proceso buscador a la vez.

| A / B (IDs originales) | Detector | Fechas UTC | Cobertura válida | WCS-WAVE aproximada | Resultado |
|---|---|---|---:|---:|---|
| `2026W10_2B_0315_3` / `2026W10_2B_0315_4` | D6 | 2026-03-07 04:34:50 / 04:36:59 | 75.68 % | 0 % | Rechazado |
| `2026W10_2B_0177_3` / `2026W10_2B_0177_4` | D6 | 2026-03-06 10:38:33 / 10:40:42 | 74.46 % | 0 % | Rechazado |
| `2026W10_1A_0507_2` / `2026W10_1A_0507_3` | D6 | 2026-03-04 16:13:33 / 16:15:42 | 57.67 % | 0 % | Rechazado |

Los tres pares registraron el UUID espectral `2dc965d6-bad3-4916-83ca-54e9e9cfcbd3` en ambas imágenes, pero **no se verificó el archivo CWAVE/CBAND correspondiente**. El 0 % es un diagnóstico con WCS-WAVE aproximada, no un resultado espectral calibrado. Los rechazos fueron por falta de calibración verificada y discrepancia espectral/cobertura espectral preliminar. No se generó diferencia científica. En otra prueba anterior IRSA respondió HTTP 503; el cliente ahora reintenta 429/502/503/504 hasta tres veces con espera progresiva y jitter, respetando `Retry-After` largo sin reintentar. El tiempo total de la ejecución registrada fue 57.7 s.

Una segunda ejecución con la prioridad angular actual también devolvió 100 observaciones y 784 pares prefiltrados; **3 evaluados, 0 aceptados, 0 errores**, en 43.9 s. Se trata de otros tres pares; en total se evaluaron **6** en las dos ejecuciones, todos rechazados:

| A / B | Detector | Fechas UTC A / B | Cobertura | WCS-WAVE aproximada |
|---|---|---|---:|---:|
| `2025W37_1A_0685_1` / `2026W11_1A_0682_3` | D5 | 2025-09-11 09:27:07 / 2026-03-12 03:30:05 | 67.62 % | 0 % |
| `2025W37_1A_0685_1` / `2026W11_1A_0682_3` | D2 | 2025-09-11 09:27:07 / 2026-03-12 03:30:05 | 73.23 % | 0 % |
| `2025W37_1A_0685_1` / `2026W11_1A_0682_4` | D2 | 2025-09-11 09:27:07 / 2026-03-12 03:32:14 | 41.60 % | 0 % |

Las tres comparaciones quedaron bloqueadas por ausencia de CWAVE/CBAND verificados; el diagnóstico aproximado WCS-WAVE sugiere además discrepancia local. El UUID registrado de A fue `e106c789-52b3-4e5e-b7b2-23dc3aa2f86b` para D5 y `a9cb438e-e37d-4888-a1a5-5a9db6ad0737` para D2; no se infiere con ello la versión o el archivo de calibración correspondiente.

Repetir con Python 3.12: `python -m backend.astronomy.pair_finder 83.8221 -5.3911 --release qr2 --max-pairs 3`. La salida JSON conserva identificadores de publicación, URL original, fechas, estadísticas, motivos, UUID y tiempos. Los IDs locales y los resultados de API son efímeros; las URLs y los IDs de publicación son la referencia reproducible. Pendiente: obtener de IRSA una asociación autoritativa UUID↔producto y validarla, así como PSF, fondo, respuesta espectral e incertidumbres antes de cualquier interpretación científica.
