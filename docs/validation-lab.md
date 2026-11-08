# AstroMotion Validation Lab — metodología sintética

El laboratorio no consulta IRSA ni emplea observaciones SPHEREx; tampoco aplica aprendizaje automático. Su objetivo es estudiar el comportamiento de asociaciones entre dos imágenes FITS artificiales, no validar descubrimientos, clasificación de movimiento ni rendimiento astronómico real.

## Reproducción y controles

`POST /api/experimental/validation` recibe JSON, por ejemplo:

```json
{"seed":42,"scenarios":5,"source_count":60,"noise":15,"density":"dense","displacement":8,"psf":"variable","artifacts":8,"tolerance":6,"threshold":5}
```

El esquema en `/docs` valida parámetros: 1–20 escenarios, 0–100 fuentes, ruido gaussiano σ 1–30, desplazamiento 0–12 píxeles, 0–20 artefactos por época, tolerancia 0,5–12 y umbral 3–12 σ. La API admite un lote simultáneo por proceso, con respuesta 503 si está ocupado; este límite no es global en despliegues multiproceso. El procesamiento es síncrono y no tiene cancelación ni plazo garantizado; el progreso del navegador es **indeterminado**, no un porcentaje calculado. `seed + índice` identifica cada escenario. Las métricas son reproducibles con las mismas versiones; los tiempos no son deterministas.

Cada campo de 128×128 píxeles tiene WCS TAN idéntica en ambas épocas (escala nominal 1 arcsec/píxel y separación 10 días). Posiciones uniformes en región de 98×98 píxeles (dispersa) o 52×52 (densa); se permiten solapamientos. El 40 % de las fuentes es móvil en promedio, con dirección aleatoria y magnitud elegida; el resto es estacionario. Los picos son uniformes entre 12 y 180 unidades y el 30 % varía su brillo en promedio por un factor uniforme entre 0,5 y 1,5 en la segunda época. La PSF es gaussiana de FWHM 3 píxeles o tiene FWHM inicial uniforme entre 2 y 4, aumentada 15 % en la segunda época. Los artefactos son píxeles calientes independientes entre épocas. Todas las fracciones son probabilidades de generación, no cuotas exactas. No se simulan calibración instrumental, ruido de Poisson, PSF real, correlaciones, distorsión diferencial ni efectos espectrales.

## Comparación justa y métricas

Ambos métodos usan **las mismas detecciones DAOStarFinder** con FWHM asumido 3 píxeles y el mismo umbral, aunque la PSF generada sea variable. Ninguno consulta la verdad. El conservador solo acepta pares cuyos dos extremos tienen un único vecino dentro de la tolerancia. La base ordena todas las parejas candidatas por distancia y selecciona vorazmente las más cercanas sin reutilizar detecciones, incluso si son ambiguas. La base no es un método óptimo global ni una validación independiente del detector.

Tras asociar, la evaluación relaciona detecciones y verdad dentro de 1,5 píxeles con el mismo criterio de unicidad. VP = pares cuyos dos extremos corresponden a la misma fuente inyectada; FP = pares aceptados que no cumplen esta condición; FN = fuentes inyectadas sin asociación correcta. Una asociación incorrecta puede contribuir tanto a FP como a FN. Si la correspondencia con verdad es ambigua, se considera no demostrada, lo que puede penalizar conservadoramente a ambos métodos. Las métricas incluyen fuentes móviles **y** estacionarias y no miden la capacidad para distinguirlas.

La precisión es VP/(VP+FP), recuperación VP/(VP+FN), F1 = 2VP/(2VP+FP+FN); se informa `null` si el denominador es cero. Se agregan los conteos antes de calcularlas (microagregación). El error absoluto compara módulos de desplazamiento angular medido e inyectado, solo para VP: se devuelven valores individuales, media, mediana y percentil 90. No es error vectorial ni incertidumbre de todos los objetos. La tasa de ambigüedad es número de **aristas candidatas** involucradas en alguna ambigüedad dividido por todas las aristas candidatas; es `null` si no existen aristas. Los tiempos incluyen generación, detección y evaluación y dependen del hardware.

El intervalo percentil bootstrap al 95 % remuestrea 500 veces escenarios completos con reemplazo y recalcula las métricas microagregadas. Usa una semilla determinista independiente de la generación. No se informa con menos de dos escenarios o cuando más del 20 % de las réplicas no define la métrica. Con pocos escenarios es inestable; incluso un intervalo [1,1] no demuestra rendimiento perfecto. No es un intervalo sobre observaciones reales ni sobre un universo de condiciones astronómicas.

## Límites científicos

Los controles no cubren todos los casos, ni garantizan que el método funcione en un instrumento. Imágenes reales requieren registro, PSF y fondo instrumentales, calibración espectral, máscaras, incertidumbres y validación externa. Los criterios y el bloqueo del flujo temporal REAL no se modifican. Para estudios posteriores conviene ampliar semillas, evaluar por estratos de brillo, densidad y desplazamiento, medir errores vectoriales y clasificación de movimiento y contrastar con inyecciones sobre imágenes reales calibradas.
