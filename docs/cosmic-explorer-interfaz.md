# Cosmic Explorer: interfaz y límites

## Organización

El panel **REAL · NASA/IPAC IRSA** reúne a la izquierda las coordenadas RA/Dec compartidas, radio, colección, búsqueda y modo offline; en el centro, la vista previa PNG; a la derecha, la lista cronológica y sus filtros. Las coordenadas son las mismas que se usan para configurar el campo DEMO: el botón «Actualizar campo simulado» afecta a la simulación y «Buscar en IRSA» solicita productos reales. La lista de observaciones conserva sus IDs efímeros y el comparador existente sigue independiente.

El visor empieza vacío y comunica búsqueda, carga y error sin sustituir imágenes por simulaciones. Tras recuperar un recorte, sus botones permiten ampliar, reducir y ajustar; también se puede arrastrar o usar flechas con el visor enfocado (`+`, `-`, `0`). **El zoom y el encuadre son únicamente transformaciones de pantalla del PNG**: no cambian píxeles científicos, WCS, datos FITS ni mediciones. El pie muestra las entradas RA/Dec actuales, que podrían haber cambiado y **no son coordenadas derivadas de la imagen**. El PNG normalizado no es fotometría y su orientación no garantiza norte arriba.

No se añadieron objetos de referencia preseleccionados: los campos de la auditoría incluyen posiciones aproximadas o históricas y no demuestran por sí solos la presencia del objeto en un recorte. Los posibles presets requieren revisión astrométrica por época y procedencia explícita. Ver [lista cronológica](lista-cronologica-real.md), [disponibilidad IRSA](fase91-disponibilidad.md) y [comparación temporal](comparacion-temporal.md).

## Auditoría de CSS

Se revisaron las seis hojas cargadas: `main.css` (base y tipografía), `components.css` (componentes y controles comunes), `responsive.css` (adaptaciones originales), `observatory-v2.css` (capa visual general), `mission-control.css` (estructura del centro de misión) y `observatory-refined.css` (ajustes posteriores). La cascada contiene reglas históricas repetidas; se consolidaron las reglas específicas del espacio REAL en `mission-control.css` y se retiraron sus duplicados más recientes de `observatory-refined.css`. **No se eliminaron ni reescribieron las capas compartidas de otras secciones**, para evitar regresiones; sigue existiendo deuda de cascada fuera del espacio REAL.

La paleta del espacio REAL utiliza fondo `#070D1F`, paneles `#101B32`, cian `#40CBF5` y texto `#F2F6FF`. La composición usa tres columnas en escritorio amplio, dos columnas con resultados debajo en tamaños intermedios y una columna en móvil. La reconstrucción del espacio conserva los IDs y listeners originales; localiza la introducción por ID explícito en lugar de depender del primer párrafo.

## Verificación

`node frontend/tests/audit.mjs` comprueba con Chrome/Edge headless y respuestas API **simuladas**: ausencia de desbordamiento y posición de paneles a 375, 768, 1024 y 1440 px; menú móvil; búsqueda REAL; controles de vista real por teclado y puntero; reinicio; errores; cancelación; lista cronológica y comparador. No demuestra disponibilidad actual de IRSA, funcionamiento sin red física ni sustituye una inspección visual, de contraste o con lector de pantalla en los dispositivos de presentación.

No se modificaron algoritmos científicos ni criterios de calibración. Los experimentos de AstroMotion y Validation Lab siguen siendo sintéticos.
