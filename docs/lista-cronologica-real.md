# Lista cronológica de observaciones reales

La lista utiliza únicamente la respuesta `GET /api/observations` de la búsqueda activa; no realiza nuevas búsquedas para filtrar u ordenar. Cada fila conserva el ID opaco de sesión y los metadatos SIA recibidos. Los IDs tienen una vida limitada en memoria (normalmente hasta 30 minutos) y dejan de funcionar tras reiniciar o expirar: ante 404, repite la búsqueda.

## Orden y filtros

Se ordena por MJD cuando está disponible y es representable; si no, se usa la fecha UTC válida recibida. Las filas sin fecha utilizable se muestran al final bajo **Fecha no disponible**. Un MJD permite calcular el día UTC para filtrar, pero no se inventan fechas cuando ambos campos faltan. Se descartan duplicados con el mismo ID (se conserva la primera fila) y filas sin ID seleccionable; filas con IDs distintos no se fusionan aunque compartan `observation_id`.

Los filtros locales de día UTC, colección, banda y detector solo ofrecen valores presentes en los metadatos. La selección de un filtro no modifica ni limita los selectores A/B del comparador, que reciben todas las observaciones únicas de la búsqueda. Los filtros no verifican la posición, calibración, similitud espectral ni compatibilidad temporal. El campo `detector` refleja lo que devuelve el backend; no se deduce un detector diferente de la banda.

## Estado y procedencia

Cada fila se identifica como **REAL · IRSA** y muestra `Disponible`, `Vista previa cargando`, `Vista recuperada` o `Error al recuperar vista`. Disponible significa que la fila se obtuvo en SIA, **no** que se haya descargado su FITS. Vista recuperada indica que el endpoint local devolvió PNG; no garantiza que el centro ni el objeto de interés estén cubiertos o detectados. Se usa el metadato ya devuelto por búsqueda y solo se solicita la vista previa al seleccionarla; repetir la selección actual no provoca otra descarga. Al cambiar de selección o de búsqueda se cancela la vista anterior y se ignoran respuestas tardías.

La cobertura SIA se muestra cuando existe y solo describe intersección; no demuestra cobertura completa del centro. La imagen PNG es normalizada para visualización, no fotometría. La lista y los filtros no alteran los controles del comparador ni desbloquean diferencia o animación sin los criterios del backend, incluyendo CWAVE/CBAND verificados.

## Truncamiento y limitaciones

El backend solicita como máximo 100 filas SIA y filtra algunos productos antes de devolverlos. Cuando se alcanzan 100 productos, la interfaz avisa de **posible truncamiento**; aunque se devuelvan menos, la respuesta original puede estar truncada o contener filas filtradas. Ni una lista ni un resultado vacío prueban exhaustividad. El orden o la disponibilidad en IRSA pueden cambiar.

Esta función no aplica paralaje ni movimiento propio y no detecta objetos ni Planet X. Los campos de demostración y los experimentos sintéticos siguen separados de los productos reales. Véanse [comparación temporal](comparacion-temporal.md) y [disponibilidad y limitaciones](fase91-disponibilidad.md).
