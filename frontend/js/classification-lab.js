export function initClassificationLab(parent) {
  const section = document.createElement('section');
  section.id = 'classification-lab';
  section.innerHTML = `<hr><h3>Clasificación multiepoca · EXPERIMENTO SINTÉTICO</h3>
    <p>No son datos SPHEREx ni descubrimientos. El registro usa referencias sintéticas y las incertidumbres son aproximadas.</p>
    <form class="real-form">
      <label>Semilla <input name="seed" type="number" min="0" max="1000000" value="700" required></label>
      <label>Fuentes <input name="source_count" type="number" min="0" max="60" value="20" required></label>
      <label>Épocas <input name="epochs" type="number" min="3" max="6" value="4" required></label>
      <label>Intervalo (días) <input name="interval" type="number" min="1" max="30" value="10" required></label>
      <label>Ruido <input name="noise" type="number" min="1" max="30" value="3" required></label>
      <label>Densidad <select name="density"><option value="sparse">Dispersa</option><option value="dense">Densa</option></select></label>
      <label>PSF <select name="psf"><option value="constant">Constante</option><option value="variable">Variable</option></select></label>
      <label>Desplazamiento / 10 días (px) <input name="displacement" type="number" min="0" max="6" step="0.1" value="3" required></label>
      <label>Fracción móvil <input name="moving_fraction" type="number" min="0" max="1" step="0.1" value="0.4" required></label>
      <label>Error de registro (px) <input name="registration_shift" type="number" min="0" max="2" step="0.1" value="1" required></label>
      <label>Umbral significancia heurística <input name="significance" type="number" min="2.1" max="10" step="0.1" value="4" required></label>
      <button type="submit" class="button primary">Clasificar fuentes sintéticas</button>
    </form><p role="status" aria-live="polite">Sin ejecutar.</p><progress hidden aria-label="Clasificación en curso"></progress><div class="classification-output"></div>`;
  parent.append(section);
  const form = section.querySelector('form'), output = section.querySelector('.classification-output');
  const status = section.querySelector('[role=status]'), progress = section.querySelector('progress');
  const fmt = v => v == null ? '—' : Number(v).toFixed(3);
  const text = (tag, content) => { const n = document.createElement(tag); n.textContent = content; return n; };
  const names = {stationary:'Estacionaria compatible', possibly_moving:'Posiblemente móvil', ambiguous:'Ambigua', insufficient:'Insuficiente evidencia'};
  const colors = {stationary:'#70dcff', possibly_moving:'#ffad5b', ambiguous:'#ff6c83', insufficient:'#c4cad4'};
  form.addEventListener('submit', async event => {
    event.preventDefault(); output.replaceChildren(); progress.hidden = false; form.querySelector('button').disabled = true;
    status.textContent = 'Calculando épocas, registro y clasificación…';
    const params = Object.fromEntries(new FormData(form));
    for (const key of Object.keys(params)) if (!['density', 'psf'].includes(key)) params[key] = Number(params[key]);
    try {
      const response = await fetch('/api/experimental/classification', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(120000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json(), m = data.metrics, c = m.classification;
      output.append(text('p', `Asociación VP/FP/FN: ${m.association.tp}/${m.association.fp}/${m.association.fn} · precisión ${fmt(m.association.precision)} · recuperación ${fmt(m.association.recall)}.`));
      output.append(text('p', `Clasificación móvil VP/FP/FN: ${c.tp}/${c.fp}/${c.fn} · precisión ${fmt(c.precision)} · recuperación ${fmt(c.recall)} · F1 ${fmt(c.f1)} · falsos movimientos ${fmt(c.false_motion_rate)} · ambigüedad ${fmt(c.ambiguity_rate)}.`));
      for (const [key,label] of [['faint','Débiles (pico < 80)'],['bright','Brillantes (pico ≥ 80)']]) {const b=c.by_brightness[key];output.append(text('p',`${label}: ${b.sources} fuentes, VP/FP/FN ${b.tp}/${b.fp}/${b.fn}, recuperación ${fmt(b.recall)}; excluye alertas sin identidad verificable.`));}
      output.append(text('p', `Error vectorial medio ${fmt(m.mean_vector_error_arcsec)} arcsec; velocidad ${fmt(m.mean_velocity_error_arcsec_day)} arcsec/día (solo ${m.error_sample_count} trayectorias correctas completas).`));
      const chart = document.createElement('div'); chart.className = 'validation-chart';
      for (const [key,label] of [['precision','Precisión móvil'],['recall','Recuperación móvil'],['f1','F1 móvil']]) {
        const row=document.createElement('div');row.className='validation-bar';row.append(text('span',`${label}: ${fmt(c[key])}`));
        if(c[key]!=null){const meter=document.createElement('meter');meter.min=0;meter.max=1;meter.value=c[key];meter.setAttribute('aria-label',label);row.append(meter);}else row.append(text('span','Sin datos'));chart.append(row);
      }
      output.append(chart);
      const matrix = document.createElement('div'); matrix.className = 'validation-scroll';
      const table = document.createElement('table'); table.innerHTML='<caption>Matriz: verdad × clasificación (incluye fuentes no detectadas)</caption><thead><tr><th>Verdad</th><th>Estacionaria</th><th>Posiblemente móvil</th><th>Ambigua</th><th>Insuficiente</th></tr></thead>';
      const body=document.createElement('tbody');for(const key of ['stationary','moving']){const row=document.createElement('tr');row.append(text('th',key==='moving'?'Móvil':'Estacionaria'));for(const pred of ['stationary','possibly_moving','ambiguous','insufficient'])row.append(text('td',c.confusion[key][pred]));body.append(row);}table.append(body);matrix.append(table);output.append(matrix);
      const frames=document.createElement('div');frames.className='classification-frames';
      data.images.forEach((url,epoch)=>{const card=document.createElement('figure'), frame=document.createElement('div');frame.className='classification-frame';const img=document.createElement('img');img.src=url;img.alt=`Imagen FITS sintética, época ${epoch+1}`;frame.append(img);
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 128 128');svg.setAttribute('aria-hidden','true');
        const shift=data.registration[epoch].shift_px;
        if(shift) for(const track of data.tracks){const point=track.points.find(p=>p.epoch===epoch);if(!point)continue;const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx',point.x+shift[0]);circle.setAttribute('cy',point.y+shift[1]);circle.setAttribute('r','2');circle.setAttribute('fill','none');circle.setAttribute('stroke',colors[track.class]);circle.setAttribute('stroke-width','.8');svg.append(circle);
          const path=track.points.filter(p=>p.epoch<=epoch).map(p=>`${p.x+shift[0]},${p.y+shift[1]}`).join(' ');const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',path);line.setAttribute('fill','none');line.setAttribute('stroke',colors[track.class]);line.setAttribute('stroke-width','.6');svg.append(line);}
        frame.append(svg);card.append(frame,text('figcaption',`Época ${epoch+1} · registro ${shift?shift.map(fmt).join(', '):'no disponible'} px`));frames.append(card);});output.append(frames);
      output.append(text('p','Azul: compatible con reposo · naranja: posiblemente móvil · rojo: ambigua · gris: evidencia insuficiente.'));
      const scroll=document.createElement('div');scroll.className='validation-scroll';const measurements=document.createElement('table');measurements.innerHTML='<caption>Trayectorias detectadas: valores ajustados este/norte</caption><thead><tr><th>ID</th><th>Clase</th><th>Épocas</th><th>Δ (arcsec)</th><th>Velocidad (arcsec/día)</th><th>σ velocidad por eje</th><th>Residuo reducido</th></tr></thead>';const rows=document.createElement('tbody');
      for(const track of data.tracks){const row=document.createElement('tr');for(const value of [track.id,names[track.class],track.points.length,track.displacement_east_north_arcsec?.map(fmt).join(', ')??'—',track.velocity_east_north_arcsec_day?.map(fmt).join(', ')??'—',fmt(track.velocity_sigma_per_axis_arcsec_day),fmt(track.reduced_residual_heuristic)])row.append(text('td',value));rows.append(row);}measurements.append(rows);scroll.append(measurements);output.append(scroll);
      data.warnings.forEach(w=>output.append(text('p',w)));status.textContent='Clasificación sintética completada.';
    } catch(error) {status.textContent=`No se pudo clasificar: ${error.message}`;}
    finally {progress.hidden=true;form.querySelector('button').disabled=false;}
  });
}
