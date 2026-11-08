# AstroMotion: clasificación sintética multiepoca

Este flujo es exclusivamente experimental: genera sus propios FITS y no utiliza observaciones de NASA/IPAC ni datos SPHEREx reales. No utiliza redes neuronales ni produce descubrimientos. Se accede en Validation Lab o con `POST /api/experimental/classification`; los límites y opciones aparecen en `/docs`. Una solicitud ejecuta **un campo**, no un barrido estadístico automático; variar semilla y parámetros para comparar condiciones. Los valores de tiempo de cómputo no son parte del resultado.

## Generación y registro

Se simulan de 3 a 6 imágenes de 128×128, con WCS TAN artificial, escala nominal 1 arcsec/píxel y tiempos separados por el intervalo elegido. Las fuentes objetivo tienen brillo uniforme en [20,180], factor de variación independiente [0,8,1,2] por época y movimiento lineal; una fracción elegida se mueve con dirección aleatoria y módulo entre el 60 y el 100 % del desplazamiento elegido por 10 días. Las fuentes pueden salir del campo. Se añaden ruido gaussiano, PSF constante o variable y píxeles calientes. Una traslación independiente por época imita un error de registro. El campo denso concentra las fuentes; se permiten mezclas y solapamientos.

Se inyectan seis estrellas de referencia fijas y brillantes con posiciones **conocidas a priori**, independientes de los objetivos. El registro estima una traslación mediante asociaciones exclusivas en radio de 4 píxeles y mediana robusta; exige al menos tres referencias. La respuesta contiene traslaciones estimadas e inyectadas para verificar el registro. Si falla, esa época no aporta detecciones alineadas: no se sustituye la solución por la verdad. No se estiman rotación, escala ni distorsión; este supuesto de catálogo ideal no es un registro astrométrico real.

## Detección, asociación y clasificación

DAOStarFinder detecta fuentes por época. Se retiran las referencias identificadas y se inician trayectorias con detecciones de la primera época. En cada época se buscan vecinos dentro de la tolerancia respecto a la última posición alineada. Si algún extremo tiene varios vecinos se marca ambigua; si no hay vecino la trayectoria se interrumpe. No se reconstruyen trayectorias que aparecen después de la primera época ni se recuperan huecos. El radio se aplica por intervalo: velocidades grandes o intervalos largos pueden quedar fuera.

Para trayectorias sin ambigüedad con al menos tres detecciones y SNR pico mínimo, se ajusta una recta ponderada x(t), y(t). La incertidumbre de posición es la del detector con suelo de 0,15 píxeles combinada en cuadratura con una estimación robusta del registro (suelo 0,03). No modela covarianza entre fuentes ni épocas, y el SNR es una aproximación basada en el pico. La covarianza formal del ajuste proporciona σ de velocidad por eje y σ del desplazamiento ajustado. La significancia heurística es norma de velocidad dividida por esa σ; el residuo reducido usa 2N−4 grados de libertad y no está calibrado estadísticamente.

- Asociación múltiple o residuo reducido superior al umbral: **ambigua**.
- Menos de tres épocas, SNR insuficiente o significancia entre 2 y el umbral configurable: **insuficiente evidencia**.
- Significancia al menos el umbral: **posiblemente móvil**.
- Significancia no superior a 2: **compatible con estacionaria**; no demuestra ausencia de movimiento, especialmente bajo el ruido.

El sistema reporta componentes este/norte en arcsec y arcsec/día con la aproximación de plano tangente de escala nominal: este = −x y norte = +y. No estima órbitas. Los umbrales son heurísticos configurables, no calibrados sobre muestras independientes ni validados para falsos positivos físicos. Las pruebas con semillas diferentes son ejemplos de evaluación, no una optimización o calibración concluyente.

## Evaluación integral

La verdad se usa solo después de detectar, registrar, asociar y clasificar. Cada detección alineada se relaciona con una fuente inyectada por emparejamiento único dentro de 1,5 píxeles. La asociación cuenta enlaces entre épocas consecutivas: VP si ambos extremos corresponden a la misma fuente; FP enlaces restantes; FN = todas las fuentes inyectadas × (épocas−1) − VP, incluidas las no detectadas y fuera del campo. La precisión y recuperación de asociación son distintas de las de clasificación.

La matriz tiene filas de verdad móvil/estacionaria y columnas de las cuatro categorías. Incluye todas las fuentes inyectadas: si falta una trayectoria se contabiliza como evidencia insuficiente; si se comprueba una identidad incoherente se evalúa como ambigua. Los positivos móviles incorrectos o sin identidad verificable se contabilizan además como alertas espurias FP, no como VP. VP móvil son fuentes realmente móviles con identidad consistente y predicción móvil; FN son todas las móviles restantes. FP incluye estacionarias etiquetadas móviles y alertas espurias. La matriz por sí sola no incluye estas últimas; consultar `spurious_moving`. Precisión = VP/(VP+FP), recuperación = VP/(VP+FN), F1 = 2VP/(2VP+FP+FN); denominadores cero producen `null`. La tasa de falsos movimientos es estacionarias predichas móviles / estacionarias inyectadas, por lo que excluye alertas espurias; estas se reportan aparte. Ambigüedad es fuentes inyectadas evaluadas como ambiguas / fuentes inyectadas.

Se devuelve una desagregación por brillo débil (<80) y brillante (≥80); sus FP excluyen alertas sin identidad. Ruido, densidad, PSF y desplazamiento figuran en la configuración de cada ejecución: deben ejecutarse campos separados para compararlos; todavía no existe un barrido multidimensional ni intervalos de confianza para esta fase. Los errores vectoriales de desplazamiento y velocidad se calculan **solo** sobre trayectorias completas de identidad consistente con ajuste; se devuelve el tamaño de muestra, por lo que no representan las fuentes omitidas.

## Limitaciones y fallos previstos

Un registro incorrecto, contaminación de referencias, campos densos, mezcla de fuentes, cambios de PSF, errores de centroides, fuentes débiles y desplazamientos mayores que la tolerancia pueden causar asociaciones falsas o evidencia insuficiente. Los errores sistemáticos se comparten entre fuentes y las incertidumbres formales pueden ser optimistas. Faltan comparación con catálogos externos reales, validación de WCS, PSF y fondos instrumentales, tratamiento de artefactos SPHEREx y calibración espectral. El flujo REAL conserva sus bloqueos; el resultado sintético no valida detecciones reales.
