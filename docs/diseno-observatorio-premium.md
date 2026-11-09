# SPHERALYX AI — Observatory Premium UI

## Propósito

La capa visual `frontend/css/observatory-premium.css` adapta el observatorio existente a una interfaz oscura, elegante, con acentos violeta y azules, topbar horizontal, rail compacto, Cosmic Explorer central y paneles científicos consistentes. Se inspira en la referencia visual aprobada por el usuario **sin copiar observaciones, fuentes, cifras, fechas ni imágenes ficticias como datos reales**.

Esta intervención **no crea un segundo visor** ni sustituye módulos FastAPI, Gaia DR3, AllWISE o SPHEREx, y no cambia las reglas de comparación temporal.

## Arquitectura visual y componentes conservados

- Barra superior: marca, enlaces existentes, estado de investigación. No indica disponibilidad de servicios externos sin comprobarla.
- Navegación lateral: enlaces de misión existentes, tamaños y estados activos simplificados.
- Cosmic Explorer: los tres componentes existentes siguen siendo controles y catálogos, esfera celeste direccional e inspector de fuente.
- Esfera: proyección ortográfica Canvas 2D de RA/Dec ICRS, con desplazamiento y zoom. **No se presenta como un motor Three.js/WebGL**, ni como reconstrucción espacial con distancias medidas.
- Fuentes Gaia/AllWISE: solo se dibujan tras respuesta real de las APIs. Los valores y posiciones no proceden de la decoración. El sistema sigue ocultando puntos de consultas anteriores cuando cambian RA/Dec/radio.
- Fondo de la esfera: resplandor, gradientes y diminutos puntos de luz CSS son **decoración**, no estrellas catalogadas; el propio lienzo incluye un aviso que lo distingue.
- SPHEREx: se conserva el visor FITS/PNG real, sus metadatos, cronología, zoom, estados vacíos y controles de calibración.
- AstroMotion y Validation Lab: continúan siendo experimentos sintéticos identificados, no detecciones SPHEREx.
- Vista móvil: navegación colapsable existente, paneles en columna, interacciones por teclado y límites de tamaño.

## Diseño

Paleta: fondo #050914; superficies #0b1428; violeta #9868ff; cian #62dfff; texto #f5f5ff. Se utilizan sombras difusas, bordes tenues y brillos locales sin animaciones constantes. No se añaden bibliotecas ni fuentes de terceros en esta fase.

El HTML mantiene los IDs originales que usan `frontend/js/app.js`, `frontend/js/cosmic-3d.js`, `frontend/js/explorer.js` y las pruebas de navegador.

## Validación

Revisión estática sobre `main`: nuevo stylesheet referenciado, CSS con llaves equilibradas, módulo `cosmic-3d.js` sintácticamente válido y existencia de controles críticos. **No equivale a un resultado aprobado de la auditoría Chrome**, ni a evaluación WCAG, ni certifica servicios externos.

Para validar la entrega desde un clon limpio o un entorno local disponible:

```powershell
python -m pytest tests -q
node frontend/tests/audit.mjs
```

Además, comprobar visualmente 375, 430, 768, 1024 y 1440 píxeles; selección Gaia/AllWISE, consulta IRSA, estados offline, navegación con teclado, ausencia de desbordamiento horizontal y contraste. Los datos del lado servidor deben verificarse por separado si el despliegue activa las rutas astronómicas reales.

## Despliegue

La versión publicada en Render usa un servicio con despliegues automáticos desactivados, por lo que cambios en GitHub no aparecen en el sitio hasta efectuar un despliegue explícito. El servidor fue configurado inicialmente con `SPHERALYX_OFFLINE=1`; ese modo no habilita las consultas externas por el mero hecho de rediseñar el frontend.
