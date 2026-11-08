# Guía de demostración reproducible

## Preparación

1. Con Python 3.12 en Windows, crea un entorno nuevo, instala `backend/requirements-lock-win-py312.txt` y ejecuta las pruebas indicadas en el README. En otras plataformas usa y verifica un entorno propio.
2. Sin conexión externa, inicia el servidor con `SPHERALYX_OFFLINE=1` como indica el README. Abre `http://127.0.0.1:8000/` y marca también la casilla **Modo demostración offline**. El frontend necesita el servidor local; no funciona con `file://`.
3. Comprueba que la búsqueda real informe que está desactivada; no sustituyas sus resultados por datos sintéticos.

## Recorrido sugerido

1. **DEMO SIMULADA:** explora el campo y la línea temporal. Los candidatos son ilustraciones, no observaciones ni descubrimientos.
2. **REGISTRO DOCUMENTAL ARCHIVADO:** abre el ejemplo QR2 en el panel real. Se documentó una búsqueda previa en RA 156.09328159°, Dec −41.64466331°, radio 0,01°. El proyecto no conserva la respuesta original, el FITS ni la imagen de esa ejecución; no se presenta como consulta en vivo ni como imagen archivada. La referencia histórica está en `README.md`, sección «Pruebas».
3. **EXPERIMENTO SINTÉTICO:** ejecuta AstroMotion con los parámetros predeterminados. `data/samples/astromotion-seed42.json` conserva parámetros y métricas de referencia, no una observación. Pueden existir diferencias numéricas entre entornos.
4. **VALIDATION LAB:** compara un campo disperso con uno denso y explica precisión, recuperación y ambigüedad de asociaciones. Ejecuta la clasificación multiepoca y muestra también evidencia insuficiente y falsos negativos.
5. Explica que el flujo REAL bloquea diferencias sin la calibración apropiada. No hay un par real verificado ni una detección científica de movimiento.

## Opción en vivo

Reinicia sin `SPHERALYX_OFFLINE`, desmarca la casilla y busca el campo QR2 documentado. La disponibilidad y los resultados de IRSA pueden cambiar o fallar; una consulta en vivo no está garantizada. La vista PNG solo sirve para visualización. Nunca presentes el registro histórico o los resultados sintéticos como una respuesta de IRSA recibida en ese momento.

## Lista antes de presentar

- Ejecutar pruebas backend y auditoría frontend; confirmar que el navegador admite `AbortSignal.any` y `AbortSignal.timeout`.
- Probar el recorrido offline con el servidor ya instalado, incluso sin conectividad externa.
- Verificar etiqueta de procedencia y guardar capturas propias de la versión presentada.
- Si se habilita red, comprobar disponibilidad de IRSA antes de la sesión.
- No afirmar afiliación oficial, IA entrenada ni descubrimientos científicos.
