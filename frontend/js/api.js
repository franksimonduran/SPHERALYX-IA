// Estado de consulta compartido; no contiene observaciones, fuentes o trayectorias artificiales.
export const state = { ra: 83.8221, dec: -5.3911, selected: null };
export const events = new EventTarget();
export function update(patch) {
  Object.assign(state, patch);
  events.dispatchEvent(new Event('change'));
}

// Solo APIs de archivos astronómicos y catálogos reales; sin fallback a datos ficticios.
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
