import { initClassificationLab } from './classification-lab.js';
// Laboratorio aislado: únicamente genera y evalúa imágenes sintéticas.
export function initValidationLab(container) {
  const panel = document.createElement('section');
  panel.id = 'validation-lab';
  panel.className = 'panel validation-lab';
  panel.innerHTML = `
    <span class="kicker">EVALUACIÓN SINTÉTICA · NO SON DATOS SPHEREx</span>
    <h3>AstroMotion Validation Lab</h3>
    <p>Compara asociaciones conservadoras con vecino más cercano sobre los mismos campos artificiales. Sin aprendizaje automático ni descubrimientos NASA.</p>
    <form class="real-form" id="validation-form">
      <label>Fuentes por escenario <input name="source_count" type="number" min="0" max="100" value="30" required></label>
      <label>Ruido (σ píxel) <input name="noise" type="number" min="1" max="30" step="0.5" value="5" required></label>
      <label>Densidad <select name="density"><option value="sparse">Dispersa</option><option value="dense">Densa</option></select></label>
      <label>Desplazamiento móvil (px) <input name="displacement" type="number" min="0" max="12" step="0.5" value="4" required></label>
      <label>PSF <select name="psf"><option value="constant">Constante</option><option value="variable">Variable</option></select></label>
      <label>Escenarios <input name="scenarios" type="number" min="1" max="20" value="5" required></label>
      <label>Semilla inicial <input name="seed" type="number" min="0" max="1000000" value="42" required></label>
      <label>Artefactos por época <input name="artifacts" type="number" min="0" max="20" value="2" required></label>
      <label>Tolerancia (px) <input name="tolerance" type="number" min="0.5" max="12" step="0.5" value="6" required></label>
      <button class="button primary" type="submit">Ejecutar evaluación</button>
    </form>
    <p class="real-status" role="status" aria-live="polite">Sin evaluación ejecutada.</p>
    <progress hidden aria-label="Evaluación sintética en curso"></progress>
    <div class="validation-results"></div>
    <p class="fine-print">Las métricas evalúan asociaciones, no detección de movimiento. Los intervalos bootstrap describen estos escenarios generados; no validan observaciones reales.</p>`;
  container.append(panel);
  initClassificationLab(panel);
  const form = panel.querySelector('form'), status = panel.querySelector('[role=status]');
  const progress = panel.querySelector('progress'), output = panel.querySelector('.validation-results');
  const button = form.querySelector('button');
  const format = value => value == null ? '—' : Number(value).toFixed(3);
  const node = (tag, text) => { const item = document.createElement(tag); item.textContent = text; return item; };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = new FormData(form);
    const params = Object.fromEntries(fields);
    for (const key of ['source_count', 'noise', 'displacement', 'scenarios', 'seed', 'artifacts', 'tolerance']) params[key] = Number(params[key]);
    button.disabled = true; progress.hidden = false; output.replaceChildren();
    status.textContent = 'Evaluación en curso; progreso indeterminado hasta recibir el lote completo.';
    try {
      const response = await fetch('/api/experimental/validation', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(params), signal:AbortSignal.timeout(120000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      output.append(node('p', `EVALUACIÓN SINTÉTICA · ${data.scenarios.length} escenarios · ${format(data.elapsed_seconds)} s · semillas ${data.scenarios.map(s=>s.seed).join(', ')}.`));
      output.append(node('p', `Aristas ambiguas: ${data.ambiguity.ambiguous_edges}/${data.ambiguity.candidate_edges} · tasa ${format(data.ambiguity.rate)}.`));
      const scroll = document.createElement('div'); scroll.className = 'validation-scroll';
      const table = document.createElement('table');
      table.innerHTML = '<caption>Resultados agregados por método</caption><thead><tr><th>Método</th><th>VP</th><th>FP</th><th>FN</th><th>Precisión</th><th>Recuperación</th><th>F1</th><th>Error medio (arcsec)</th></tr></thead>';
      const tbody = document.createElement('tbody');
      for (const [key, label] of [['conservative','Conservador'],['baseline','Vecino voraz']]) {
        const metrics = data.methods[key], row = document.createElement('tr');
        for (const value of [label, metrics.tp, metrics.fp, metrics.fn, format(metrics.precision), format(metrics.recall), format(metrics.f1), format(metrics.mean_error_arcsec)]) row.append(node('td', String(value)));
        tbody.append(row);
      }
      table.append(tbody); scroll.append(table); output.append(scroll);
      const graph = document.createElement('div'); graph.className = 'validation-chart';
      graph.setAttribute('aria-label', 'Gráfico de precisión, recuperación y F1 por método');
      for (const [key, label] of [['conservative','Conservador'],['baseline','Vecino voraz']]) {
        const metrics = data.methods[key]; graph.append(node('h4', label));
        for (const [metric, title] of [['precision','Precisión'],['recall','Recuperación'],['f1','F1']]) {
          const line = document.createElement('div'); line.className = 'validation-bar';
          line.append(node('span', `${title}: ${format(metrics[metric])}`));
          if (metrics[metric] == null) line.append(node('span', 'Sin datos'));
          else {
            const meter = document.createElement('meter'); meter.min = 0; meter.max = 1; meter.value = metrics[metric];
            meter.setAttribute('aria-label', `${label} ${title}: ${format(metrics[metric])}`); line.append(meter);
          }
          const ci = metrics.bootstrap_95[metric]; line.append(node('small', ci ? `IC bootstrap 95 %: ${format(ci[0])}–${format(ci[1])}` : 'IC no disponible'));
          graph.append(line);
        }
        const dist = metrics.error_distribution_arcsec;
        graph.append(node('p', `Error absoluto: n=${dist.count}, mediana ${format(dist.p50)}, p90 ${format(dist.p90)} arcsec.`));
      }
      output.append(graph);
      const details = document.createElement('details'); details.append(node('summary','Resultados por escenario'));
      for (const s of data.scenarios) details.append(node('p', `Semilla ${s.seed}: detecciones ${s.detections.join('/')}; conservador VP/FP/FN ${s.conservative.tp}/${s.conservative.fp}/${s.conservative.fn}; base ${s.baseline.tp}/${s.baseline.fp}/${s.baseline.fn}; ${format(s.elapsed_seconds)} s.`));
      output.append(details);
      data.warnings.forEach(warning => output.append(node('p', warning)));
      status.textContent = 'Evaluación sintética completada.';
    } catch (error) { status.textContent = `No se pudo ejecutar la evaluación: ${error.message}`; }
    finally { button.disabled = false; progress.hidden = true; }
  });
}
