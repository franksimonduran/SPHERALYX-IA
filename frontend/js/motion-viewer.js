// Visualización de resultados sintéticos; no calcula asociaciones ni mediciones.
const names={stationary:'Estacionaria compatible',possibly_moving:'Posiblemente móvil',ambiguous:'Ambigua',insufficient:'Insuficiente evidencia'};
const colors={stationary:'#70dcff',possibly_moving:'#ffad5b',ambiguous:'#ff6c83',insufficient:'#c4cad4'};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const fmt=n=>finite(n)?n.toFixed(3):'No disponible';
const vector=v=>Array.isArray(v)&&v.length===2&&v.every(finite)?v.map(fmt).join(', '):'No disponible';
export function validateMotionResult(data){
  if(!data || !Array.isArray(data.images) || !data.images.length || !data.images.every(s=>typeof s==='string'&&s.startsWith('data:image/png;base64,')) || !Array.isArray(data.registration) || data.registration.length!==data.images.length || !Array.isArray(data.tracks)) throw Error('Respuesta de imágenes o trayectorias inválida');
  if(!data.registration.every(r=>r && (r.shift_px===null || (Array.isArray(r.shift_px)&&r.shift_px.length===2&&r.shift_px.every(finite))))) throw Error('Registro sintético inválido');
  if(!data.tracks.every(t=>t && (typeof t.id==='number'||typeof t.id==='string') && Object.hasOwn(names,t.class) && Array.isArray(t.points) && t.points.every(p=>Number.isInteger(p.epoch)&&p.epoch>=0&&p.epoch<data.images.length&&finite(p.x)&&finite(p.y)))) throw Error('Trayectoria sintética inválida');
}
export function createMotionViewer(data){
  validateMotionResult(data);
  const root=document.createElement('section');root.className='motion-explorer';root.setAttribute('aria-label','Visor de experimento sintético multiepoca');
  root.innerHTML=`<div class="motion-viewer-main"><strong class="motion-badge">EXPERIMENTO SINTÉTICO · NO SPHEREx</strong><p>PNG original de cada época; marcas registradas transformadas a la imagen de esa época. Sin registro no se dibujan marcas.</p><div class="motion-stage"><img alt="Imagen sintética de la época seleccionada"><canvas width="128" height="128" aria-label="Marcadores sintéticos; selecciona una trayectoria en la lista"></canvas></div><label>Época sintética <input class="motion-epoch" type="range" min="0" step="1"><output class="motion-epoch-label"></output></label><div class="motion-toggles"><label><input class="motion-labels" type="checkbox"> Etiquetas</label><label><input class="motion-trails" type="checkbox" checked> Trayectorias</label></div><p>Azul: estacionaria compatible · naranja: posiblemente móvil · rojo: ambigua · gris: insuficiente evidencia. Son clasificaciones heurísticas sintéticas.</p></div><aside class="motion-details"><h4>Resultados sintéticos</h4><label>Seleccionar trayectoria <select class="motion-select"><option value="">Ninguna</option></select></label><div class="motion-detail" role="status" aria-live="polite"></div></aside>`;
  const image=root.querySelector('img'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),epoch=root.querySelector('.motion-epoch'),epochLabel=root.querySelector('.motion-epoch-label'),select=root.querySelector('.motion-select'),detail=root.querySelector('.motion-detail'),labels=root.querySelector('.motion-labels'),trails=root.querySelector('.motion-trails');
  epoch.max=String(data.images.length-1);epoch.value='0';
  data.tracks.forEach((track,i)=>select.add(new Option(`${track.id} · ${names[track.class]}`,String(i))));
  function renderDetail(){
    detail.replaceChildren();const track=select.value===''?null:data.tracks[Number(select.value)];
    if(!track){detail.textContent=data.tracks.length?'Selecciona una trayectoria existente.':'No hay trayectorias detectadas.';return;}
    const rows=[['Fuente',String(track.id)],['Categoría',names[track.class]],['Posiciones y épocas (píxeles registrados)',track.points.length?track.points.map(p=>`Época ${p.epoch+1}: ${fmt(p.x)}, ${fmt(p.y)} · σ ${fmt(p.sigma_total)} px`).join(' | '):'No disponible'],['Desplazamiento este/norte (arcsec)',vector(track.displacement_east_north_arcsec)],['σ desplazamiento por eje (arcsec)',fmt(track.displacement_sigma_per_axis_arcsec)],['Velocidad este/norte (arcsec/día)',vector(track.velocity_east_north_arcsec_day)],['σ velocidad por eje (arcsec/día)',fmt(track.velocity_sigma_per_axis_arcsec_day)],['Residuo reducido heurístico',fmt(track.reduced_residual_heuristic)]];
    const dl=document.createElement('dl');for(const [key,value] of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;dl.append(dt,dd);}detail.append(dl);
  }
  function draw(){
    const e=Number(epoch.value),shift=data.registration[e].shift_px;image.src=data.images[e];image.alt=`Imagen sintética, época ${e+1}`;epochLabel.textContent=` ${e+1} / ${data.images.length} · registro ${shift?shift.map(fmt).join(', ')+' px':'No disponible'}`;
    ctx.clearRect(0,0,128,128);if(!shift)return;
    const selected=select.value===''?-1:Number(select.value);
    data.tracks.forEach((track,i)=>{const point=track.points.find(p=>p.epoch===e);if(!point)return;const x=point.x+shift[0],y=point.y+shift[1];ctx.strokeStyle=colors[track.class];ctx.fillStyle=colors[track.class];ctx.lineWidth=i===selected?1.2:.6;
      if(trails.checked){const prior=track.points.filter(p=>p.epoch<=e);ctx.beginPath();prior.forEach((p,j)=>j?ctx.lineTo(p.x+shift[0],p.y+shift[1]):ctx.moveTo(p.x+shift[0],p.y+shift[1]));ctx.stroke();}
      ctx.beginPath();ctx.arc(x,y,i===selected?3:2,0,2*Math.PI);ctx.stroke();if(labels.checked){ctx.font='3px sans-serif';ctx.fillText(String(track.id),x+3,y-2);}
    });
  }
  select.addEventListener('change',()=>{renderDetail();draw();});epoch.addEventListener('input',draw);labels.addEventListener('change',draw);trails.addEventListener('change',draw);
  canvas.addEventListener('click',event=>{const shift=data.registration[Number(epoch.value)].shift_px;if(!shift)return;const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*128/rect.width,y=(event.clientY-rect.top)*128/rect.height;let best=-1,distance=5;data.tracks.forEach((track,i)=>{const p=track.points.find(p=>p.epoch===Number(epoch.value));if(!p)return;const d=Math.hypot(p.x+shift[0]-x,p.y+shift[1]-y);if(d<distance){distance=d;best=i;}});if(best>=0){select.value=String(best);renderDetail();draw();}});
  renderDetail();draw();return root;
}
