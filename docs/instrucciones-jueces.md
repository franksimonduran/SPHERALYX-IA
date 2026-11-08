# Instrucciones para jueces

**SPHERALYX AI `0.3.0-rc1`** es un prototipo independiente para demostración local, no un producto NASA ni un servicio de producción. No se ha detectado Planet X ni validado movimiento en SPHEREx real.

## Recorrido recomendado sin conexión externa

1. Instalar y arrancar siguiendo [instalación](instalacion.md), apartado offline; abrir `http://127.0.0.1:8000/` y marcar la casilla offline.
2. En **Explorador** y **Simulación**, observar los campos claramente etiquetados DEMO SIMULADA.
3. En **Análisis IA**, ejecutar el experimento sintético individual. No se usa un modelo neuronal: las métricas corresponden al generador artificial.
4. En **Validation Lab**, ejecutar una evaluación y, si hay tiempo, la clasificación multiepoca. Revisar falsos positivos, falsos negativos y categorías ambiguas.
5. En el panel REAL, abrir el **registro documental archivado**: no incluye FITS, PNG ni respuesta original, y no es una consulta actual.

Con red se puede reiniciar sin `SPHERALYX_OFFLINE` y usar la búsqueda REAL, sujeta a IRSA. La vista PNG es visual; el bloqueo de comparación sin calibración no debe desactivarse para la demostración. Véanse [resultados](ficha-resultados.md), [limitaciones](limitaciones-entrega.md) y [pruebas](informe-pruebas.md).
