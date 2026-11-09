// Datos locales de demostración: no representan observaciones ni hallazgos reales.
export const observations = Array.from({ length: 8 }, (_, index) => ({ index, label: `Época ${String(index + 1).padStart(2, '0')}` }));
export const candidates = [
  { id: 'SIM-001', type: 'movimiento', name: 'Candidato de movimiento A', x: .38, y: .43, dx: .012, dy: -.006, signal: 'Movimiento aparente', description: 'Una fuente sintética cambia de posición entre las épocas de ejemplo.', explanation: 'El desplazamiento es parte de la simulación; no demuestra la existencia de un objeto real.' },
  { id: 'SIM-002', type: 'movimiento', name: 'Candidato de movimiento B', x: .68, y: .61, dx: -.009, dy: .008, signal: 'Movimiento aparente', description: 'Una segunda fuente sintética sigue una trayectoria diferente.', explanation: 'Su trayectoria se genera localmente para ilustrar una comparación temporal.' },
  { id: 'SIM-003', type: 'variabilidad', name: 'Candidato variable C', x: .57, y: .28, dx: 0, dy: 0, signal: 'Variación de brillo', description: 'Una fuente sintética cambia de brillo a lo largo de la secuencia.', explanation: 'La variación se ha programado para la demostración y no corresponde a una medición.' },
];
export const state = { ra: 83.8221, dec: -5.3911, epoch: 0, zoom: 1, grid: true, labels: true, markers: true, selected: null };
export const events = new EventTarget();
export function update(patch) { Object.assign(state, patch); events.dispatchEvent(new Event('change')); }
export function position(candidate, epoch) { return { x: candidate.x + candidate.dx * epoch, y: candidate.y + candidate.dy * epoch }; }

// Cliente REAL aislado del estado DEMO; no existe fallback automático a datos ficticios.
async function apiRequest(path, options) {
  const timeout = AbortSignal.timeout(path === '/api/temporal/pairs' ? 180000 : 120000);
  const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response;
  try { response = await fetch(path, {...options, signal}); }
  catch (error) { if (timeout.aborted && !options?.signal?.aborted) throw new Error('Tiempo de espera agotado'); throw error; }
  if (!response.ok) {
    let message = `Error HTTP ${response.status}`;
    try { const data = await response.json(); if (typeof data.detail === 'string') message = data.detail; } catch { /* respuesta no JSON */ }
    throw new Error(message);
  }
  return response;
}
export const realApi = {
  async search({ra, dec, radius, release}, signal) {
    const params = new URLSearchParams({ra, dec, radius, release});
    return (await apiRequest(`/api/observations?${params}`, {signal})).json();
  },
  async observation(id, signal) { return (await apiRequest(`/api/observations/${encodeURIComponent(id)}`, {signal})).json(); },
  async preview(id, signal) { return apiRequest(`/api/observations/${encodeURIComponent(id)}/preview`, {signal}); },
  async compare(a, b, signal) { return (await apiRequest('/api/temporal/compare', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({a,b}), signal})).json(); },
  async findPairs(params, signal) { return (await apiRequest('/api/temporal/pairs', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params),signal})).json(); },
  async gaiaSources({ra, dec, radius, limit = 120}, signal) {
    const params = new URLSearchParams({ra, dec, radius, limit});
    return (await apiRequest(`/api/gaia/sources?${params}`, {signal})).json();
  },
  async wiseSources({ra, dec, radius, limit = 120}, signal) {
    const params = new URLSearchParams({ra, dec, radius, limit});
    return (await apiRequest(`/api/wise/sources?${params}`, {signal})).json();
  },
};
