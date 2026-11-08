import { realApi } from './api.js';
import { normalizeObservations } from './real-observations.js';

export function initRealComparison() {
  const a=document.querySelector('#real-a'), b=document.querySelector('#real-b');
  const form=document.querySelector('#compare-real-form'), status=document.querySelector('#compare-real-status');
  const submit=form.querySelector('button[type="submit"]');
  const panel=document.querySelector('#compare-real-views'), view=document.querySelector('#compare-real-image');
  const overlay=document.querySelector('#compare-real-overlay'), selector=document.querySelector('#compare-view');
  const play=document.querySelector('#compare-play'), pairs=document.querySelector('#pair-results');
  const find=document.querySelector('#find-pairs'), offline=document.querySelector('#offline-mode');
  let result=null, timer=null, request=null, pairRequest=null, index=0;
  const slots = new Map();
  for (const [select, name] of [[a,'A'],[b,'B']]) {
    const section=document.createElement('section'); section.className='temporal-individual';
    const title=document.createElement('h4'); title.textContent=`Observación ${name} · REAL · sin alinear`;
    const description=document.createElement('p'); description.setAttribute('role','status');
    const controls=document.createElement('div'); controls.className='real-viewer-toolbar'; controls.setAttribute('role','group'); controls.setAttribute('aria-label',`Navegación visual ${name}`);
    const viewport=document.createElement('div'); viewport.className='temporal-viewport'; viewport.tabIndex=0; viewport.setAttribute('role','region'); viewport.setAttribute('aria-label',`PNG independiente ${name}; flechas para desplazar`);
    const image=document.createElement('img'); image.alt=`PNG real independiente ${name}, sin alinear`; image.hidden=true; viewport.append(image);
    section.append(title,description,controls,viewport); document.querySelector('#temporal-individuals').append(section);
    let controller=null, url=null, zoom=1, x=0, y=0;
    const buttons=[];
    function render(){image.style.transform=`translate(${x}px, ${y}px) scale(${zoom})`;for(const button of buttons)button.disabled=image.hidden;}
    function reset(){zoom=1;x=0;y=0;render();}
    for(const [label,action] of [['Alejar',()=>{zoom=Math.max(1,zoom-.25);if(zoom===1){x=0;y=0;}}],['Ajustar',()=>{zoom=1;x=0;y=0;}],['Acercar',()=>{zoom=Math.min(4,zoom+.25);}]] ){
      const button=document.createElement('button');button.type='button';button.className='real-viewer-button';button.textContent=label;button.setAttribute('aria-label',`${label} observación ${name}`);button.addEventListener('click',()=>{action();render();});controls.append(button);buttons.push(button);
    }
    viewport.addEventListener('keydown',event=>{if(image.hidden||zoom<=1)return;const moves={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};if(!moves[event.key])return;event.preventDefault();x+=moves[event.key][0];y+=moves[event.key][1];render();});
    function clearSlot(){if(controller)controller.abort();controller=null;if(url)URL.revokeObjectURL(url);url=null;image.hidden=true;image.removeAttribute('src');reset();description.textContent='No disponible · selecciona una observación real.';}
    async function load(){clearSlot();if(!select.value)return;if(offline.checked){description.textContent='No disponible · modo offline.';return;}const id=select.value;const current=new AbortController();controller=current;description.textContent='Descargando PNG real de IRSA…';
      try{const response=await realApi.preview(id,current.signal);const blob=await response.blob();if(controller!==current||current.signal.aborted)return;url=URL.createObjectURL(blob);image.src=url;image.hidden=false;description.textContent=`${select.selectedOptions[0].textContent} · NASA/IPAC IRSA · PNG independiente sin alinear.`;render();}
      catch(error){if(controller===current&&!current.signal.aborted)description.textContent=`Error · PNG no disponible: ${error.message}`;}
      finally{if(controller===current)controller=null;}
    }
    image.addEventListener('error',()=>{image.hidden=true;render();description.textContent='Error · PNG no disponible o ilegible.';});
    slots.set(select,{load,clear:clearSlot});clearSlot();
  }
  function stop(){if(timer!==null)clearInterval(timer);timer=null;play.textContent='Reproducir A / B';play.setAttribute('aria-pressed','false');}
  function clear(){stop();play.disabled=true;if(request)request.abort();request=null;submit.disabled=false;form.removeAttribute('aria-busy');result=null;panel.hidden=true;view.removeAttribute('src');overlay.removeAttribute('src');overlay.hidden=true;selector.replaceChildren();document.querySelector('#compare-real-meta').textContent='';}
  function clearPairs(){if(pairRequest)pairRequest.abort();pairRequest=null;find.disabled=false;pairs.replaceChildren();}
  window.addEventListener('real-observations',event=>{
    clear();clearPairs();for(const slot of slots.values())slot.clear();
    for(const select of [a,b]){select.replaceChildren(new Option('Selecciona una observación',''));for(const item of normalizeObservations(event.detail)){const label=`${item.utc ? item.utc.replace(/Z$/, '')+' UTC' : item.mjd !== null ? 'MJD '+item.mjd : 'Fecha desconocida'} · ${item.collection || 'colección desconocida'} · ${item.detector || 'detector desconocido'} · ${item.band || 'banda desconocida'} · ${item.raw.observation_id || 'Sin ID'}`;select.add(new Option(label,item.id));}}
    status.textContent=event.detail.length?'Selecciona dos exposiciones reales de la búsqueda.':'Primero realiza una búsqueda real en IRSA.';
  });
  // Cambiar parámetros invalida resultados, incluso si el servidor no puede cancelar su trabajo.
  for(const id of ['#ra','#dec','#real-radius','#real-release']){
    const input=document.querySelector(id);
    input.addEventListener('input',clearPairs);
    input.addEventListener('change',clearPairs);
  }
  for(const select of [a,b]) select.addEventListener('change',()=>{clear();slots.get(select).load();status.textContent='Selección modificada; ejecuta una comparación nueva.';});
  offline.addEventListener('change',()=>{if(offline.checked){clear();clearPairs();for(const slot of slots.values())slot.clear();status.textContent='DEMO OFFLINE · Comparación real desactivada.';}});
  find.addEventListener('click',async()=>{
    if(offline.checked){pairs.textContent='DEMO OFFLINE · Búsqueda de pares desactivada.';return;}
    const raField=document.querySelector('#ra'),decField=document.querySelector('#dec'),radiusField=document.querySelector('#real-radius');
    const ra=Number(raField.value),dec=Number(decField.value),radius=Number(radiusField.value),release=document.querySelector('#real-release').value;
    if(!raField.value||!decField.value||!radiusField.value||!Number.isFinite(ra)||!Number.isFinite(dec)||!Number.isFinite(radius)||ra<0||ra>=360||dec< -90||dec>90||radius<=0||radius>.25){pairs.textContent='Coordenadas o radio no válidos.';return;}
    clearPairs();const controller=new AbortController();pairRequest=controller;find.disabled=true;
    pairs.textContent='Buscando hasta tres pares; esto puede tardar mientras IRSA entrega los recortes…';
    try{
      const data=await realApi.findPairs({ra,dec,radius,release,max_pairs:3},controller.signal);
      if(pairRequest!==controller||controller.signal.aborted)return;
      pairs.replaceChildren();const summary=document.createElement('p');
      summary.textContent=`${data.evaluated_count} pares evaluados de ${data.candidates_prefiltered} prefiltrados; ${data.accepted_count} aceptados de forma exploratoria. ${data.notice}`;pairs.append(summary);
      for(const pair of data.pairs){
        const block=document.createElement('article');block.className='pair-result';const detail=document.createElement('p');
        detail.textContent=`${pair.status.toUpperCase()} · ${pair.detector} · ${pair.release} · A: ${pair.a.observation_id} (${pair.a.observation_time_utc || pair.a.time_start_mjd}) · B: ${pair.b.observation_id} (${pair.b.observation_time_utc || pair.b.time_start_mjd}) · Cobertura: ${pair.coverage_fraction == null ? 'no disponible' : (100*pair.coverage_fraction).toFixed(1)+'%'} · Espectral: ${pair.spectral_status}${pair.spectral_match_fraction == null ? '' : ' / '+(100*pair.spectral_match_fraction).toFixed(1)+'%'} · ${pair.reasons.join(' ') || 'Filtros exploratorios superados; no es una detección.'}`;
        block.append(detail);
        if(pair.status!=='error'){
          const choose=document.createElement('button');choose.type='button';choose.className='button';choose.textContent='Seleccionar A / B';
          choose.addEventListener('click',()=>{
            for(const [select,item] of [[a,pair.a],[b,pair.b]]){if(!Array.from(select.options).some(option=>option.value===item.id))select.add(new Option(`${item.observation_id} · ${item.band}`,item.id));select.value=item.id;}
            clear();slots.get(a).load();slots.get(b).load();status.textContent='Par seleccionado; verifica y compara.';
          });block.append(choose);
        }
        pairs.append(block);
      }
    }catch(error){if(pairRequest===controller&&!controller.signal.aborted&&error.name!=='AbortError')pairs.textContent=`No se pudieron buscar pares: ${error.message}`;}
    finally{if(pairRequest===controller){pairRequest=null;find.disabled=false;}}
  });
  function show(mode){if((mode==='overlay'||mode==='difference')&&result?.compatible!==true)return;if(mode==='overlay'){view.src=result.views.a;overlay.src=result.views.b;overlay.hidden=false;view.alt='Superposición visual aproximada de A y B sobre rejilla común';}else{if(!result?.views[mode])return;overlay.hidden=true;view.src=result.views[mode];view.alt=`${mode === 'difference' ? 'Diferencia aproximada B menos A' : mode === 'coverage' ? 'Máscara de cobertura válida' : 'Observación real '+mode.toUpperCase()} sobre rejilla común`;}selector.value=mode;}
  form.addEventListener('submit',async event=>{
    event.preventDefault();clear();
    if(offline.checked){status.textContent='DEMO OFFLINE · Comparación real desactivada.';return;}
    if(!a.value||!b.value||a.value===b.value){status.textContent='Selecciona dos observaciones distintas.';return;}
    const controller=new AbortController();request=controller;submit.disabled=true;form.setAttribute('aria-busy','true');status.textContent='Descargando y verificando recortes FITS de IRSA…';
    try{
      const data=await realApi.compare(a.value,b.value,controller.signal);
      if(request!==controller||controller.signal.aborted)return;
      if(data.mode!=='real')throw Error('El resultado no está identificado como real');result=data;
      const reasons=data.reasons.length?data.reasons.join(' '):'Criterios exploratorios superados; no es una detección de movimiento.';
      status.textContent=`${data.compatible?'COMPATIBLE · COMPARACIÓN APROXIMADA':'INCOMPATIBLE · NO COMPARABLE'} · ${reasons} Cobertura válida ${(100*data.coverage_fraction).toFixed(1)} %. ${data.warning} Las vistas reproyectadas no certifican por sí solas registro astrométrico verificado.`;
      document.querySelector('#compare-real-meta').textContent=`A: ${data.a.observation_id} · ${data.a.band} · ${data.fits_a.date_obs || data.a.time_start_mjd} · ${data.a.release} | B: ${data.b.observation_id} · ${data.b.band} · ${data.fits_b.date_obs || data.b.time_start_mjd} · ${data.b.release}. Procedencia: NASA/IPAC IRSA. Varianza interpolada aproximada; no usar para significancia.`;
      for(const [key,label] of [['a','Observación A reproyectada'],['b','Observación B reproyectada'],['coverage','Cobertura común'],['difference','Diferencia B − A']])if(data.views[key] && (key!=='difference'||data.compatible===true))selector.add(new Option(label,key));
      if(data.compatible && data.views.a && data.views.b)selector.add(new Option('Superposición A / B','overlay'));
      if(data.views.a){panel.hidden=false;show('a');}play.disabled=!data.compatible||!data.views.a||!data.views.b;
    }catch(error){if(request===controller&&!controller.signal.aborted&&error.name!=='AbortError')status.textContent=`No se pudo comparar: ${error.message}`;}
    finally{if(request===controller){request=null;submit.disabled=false;form.removeAttribute('aria-busy');}}
  });
  selector.addEventListener('change',()=>{stop();show(selector.value);});
  play.addEventListener('click',()=>{if(timer!==null){stop();return;}if(!result?.compatible)return;index=0;show('a');timer=setInterval(()=>{index=1-index;show(index?'b':'a');},800);play.textContent='Pausar A / B';play.setAttribute('aria-pressed','true');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(link&&link.getAttribute('href')!=='#explorador')stop();});
  clear();
}
