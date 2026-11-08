# Ficha de funcionalidades y resultados — 0.3.0-rc1

**Propuesta:** interfaz local para explorar datos astronómicos, mostrar límites de comparación y experimentar con detección sintética. Prototipo independiente, sin afiliación oficial con NASA y no apto para producción pública.

| Función | Procedencia | Estado y límites |
| --- | --- | --- |
| Explorador, simulación y candidatos | DEMO SIMULADA | Ilustraciones locales, no observaciones. |
| Búsqueda SIA2 y vista previa FITS | OBSERVACIÓN REAL, si se consulta IRSA | Requiere red y disponibilidad externa; PNG visual, no fotometría. |
| Comparación temporal | REAL exploratoria | Bloqueada sin evidencias de calibración necesarias; no confirma movimiento. |
| AstroMotion Experimental | EXPERIMENTO SINTÉTICO | Centroides y asociaciones; no hay red neuronal entrenada. |
| Validation Lab | EXPERIMENTO SINTÉTICO | Evalúa asociaciones y clasificación multiepoca bajo supuestos artificiales. |
| Offline | Local | DEMO y experimentos disponibles con servidor local; no reproduce una imagen IRSA archivada. |

## Resultados reales documentados históricamente

La documentación del proyecto registra una búsqueda QR2 y generación de vista PNG en una ejecución anterior. **No se conserva la respuesta original ni el FITS/PNG de esa ejecución.** En dos búsquedas exploratorias de Orión se evaluaron seis pares distintos, ninguno aceptado; no es una búsqueda exhaustiva. `docs/comparacion-temporal.md` recoge el contexto y los rechazos. No hay asociación autoritativa UUID→archivo CWAVE/CBAND incorporada ni una detección real de movimiento validada.

## Resultado sintético reproducible

`data/samples/astromotion-seed42.json`: semilla 42, tolerancia 6 píxeles y umbral 5; ocho asociaciones verdaderas positivas, cero falsas positivas y cero falsas negativas, error medio absoluto de módulo de desplazamiento ≈0,0163 arcsec. Es un único escenario sintético sencillo, no una tasa general ni una medición NASA. La prueba `tests/test_offline.py` recalcula la referencia con tolerancia numérica.

En clasificación sintética, las incertidumbres son heurísticas y la matriz incluye casos sin evidencia. Véase `docs/clasificacion-sintetica.md`; no confundir clasificación de movimiento con asociación de fuentes.

## Impacto y creatividad

El valor propuesto es didáctico y metodológico: hacer visibles procedencia, condiciones de comparación, falsos positivos y límites, combinando datos abiertos con simulaciones controladas. El proyecto no afirma haber descubierto Planet X.
