import { candidates, state, events, update } from './api.js';
import { initValidationLab } from './validation-lab.js';

export function initAnalysis() {
  initValidationLab(document.querySelector('#analisis'));
  const experiment = document.createElement('div');
  experiment.id = 'single-motion-experiment';
  experiment.className = 'panel';
  experiment.style.marginTop = '1rem';
  experiment.innerHTML = `<h3>EXPERIMENTO SINTÉTICO · AstroMotion</h3><p>Detector tradicional sobre FITS generados; no son datos SPHEREx ni descubrimientos. Sin red neuronal.</p><button class="button primary" type="button">Ejecutar experimento sintético</button><p role="status" aria-live="polite"></p><div></div>`;
  document.querySelector('#analisis').append(experiment);
  const button = experiment.querySelector('button'), status = experiment.querySelector('[role=status]'), result = experiment.lastElementChild;
  button.addEventListener('click', async () => {
    button.disabled = true; status.textContent = 'Calculando FITS y detecciones…'; result.replaceChildren();
    try {
      const response = await fetch('/api/experimental/motion', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}', signal:AbortSignal.timeout(120000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${data.size} ${data.size}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Detecciones y trayectorias sintéticas, época A en azul y B en naranja');
      svg.style.cssText = 'width:min(100%,400px);background:#06101e;display:block';
      const element = (name, attrs) => { const node = document.createElementNS(svg.namespaceURI, name); for (const [k,v] of Object.entries(attrs)) node.setAttribute(k, v); svg.append(node); };
      for (const m of data.measurements) element('line', {x1:m.a.x,y1:m.a.y,x2:m.b.x,y2:m.b.y,stroke:'#fff','stroke-width':'.7'});
      data.detections.forEach((epoch,i)=>epoch.forEach(p=>element('circle',{cx:p.x,cy:p.y,r:1.5,fill:i?'#ffad5b':'#70dcff'})));
      result.append(svg);
      const summary = document.createElement('p'); const m = data.metrics;
      const fmt = n => n == null ? 'no definido' : Number(n).toFixed(3);
      summary.textContent = `Asociaciones: VP ${m.true_positive}, FP ${m.false_positive}, FN ${m.false_negative}; precisión ${fmt(m.precision)}, recuperación ${fmt(m.recall)}, error medio ${fmt(m.mean_absolute_displacement_error_arcsec)} arcsec; aristas ambiguas ${data.ambiguous_edges}.`;
      result.append(summary);
      const table = document.createElement('table');
      table.innerHTML = '<caption>Mediciones sintéticas (A → B)</caption><thead><tr><th>Posición A (px)</th><th>Posición B (px)</th><th>Desplazamiento ± σ (arcsec)</th><th>Velocidad ± σ (arcsec/día)</th></tr></thead>';
      const body = document.createElement('tbody');
      data.measurements.forEach(v=>{const row=document.createElement('tr'); [ `${fmt(v.a.x)}, ${fmt(v.a.y)}`, `${fmt(v.b.x)}, ${fmt(v.b.y)}`, `${fmt(v.displacement_arcsec)} ± ${fmt(v.uncertainty_arcsec)}`, `${fmt(v.velocity_arcsec_day)} ± ${fmt(v.uncertainty_velocity_arcsec_day)}` ].forEach(text=>{const cell=document.createElement('td');cell.textContent=text;row.append(cell)});body.append(row)});
      table.append(body); const wrapper=document.createElement('div'); wrapper.style.overflowX='auto';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','Tabla desplazable de mediciones sintéticas');wrapper.append(table);result.append(wrapper);
      data.warnings.forEach(w=>{const p=document.createElement('p');p.textContent=w;result.append(p)});
      status.textContent = 'EXPERIMENTO SINTÉTICO calculado por el backend.';
    } catch (error) { status.textContent = `No se pudo ejecutar el experimento sintético: ${error.message}`; }
    finally { button.disabled = false; }
  });
  const output=document.querySelector('#analysis-output');
  document.querySelector('#run-analysis').addEventListener('click',()=>{output.className='';output.innerHTML=candidates.map(c=>`<article class="analysis-item"><span>SIMULADO</span><strong>${c.id} · ${c.signal}</strong><p>${c.description} ${c.explanation}</p></article>`).join('');});
  const filter=document.querySelector('#candidate-filter'),search=document.querySelector('#candidate-search'),list=document.querySelector('#candidate-list'),detail=document.querySelector('#candidate-detail');
  let renderedFilter = null;
  function render(){const query=search.value.trim().toLocaleLowerCase('es'),visible=candidates.filter(c=>(filter.value==='all'||c.type===filter.value)&&[c.id,c.name,c.signal,c.type,c.description].some(value=>value.toLocaleLowerCase('es').includes(query)));document.querySelector('#candidate-count').textContent=`/ ${visible.length}`;document.querySelector('#candidate-search-status').textContent=`${visible.length} de ${candidates.length} casos sintéticos`;const key=filter.value+'\u0000'+query;if(renderedFilter!==key){list.innerHTML=visible.length?visible.map(c=>`<button class="candidate-row" data-id="${c.id}" type="button"><span><strong>${c.id} · ${c.name}</strong><small>${c.signal} · CASO SINTÉTICO</small></span><span aria-hidden="true">↗</span></button>`).join(''):'<p class="empty-list">No hay candidatos para esta búsqueda o filtro.</p>';renderedFilter=key;}list.querySelectorAll('[data-id]').forEach(button=>{const selected=button.dataset.id===state.selected;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});const selected=candidates.find(c=>c.id===state.selected);detail.innerHTML=selected?`<span class="kicker">DETALLE DEL CANDIDATO · SIMULADO</span><h3 class="detail-title">${selected.id}</h3><span class="demo-pill">${selected.name}</span><p class="detail-description">${selected.description}</p><div class="detail-grid"><div><small>Señal ilustrativa</small><strong>${selected.signal}</strong></div><div><small>Origen</small><strong>Generado localmente · DEMO</strong></div><div><small>Época actual</small><strong>${String(state.epoch+1).padStart(2,'0')} / 08</strong></div><div><small>Coordenadas reales</small><strong>No disponibles</strong></div></div><p class="detail-note">${selected.explanation} No es una observación ni un descubrimiento científico.</p>`:'<div class="empty-state detail-placeholder"><span>⌖</span><strong>Selecciona un candidato</strong><p>Elige un ejemplo para consultar sus detalles.</p></div>';}
  list.addEventListener('click',e=>{const button=e.target.closest('[data-id]');if(button)update({selected:button.dataset.id});});filter.addEventListener('change',render);search.addEventListener('input',render);events.addEventListener('change',render);render();
}
