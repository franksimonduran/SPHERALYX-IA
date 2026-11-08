# Presentación — siete diapositivas

Contenido propuesto; requiere diseño y revisión manual antes de presentarse. No son diapositivas ya renderizadas.

## 1. SPHERALYX AI: explorar con rigor
- Prototipo independiente para explorar datos y límites de comparación SPHEREx.
- DEMO simulada, consulta REAL opcional y experimentos sintéticos separados.
- Mensaje: no se ha detectado Planet X ni validado movimiento real.

## 2. El problema
- Comparar imágenes de distintas épocas puede revelar cambios aparentes.
- Ruido, registro, PSF y respuesta espectral también producen diferencias.
- Pregunta del proyecto: ¿cómo explorar y evaluar candidatos sin confundir estos efectos con descubrimientos?

## 3. Datos reales: NASA/IPAC IRSA
- Consulta SIA2 QR2/QR3, selección de observaciones y vista PNG de recortes FITS.
- PNG normalizado para visualización, no fotometría.
- Una consulta previa está documentada; no se conserva su respuesta ni imagen.

## 4. Control científico antes de comparar
- La misma banda no garantiza igual longitud de onda por píxel.
- Se requiere evidencia de calibración CWAVE/CBAND y se bloquea la diferencia cuando falta.
- En seis pares documentados, ninguno fue aceptado; la búsqueda no fue exhaustiva.

## 5. AstroMotion y Validation Lab
- Generación FITS sintética con ruido, PSF, fuentes y movimiento inyectado.
- Asociación, comparación de métodos y clasificación en varias épocas.
- Falsos positivos, falsos negativos, ambigüedad e incertidumbres heurísticas; no hay modelo neuronal entrenado.

## 6. Resultado y demostración offline
- En el escenario sintético de semilla 42: 8 VP, 0 FP, 0 FN de asociación; un caso idealizado, no una tasa universal.
- Demostración ejecutable localmente sin IRSA; el servidor Python sigue siendo necesario.
- La clasificación sintética no valida movimiento en datos SPHEREx.

## 7. Impacto y próximos pasos
- Impacto propuesto: alfabetización científica y visualización transparente de límites y errores.
- Próximos pasos: evidencia de calibración, validación instrumental, evaluación independiente y contraste con expertos.
- Proyecto independiente, no oficial NASA; no está listo para producción pública.
