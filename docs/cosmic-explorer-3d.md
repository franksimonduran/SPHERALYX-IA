# Cosmic Explorer 3D

La esfera es una representación conceptual mediante proyección ortográfica de coordenadas ecuatoriales ICRS, no una imagen observada ni un catálogo de estrellas. Las estrellas del fondo son decorativas. El cursor permite seleccionar una dirección en el hemisferio visible; arrastrar gira la vista. Con teclado, las flechas giran la vista y Enter selecciona su centro. Se puede volver a centrar usando los campos RA/Dec existentes.

Seleccionar actualiza las entradas compartidas, pero **no inicia una consulta**. «Buscar en IRSA» utiliza el formulario real existente y respeta su modo offline, radio y colección. Después se selecciona un producto de la lista para abrir el visor PNG real. Un resultado SIA puede no cubrir el centro; una dirección seleccionada no prueba presencia de una fuente ni detección. Los resultados anteriores corresponden a su consulta anterior hasta que se realice otra.

El pequeño círculo de radio angular se proyecta sobre la esfera, pero con los radios permitidos de búsqueda puede ser subpíxel e invisible a escala de todo el cielo. La cruz aumentada marca el centro, **no representa ese radio a escala**. El radio de búsqueda SIA tampoco es el tamaño del recorte FITS: este último sigue el tamaño fijo del backend. La interfaz no altera WCS, datos FITS ni criterios científicos.

La auditoría frontend usa respuestas API simuladas y comprueba proyección en polos y cruce de RA, selección sin consulta automática, búsqueda explícita, modo offline y tamaños de pantalla. No valida astrometría ni cobertura de datos reales.
