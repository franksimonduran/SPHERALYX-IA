# Cosmic Explorer: esfera direccional con catálogos reales

## Estado actual

El explorador central incorpora ahora un **visor WebGL inmersivo inspirado en Gaia Sky**, activado progresivamente cuando el usuario ve el panel, y conserva una **esfera Canvas 2D** accesible como alternativa. No incrusta la aplicación de escritorio Gaia Sky ni depende de Three.js: usa WebGL nativo local y proyección direccional ICRS. Esta vista 3D es angular, no una reconstrucción de distancias físicas. Para posiciones volumétricas por paralaje existe el módulo separado «Ver volumen 3D por paralaje», limitado a fuentes Gaia DR3 con paralaje positiva y S/N ≥ 10.

La escena no genera fuentes estelares de sustitución. Inicialmente no hay estrellas de catálogo: el usuario debe cargar Gaia DR3 o AllWISE desde los botones del mismo explorador. Las fuentes se dibujan solamente desde las respuestas **reales** de los endpoints propios `/api/gaia/sources` y `/api/wise/sources`; si una consulta devuelve cero o falla no se generan estrellas ficticias.

Gaia DR3 proporciona RA/Dec, identificadores `source_id` como cadenas, época, magnitudes, movimiento propio, paralaje, incertidumbres y RUWE cuando existen. AllWISE ofrece coordenadas, magnitudes W1–W4 y banderas de calidad disponibles. No se convierten paralajes en distancias. Los valores ausentes se conservan como `null`; para el contexto general Gaia DR3 se identifica la época de catálogo J2016.0, pero no se inventa una época por registro cuando falte.

## Procedencia y cambio del campo seleccionado

Cada capa conserva el **cono real consultado** (RA, Dec, radio) por separado. Si el usuario modifica cualquiera de esos tres parámetros, las fuentes anteriores se **ocultan en el mapa** y se marca `CONSULTA ANTERIOR` hasta que vuelva a las coordenadas originales o realice otra consulta. Sus registros permanecen disponibles para inspeccionar su procedencia; no se presentan como fuentes del nuevo campo. Seleccionar una fuente puede rellenar RA/Dec, pero **no dispara automáticamente** la búsqueda IRSA ni demuestra que aparezca en la siguiente imagen SPHEREx.

Los filtros y selecciones de catálogo no equivalen a asociación astrométrica verificada: una proximidad Gaia/AllWISE de hasta 3″ se rotula **candidata no confirmada**. Los catálogos tienen épocas, sensibilidad y criterios distintos; se necesita propagar posiciones y evaluar incertidumbres antes de una identificación firme.

## SPHEREx y laboratorios sintéticos

El visor de FITS reales se mantiene separado, con imágenes PNG normalizadas que proceden de los recortes reales de IRSA. La esfera no superpone los puntos de catálogo sobre los píxeles SPHEREx: eso exigiría validar WCS espacial, orientación, cobertura y época de cada imagen. No se hacen restas WISE–SPHEREx ni se relajan los bloqueos CWAVE/CBAND de comparación temporal.

La DEMO de campo y los laboratorios AstroMotion y Validation Lab siguen siendo **sintéticos**, claramente rotulados y destinados a verificar algoritmos con verdad de referencia conocida.

## Operación, límites y pruebas

El modo offline desactiva las consultas de catálogos tanto en el navegador como en el servidor. Los clientes backend usan servicios TAP y tablas fijos, control de parámetros, límites de registros y tamaño de respuesta, cachés con caducidad y tiempos de espera. No aceptan URL ni ADQL arbitrarios.

La auditoría frontend con API simulada verifica carga de catálogos, valores nulos, selección sin consulta IRSA automática, selección direccional, conmutación de campo, errores, estados vacíos, modo offline y resoluciones. Las pruebas de Python comprueban serialización y validaciones de entradas. **Estas pruebas con mocks no certifican disponibilidad real en este momento.**

### Integración Gaia Sky en el visor central (noviembre 2026)

El visor central muestra un cielo WebGL de pantalla completa en lugar de una esfera opaca. Los puntos de Gaia DR3 se colorean según BP−RP cuando el dato existe y se dimensionan de forma ilustrativa según la magnitud G; AllWISE se diferencia en ámbar. **No se generan estrellas artificiales**: si el archivo no devuelve fuentes, aparece un mensaje y un botón de consulta, no un catálogo falso. El fondo degradado es decorativo y no se presenta como imagen científica.

La consulta ajusta el zoom a conos pequeños sin el límite anterior de 250×; el usuario puede arrastrar para cambiar RA/Dec de vista, usar rueda y botones para zoom, seleccionar fuentes, navegar con teclado y regresar a Canvas 2D. Cuando copia las coordenadas de una fuente, se conserva en pantalla el **cono original consultado**, claramente identificado como tal; cambiar manualmente RA/Dec o radio invalida ese campo y oculta sus fuentes hasta volver o consultar de nuevo.

La aplicación Gaia Sky oficial sigue siendo software independiente: https://gaiasky.space/. Este visor web no implementa todas sus capacidades, su catálogo global ni sus distancias tridimensionales. La calidad científica y la disponibilidad del backend dependen de los datos reales recibidos del servicio de archivo; los tests con mocks no certifican la conectividad en vivo.