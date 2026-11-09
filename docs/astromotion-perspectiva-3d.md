# AstroMotion: perspectiva multiepoca sintética

La vista de perspectiva usa exclusivamente las trayectorias y posiciones registradas que devuelve `/api/experimental/classification`. Cada punto conserva su época; las líneas unen puntos de la misma trayectoria solo cuando sus épocas son consecutivas. La cuadrícula y la cámara son recursos visuales, no representan órbitas.

La profundidad separa uniformemente las épocas para facilitar su inspección: **no es distancia astronómica ni escala temporal**. Las posiciones son píxeles registrados sintéticos, no observaciones SPHEREx. El marcador destacado corresponde a la época seleccionada; el control de época, el selector de trayectoria y las opciones de etiquetas y trayectorias se comparten con el visor PNG. Se puede girar con puntero o flechas, acercar, alejar y restablecer. La selección también está disponible mediante lista accesible; la cámara no cambia las mediciones.

No se interpolan detecciones ni se anima la escena automáticamente. El detalle conserva los valores devueltos por el backend y presenta los ausentes como «No disponible». Las incertidumbres y clasificaciones son heurísticas sintéticas, no validación de movimiento real. El visor PNG, el formulario y las tablas anteriores permanecen disponibles.

La auditoría frontend utiliza respuestas simuladas y comprueba selección, sincronización de época y capas, teclado, zoom, estado vacío y una prueba acotada con 3.000 trayectorias. No sustituye pruebas manuales en dispositivos táctiles ni una auditoría formal de accesibilidad.
