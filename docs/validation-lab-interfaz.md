# Validation Lab: configuración y resultados

La evaluación usa `POST /api/experimental/validation` y compara asociaciones conservadoras y de vecino voraz sobre los mismos campos sintéticos. No clasifica movimiento ni analiza SPHEREx. La clasificación multiepoca es un laboratorio separado.

## Escenarios guiados

Los botones solo rellenan el formulario; no ejecutan el experimento ni generan métricas. Todos usan PSF constante, desplazamiento 4 px, cinco escenarios, semilla inicial 42, dos artefactos por época, tolerancia 6 px y umbral de detección 5σ. Sus diferencias son:

| Escenario | Fuentes | Densidad | Ruido σ |
| --- | ---: | --- | ---: |
| Campo disperso | 30 | dispersa | 5 |
| Campo denso | 60 | densa | 5 |
| Ruido elevado | 30 | dispersa | 20 |

Los valores pueden editarse antes de ejecutar. El backend usa semillas consecutivas a partir de la inicial; la respuesta muestra las semillas y tiempos por escenario, además de la configuración de ejecución. Para reproducir se necesitan la configuración, las semillas y un entorno y versión de software equivalentes; el tiempo no es determinista.

## Interpretación

VP, FP y FN corresponden a asociaciones comparadas con la verdad sintética, no a detecciones de movimiento. La precisión, recuperación y F1 pueden estar indefinidas cuando falta denominador. El error es el error absoluto medio de desplazamiento de asociaciones correctas. Los intervalos bootstrap al 95 % remuestrean escenarios completos y pueden no estar disponibles; no validan rendimiento sobre observaciones reales. Las advertencias mostradas proceden de la respuesta del backend.

La auditoría frontend comprueba presets, resultados simulados, métricas nulas y errores. Los cálculos científicos permanecen en el backend.
