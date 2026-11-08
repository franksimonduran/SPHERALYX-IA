# Auditoría frontend: alcance y pendientes

## Cascada

Se revisaron las seis hojas activas en su orden de carga: `main.css` (base), `components.css` (componentes), `responsive.css` (adaptaciones originales), `observatory-v2.css` (presentación general), `mission-control.css` (composición del observatorio) y `observatory-refined.css` (ajustes finales). Las últimas hojas tienen precedencia salvo reglas más específicas o `!important`. Persisten declaraciones históricas superpuestas de paleta, paneles y puntos de ruptura; no es seguro eliminarlas en bloque sin una revisión visual exhaustiva de todos los estados. Se consolidó la excepción de movimiento reducido en la última capa y se incluyó ahí el foco visible para regiones con `tabindex`.

## Comprobaciones

`node frontend/tests/audit.mjs` usa Chrome/Edge headless y respuestas API simuladas. Comprueba las cinco anchuras 375, 430, 768, 1024 y 1440 px, desbordamiento del documento, disposición REAL, proporción cuadrada del visor sintético, formularios etiquetados visibles, menú móvil, Escape y retorno de foco, una transición real por Tab con foco visible, movimiento reducido, tablas científicas desplazables por teclado y diversos estados de carga/error. Incluye una prueba acotada con 3.000 marcadores sintéticos; no es un perfil de rendimiento de producción.

Las tablas dinámicas de validación, clasificación y movimiento disponen ahora de regiones nombradas y enfocables para permitir desplazamiento con teclado. Los controles de recortes PNG son visuales y no modifican los datos FITS. Las pruebas automáticas no sustituyen la comprobación del aspecto de imágenes reales de múltiples proporciones.

Es posible guardar capturas de las seis secciones en 375 y 1440 px definiendo `SPHERALYX_AUDIT_SCREENSHOTS` como directorio existente antes de ejecutar la auditoría. Se crea un subdirectorio temporal único; las capturas representan el estado y los datos simulados del test, no observaciones reales. Se revisaron visualmente muestras de portada y explorador móvil y Validation Lab de escritorio; no se han inspeccionado exhaustivamente todos los estados de las doce capturas.

## Pendientes

- Auditoría manual completa con teclado de todos los recorridos y estados, incluyendo desplazamiento de tablas en diferentes navegadores.
- Revisión con lectores de pantalla, contraste medido de todos los textos y componentes, zoom del navegador, pantallas táctiles y dispositivos reales. Hay textos pequeños y fondos semitransparentes que requieren comprobación contextual.
- Perfilado de rendimiento y revisión visual de PNG/FITS reales de distintas dimensiones y redes lentas. El frontend muestra PNG derivados, no FITS directamente.
- Reducción gradual de la deuda de cascada mediante pruebas visuales comparativas de todas las secciones.

Esta revisión no certifica conformidad WCAG ni garantiza accesibilidad completa.
