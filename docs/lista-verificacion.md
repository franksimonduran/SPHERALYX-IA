# Lista de verificación para presentación y entrega

Marcar únicamente después de comprobar en el equipo y la copia definitivos.

## Preparación

- [ ] Confirmar que `VERSION` y `/docs` indican `0.3.0-rc1`; registrar hash o tag Git si se crea una publicación real.
- [ ] Excluir `.venv`, `.venv312`, `__pycache__`, `.pytest_cache`, archivos privados y credenciales del paquete; revisar también archivos binarios e historial de versiones.
- [ ] Instalar en Windows/Python 3.12 siguiendo `docs/instalacion.md`; ejecutar `pip check`, pytest y auditoría de navegador.
- [ ] Revisar el resultado real de cada comando; las pruebas opcionales en vivo pueden omitirse o fallar si IRSA no está disponible.

## Demostración

- [ ] Iniciar con `SPHERALYX_OFFLINE=1`, marcar la casilla offline y probar físicamente sin red externa en el equipo de presentación.
- [ ] Confirmar que el servidor local abre, que la DEMO y el experimento sintético funcionan y que los endpoints reales responden 503.
- [ ] Revisar manualmente legibilidad, navegación por teclado, contraste y pantallas de la presentación en el dispositivo y resolución previstos.
- [ ] Si se usará IRSA en vivo, reiniciar sin la variable, comprobar disponibilidad y preparar alternativa offline.

## Mensaje científico y entrega

- [ ] Identificar DEMO, EXPERIMENTO SINTÉTICO y OBSERVACIÓN REAL; no presentar el registro documental como imagen almacenada.
- [ ] No afirmar detección de Planet X, validación real de movimiento, entrenamiento de IA o afiliación NASA.
- [ ] Explicar que el bloqueo de calibración permanece activo y que métricas sintéticas no se extrapolan al cielo real.
- [ ] Revisar fuentes, atribución NASA/IPAC, acceso a enlaces y requisitos concretos del evento.
- [ ] Revisar guion de vídeo, diapositivas, material visual y permisos antes de publicar.
