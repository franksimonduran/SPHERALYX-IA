# Temporal Explorer real

Tras buscar en IRSA, los selectores A y B muestran los productos en orden cronológico con los metadatos disponibles. Cada selección descarga su PNG independiente; cambiarla cancela la solicitud anterior. Los controles de zoom y flechas solo transforman la presentación y funcionan por separado. Los PNG están normalizados visualmente, no están alineados y no son directamente comparables ni fotométricos. Un error o una observación ausente nunca se sustituye por una imagen sintética.

«Verificar y comparar» solicita al backend la evaluación FITS y presenta los motivos de rechazo y advertencias. Las vistas de la rejilla común son reproyecciones: su presencia no demuestra por sí sola un registro astrométrico verificado. El backend no expone actualmente una señal independiente de verificación de registro, por lo que no se ofrece navegación A/B sincronizada como registro validado. Superposición y animación conservan la condición de compatibilidad del backend; la diferencia también se bloquea en el frontend si el resultado es incompatible, incluso si una respuesta incorrecta incluyera esa imagen.

En el sondeo limitado de la [fase 9.1](fase91-disponibilidad.md), ocho pares tuvieron recortes disponibles y todos fueron rechazados para diferencia calibrada por falta de CWAVE/CBAND verificadas. Esto no demuestra movimiento ni detección de Planet X. La secuencia DEMO y los experimentos sintéticos siguen separados.

La auditoría frontend usa respuestas simuladas; comprueba selección, cambio y cancelación de PNG, errores y bloqueo de una diferencia incluida indebidamente en una respuesta incompatible. No verifica disponibilidad actual de IRSA ni precisión astrométrica en cielo.
