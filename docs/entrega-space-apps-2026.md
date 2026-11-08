# Preparación de entrega · NASA Space Apps Challenge 2026

**Estado: borrador local, no publicado; no listo para exposición pública.** SPHERALYX AI es independiente, no está afiliado oficialmente a NASA y no ha detectado Planet X ni validado movimiento real. No hay modelo neuronal entrenado. No se han creado releases, despliegues ni gastos en esta fase.

## Instalación y demostración

Seguir [instalación](instalacion.md): Python 3.12 y lock Windows x64; `pip check`, `pytest` y auditoría frontend. La instalación desde cero, los wheels de otras plataformas y la reproducibilidad bit a bit siguen sin verificarse en esta fase. El lock carece de hashes. La instalación inicial requiere red; el funcionamiento offline requiere dependencias instaladas y backend local. En otras plataformas usar `backend/requirements.txt` y validar una resolución propia.

En PowerShell, desde la raíz:

```powershell
$env:SPHERALYX_OFFLINE='1'
.\.venv312\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Abrir `http://127.0.0.1:8000/`, marcar también **Modo demostración offline** y verificar `/health` (`data_mode: offline`). La casilla y la variable son controles independientes; el servidor devuelve 503 para rutas IRSA y temporales. El navegador puede intentar cargar fuentes externas de Google; sin red se usan fuentes del sistema. Si se exige ausencia total de tráfico externo, bloquearlo a nivel de red o eliminar/servir localmente esas fuentes tras revisar licencias y comprobarlo con captura de tráfico. No afirmar que se ha verificado aislamiento total.

### Recorrido para jueces (aprox. 3 minutos, ensayar)

1. Portada: separar DEMO, IRSA real y experimentos sintéticos; proyecto independiente.
2. Offline: campo y secuencia DEMO; registro documental anterior no es una imagen real archivada ni una consulta en vivo.
3. AstroMotion: ejecutar el experimento y seleccionar una trayectoria en clasificación multiepoca sintética.
4. Validation Lab: seleccionar campo disperso o denso, ejecutar y explicar VP/FP/FN y métricas de asociación.
5. Temporal REAL: explicar que las vistas independientes no están alineadas y que faltan CWAVE/CBAND verificadas para diferencia. No fabricar un par ni una respuesta. La consulta real, si se muestra, requiere reinicio sin offline y disponibilidad IRSA. La comparación real agotó 120 s en la última prueba QA; no depender de ella durante la presentación.

Presentación textual: [siete diapositivas](presentacion.md); [guion de vídeo](guion-video.md). Duración y condiciones oficiales deben confirmarse antes de grabar o subir.

## Arquitectura y configuración

Navegador → FastAPI mismo origen → IRSA SIA2/recortes o procesadores FITS locales. Los endpoints experimentales generan datos sintéticos separados. IDs, cachés, resultados y semáforos son por proceso; se pierden al reiniciar. Con varios workers un ID puede no existir en el proceso que recibe la siguiente petición. Para demostración utilizar un único worker; no implica capacidad de producción.

`deployment.env.example` es un ejemplo **documental** y no se carga automáticamente. Exportar variables explícitamente; no versionar secretos ni manifiestos privados. Variables implementadas:

| Variable | Uso |
| --- | --- |
| `SPHERALYX_OFFLINE` | `1`, `true` o `yes` bloquean rutas reales/temporales en servidor. |
| `SPHERALYX_CORS_ORIGINS` | Lista separada por comas de orígenes exactos; por defecto localhost y 127.0.0.1 en puerto 8000. No usar `*` sin evaluación. Mismo origen no requiere CORS. |
| `SPHERALYX_CALIBRATION_MANIFEST` | Ruta a manifiesto administrativo; usar solo tras verificar asociación, procedencia y criterios documentados en `resolucion-calibracion.md`. No apunta por defecto a calibración real verificada. |

Puerto y dirección son opciones de Uvicorn, no variables propias de la aplicación. No usar `--reload` en una demostración de entrega. `/health` solo indica estado local, no comprueba IRSA. Los errores y dependencias externas pueden impedir la consulta; no sustituir productos reales con simulaciones.

## Seguridad y límites de exposición

El cliente acepta coordenadas y IDs, no URLs arbitrarias; los productos se restringen a HTTPS y rutas SPHEREx del host IRSA, y las descargas no siguen redirecciones. Existen límites de tamaño, validación de entradas, timeouts, reintentos y semáforos por proceso. Esto reduce riesgos de SSRF y abuso, pero **no demuestra ausencia de vulnerabilidades**. Los límites y caches no son globales, no existe autenticación ni cuotas por IP y una cancelación no garantiza detener trabajo de servidor. CORS no es autenticación ni protección SSRF. El QA halló un timeout real de comparación de 120 s.

Para cualquier despliegue futuro, sujeto a autorización: revisión de seguridad y dependencias, TLS y proxy confiable, autenticación/autorización cuando corresponda, límites de solicitudes, conexiones y tamaño globales, cuotas de cómputo, manejo seguro de errores y logs sin datos sensibles, monitorización y límites de gasto, gestión de trabajos/cancelación y almacenamiento de estado compartido o afinidad. Evaluar CSP y cabeceras, riesgos DNS y red de salida; restringir egress a servicios aprobados. Probar bajo carga y ante fallos antes de habilitar acceso público. No se suministra aquí una configuración pública lista para producción ni se afirma que el servidor cumpla esos requisitos.

## Requisitos del evento: verificación pendiente

Se intentó consultar el [sitio oficial de NASA Space Apps](https://www.spaceappschallenge.org/) y buscar requisitos de 2026, pero el acceso falló en esta sesión. **No se han confirmado** plazo y zona horaria, elegibilidad, reglas del reto, campos de la plataforma, URL de repositorio, visibilidad/licencia exigida, duración y formato del vídeo, material obligatorio, atribuciones, derechos ni criterios de evaluación. Los tiempos de la guía y del guion son propuestas, no requisitos oficiales. El titular debe verificar y conservar enlaces oficiales aplicables al evento/localidad y completar la entrega en la plataforma.

## Aceptación previa por el titular

- [ ] Investigar y repetir la comparación temporal que agotó 120 s; decidir si bloquea el alcance elegido.
- [ ] Probar instalación limpia, demostración offline y navegación completa en el equipo de los jueces; registrar resultados.
- [ ] Revisar [QA de integración](informe-qa-integracion.md), pruebas omitidas, contraste y accesibilidad pendientes.
- [ ] Verificar requisitos oficiales y fechas vigentes; aprobar material y cronometraje.
- [ ] Decidir licencia y confirmar autorías, logotipo, marcas, datos, atribuciones y dependencias según [inventario](licencias-atribuciones.md).
- [ ] Revisar archivos finales, secretos y artefactos, autorizar expresamente publicación y visibilidad.
- [ ] Solo después de aprobación, decidir si se crea una release o se despliega; revisar [borrador](notas-release-borrador.md).
