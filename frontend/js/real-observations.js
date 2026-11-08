// Presentación de metadatos SIA: no certifica cobertura, calibración ni compatibilidad.
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;

export function normalizeObservations(rows) {
  const seen = new Set(), result = [];
  for (const raw of rows) {
    const id = text(raw?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const mjd = typeof raw.time_start_mjd === 'number' && Number.isFinite(raw.time_start_mjd) ? raw.time_start_mjd : null;
    // Astropy devuelve UTC sin sufijo; añadir Z evita interpretar la fecha como hora local.
    const utc = text(raw.observation_time_utc);
    const utcMs = utc && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z)?$/.test(utc)
      ? Date.parse(utc.endsWith('Z') ? utc : `${utc}Z`) : NaN;
    const mjdMs = mjd === null ? NaN : (mjd - 40587) * 86400000;
    const timeMs = Number.isFinite(mjdMs) && Number.isFinite(new Date(mjdMs).getTime()) ? mjdMs : utcMs;
    const day = Number.isFinite(timeMs) ? new Date(timeMs).toISOString().slice(0, 10) : null;
    result.push({id, raw, mjd, utc: Number.isFinite(utcMs) ? utc : null, timeMs: Number.isFinite(timeMs) ? timeMs : null,
      day, collection: text(raw.collection) || text(raw.release), release: text(raw.release), band: text(raw.band),
      detector: text(raw.detector), coverage: text(raw.coverage_region), state: 'disponible'});
  }
  return result.sort((a, b) => a.timeMs === null ? (b.timeMs === null ? 0 : 1) :
    b.timeMs === null ? -1 : a.timeMs - b.timeMs);
}

export function createObservationList(container, onSelect) {
  const controls = document.createElement('div'); controls.className = 'observation-filters';
  const rows = document.createElement('div'); rows.className = 'observation-rows';
  const message = document.createElement('p'); message.className = 'observation-filter-message';
  message.setAttribute('role', 'status');
  const filters = {};
  for (const [key, label] of [['day','Fecha UTC'], ['collection','Colección'], ['band','Banda'], ['detector','Detector']]) {
    const wrapper = document.createElement('label'); wrapper.textContent = label;
    const select = document.createElement('select'); select.dataset.filter = key;
    select.setAttribute('aria-label', `Filtrar observaciones por ${label.toLowerCase()}`);
    wrapper.append(select); controls.append(wrapper); filters[key] = select;
    select.addEventListener('change', render);
  }
  container.replaceChildren(controls, message, rows);
  let items = [], selected = null;
  const labels = {disponible:'Disponible', cargando:'Vista previa cargando', recuperada:'Vista recuperada', error:'Error al recuperar vista'};
  function populate() {
    for (const [key, select] of Object.entries(filters)) {
      const previous = select.value;
      const values = [...new Set(items.map(item => item[key]).filter(Boolean))].sort();
      select.replaceChildren(new Option('Todas', ''));
      values.forEach(value => select.add(new Option(value, value)));
      select.value = values.includes(previous) ? previous : '';
    }
  }
  function render() {
    const focusedId = container.contains(document.activeElement) ? document.activeElement?.dataset.id : null;
    rows.replaceChildren();
    const visible = items.filter(item => Object.entries(filters).every(([key, select]) => !select.value || item[key] === select.value));
    message.textContent = items.length ? `${visible.length} de ${items.length} productos · metadatos SIA, no compatibilidad validada.` : '';
    let missingHeading = false;
    for (const item of visible) {
      if (item.timeMs === null && !missingHeading) {
        const heading = document.createElement('p'); heading.className = 'observation-date-heading'; heading.textContent = 'Fecha no disponible';
        rows.append(heading); missingHeading = true;
      }
      const button = document.createElement('button'); button.type = 'button'; button.className = 'candidate-row real-observation-row';
      button.dataset.id = item.id; button.dataset.state = item.state;
      button.setAttribute('aria-pressed', String(selected === item.id));
      const date = item.utc ? `${item.utc.replace(/Z$/, '')} UTC` : item.mjd !== null && item.timeMs !== null ? `MJD ${item.mjd}` : 'Fecha no disponible';
      const parts = [text(item.raw.observation_id) || 'Sin identificador', date,
        item.collection || item.release || 'Colección no disponible', item.band || 'Banda no disponible',
        item.detector ? `Detector: ${item.detector}` : 'Detector no disponible', `REAL · IRSA · ${labels[item.state]}`];
      button.textContent = parts.join(' · ');
      if (item.coverage) button.title = `Cobertura SIA: ${item.coverage}. La intersección no garantiza cobertura del centro.`;
      button.addEventListener('click', () => onSelect(item)); rows.append(button);
    }
    if (items.length && !visible.length) message.textContent = 'Ninguna observación coincide con los filtros seleccionados.';
    if (focusedId) [...rows.querySelectorAll('button[data-id]')].find(button => button.dataset.id === focusedId)?.focus({preventScroll:true});
  }
  populate(); render();
  return {
    setItems(next) { items = next; selected = null; for (const select of Object.values(filters)) select.value = ''; populate(); render(); },
    setSelected(id) { selected = id; render(); },
    setState(id, state) { const item = items.find(row => row.id === id); if (item) { item.state = state; render(); } },
  };
}
