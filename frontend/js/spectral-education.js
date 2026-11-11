/* Comparador educativo de mosaicos NIRCam alineados (ESA Webb, 2023).
   No es comparación temporal, no procesa FITS, no mide movimiento.
   Ambas capas comparten el mismo encuadre y zoom; el deslizador revela A. */
export function initSpectralEducation() {
  const root = document.getElementById('calibracion-educativa');
  if (!root) return;
  const viewer = root.querySelector('.spectral-demo-viewer');
  const slider = root.querySelector('#spectral-reveal');
  const output = root.querySelector('#spectral-reveal-value');
  const shortButton = root.querySelector('#spectral-only-short');
  const longButton = root.querySelector('#spectral-only-long');
  const resetButton = root.querySelector('#spectral-reset');
  const zoomIn = root.querySelector('#spectral-zoom-in');
  const zoomOut = root.querySelector('#spectral-zoom-out');
  const zoomValue = root.querySelector('#spectral-zoom-value');
  const imageError = root.querySelector('#spectral-image-error');
  if (![viewer, slider, output, shortButton, longButton, resetButton, zoomIn, zoomOut, zoomValue].every(Boolean)) return;

  let zoom = 1;
  const setReveal = value => {
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    slider.value = String(n);
    viewer.style.setProperty('--spectral-reveal', n + '%');
    output.value = n + '%';
    output.textContent = n + '%';
    slider.setAttribute('aria-valuetext', n + '% del canal de onda corta visible');
    shortButton.setAttribute('aria-pressed', String(n === 100));
    longButton.setAttribute('aria-pressed', String(n === 0));
  };
  const setZoom = value => {
    zoom = Math.max(1, Math.min(2, Math.round(value * 10) / 10));
    viewer.style.setProperty('--spectral-zoom', String(zoom));
    zoomValue.textContent = zoom.toFixed(1) + '×';
    zoomOut.disabled = zoom <= 1;
    zoomIn.disabled = zoom >= 2;
  };

  slider.addEventListener('input', () => setReveal(slider.value));
  shortButton.addEventListener('click', () => setReveal(100));
  longButton.addEventListener('click', () => setReveal(0));
  resetButton.addEventListener('click', () => { setReveal(50); setZoom(1); });
  zoomIn.addEventListener('click', () => setZoom(zoom + .2));
  zoomOut.addEventListener('click', () => setZoom(zoom - .2));
  root.querySelectorAll('.spectral-layer img').forEach(img => {
    img.addEventListener('error', () => {
      if (imageError) imageError.hidden = false;
    });
    if (img.complete && !img.naturalWidth && img.currentSrc) {
      if (imageError) imageError.hidden = false;
    }
  });
  setReveal(50);
  setZoom(1);
}
