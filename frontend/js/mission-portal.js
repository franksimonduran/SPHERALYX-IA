/* Fondo inmersivo decorativo — Mission Portal.
   Alien Space Nebula 1 (Skybox), por Jungle Jim, en Sketchfab:
   https://sketchfab.com/3d-models/alien-space-nebula-1-skybox-4a4e7aec37c04320a09ac4c7434b8810
   No representa un mapa astronómico calibrado ni datos de Gaia/WISE/SPHEREx.
   El reproductor y sus controles/atribuciones están sujetos a Sketchfab. */
const MODEL_ID = '4a4e7aec37c04320a09ac4c7434b8810';
// annotations_visible=0 funciona sin plan Premium: elimina los marcadores
// numéricos de anotaciones; no elimina números incorporados en la geometría.
// Las opciones ui_* requieren permisos Premium para ocultar interfaz propia.
// Mantener el logo/atribución contractual del proveedor.
const EMBED_URL = 'https://sketchfab.com/models/' + MODEL_ID
  + '/embed?autostart=1&ui_theme=dark&annotations_visible=0&autospin=0.12'
  + '&annotation_tooltip_visible=0&annotation_cycle=0'
  + '&ui_controls=0&ui_infos=0&ui_inspector=0&ui_annotations=0'
  + '&ui_animations=0&ui_start=0&ui_hint=0&ui_stop=0&ui_watermark=1';

export function initMissionPortal() {
  const stage = document.querySelector('.portal-ambient');
  if (!stage) return;
  let initialized = false;

  function loadBackground() {
    if (initialized || !stage.isConnected) return;
    initialized = true;
    const frame = document.createElement('iframe');
    frame.className = 'portal-ambient-frame';
    frame.title = 'Fondo inmersivo Alien Space Nebula 1 de Jungle Jim, Sketchfab';
    frame.src = EMBED_URL;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.setAttribute('aria-hidden','true');
    frame.setAttribute('tabindex','-1');
    frame.setAttribute('allow','autoplay; fullscreen');
    // La interacción queda en SPHERALYX; no se permite capturar clics ni foco.
    frame.style.pointerEvents = 'none';
    stage.insertBefore(frame, stage.querySelector('.portal-ambient-shade'));
    frame.addEventListener('load', () => stage.classList.add('portal-ambient-loaded'), { once: true });
  }

  // Carga progresiva: el resto del observatorio funciona sin Sketchfab.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        loadBackground();
      }
    }, { rootMargin: '220px 0px', threshold: 0 });
    observer.observe(stage);
  } else {
    loadBackground();
  }
}
