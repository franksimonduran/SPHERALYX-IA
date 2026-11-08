import { realApi } from './api.js';

export function initRealComparison() {
  const a=document.querySelector('#real-a'), b=document.querySelector('#real-b');
  const form=document.querySelector('#compare-real-form'), status=document.querySelector('#compare-real-status');
  const panel=document.querySelector('#compare-real-views'), view=document.querySelector('#compare-real-image');
  const overlay=document.querySelector('#compare-real-overlay'), selector=document.querySelector('#compare-view');
  const play=document.querySelector('#compare-play'), pairs=document.querySelector('#pair-results');
  const find=document.querySelector('#find-pairs'), offline=document.querySelector('#offline-mode');
  let result=null, timer=null, request=null, pairRequest=null, index=0;
  function stop(){if(timer!==null)clearInterval(timer);timer=null;play.textContent='Reproducir A / B';play.setAttribute('aria-pressed','false');}
  function clear(){stop();if(request)request.abort();request=null;form.removeAttribute('aria-busy');result=null;panel.hidden=true;view.removeAttribute('src');overlay.removeAttribute('src');overlay.hidden=true;selector.replaceChildren();document.querySelector('#compare-real-meta').textContent='';}
  function clearPairs(){if(pairRequest)pairRequest.abort();pairRequest=null;find.disabled=false;pairs.replaceChildren();}
  window.addEventListener('real-observations',event=>{
    clear();clearPairs();
    for(const select of [a,b]){select.replaceChildren(new Option('Selecciona una observación',''));for(const item of event.detail){const label=`${item.observation_id || 'Sin ID'} · ${item.band || 'banda desconocida'} · MJD ${item.time_start_mjd ?? 'desconocido'}`;select.add(new Option(label,item.id));}}
    status.textContent=event.detail.length?'Selecciona dos exposiciones reales de la búsqueda.':'Primero realiza una búsqueda real en IRSA.';
  });
  // Cambiar parámetros invalida resultados, incluso si el servidor no puede cancelar su trabajo.
  for(const id of ['#ra','#dec','#real-radius','#real-release']){
    const input=document.querySelector(id);
    input.addEventListener('input',clearPairs);
    input.addEventListener('change',clearPairs);
  }
  for(const select of [a,b]) select.addEventListener('change',()=>{clear();status.textContent='Selección modificada; ejecuta una comparación nueva.';});
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
            clear();status.textContent='Par seleccionado; verifica y compara.';
          });block.append(choose);
        }
        pairs.append(block);
      }
    }catch(error){if(pairRequest===controller&&!controller.signal.aborted&&error.name!=='AbortError')pairs.textContent=`No se pudieron buscar pares: ${error.message}`;}
    finally{if(pairRequest===controller){pairRequest=null;find.disabled=false;}}
  });
  function show(mode){if(mode==='overlay'){view.src=result.views.a;overlay.src=result.views.b;overlay.hidden=false;view.alt='Superposición visual aproximada de A y B sobre rejilla común';}else{if(!result?.views[mode])return;overlay.hidden=true;view.src=result.views[mode];view.alt=`${mode === 'difference' ? 'Diferencia aproximada B menos A' : mode === 'coverage' ? 'Máscara de cobertura válida' : 'Observación real '+mode.toUpperCase()} sobre rejilla común`;}selector.value=mode;}
  form.addEventListener('submit',async event=>{
    event.preventDefault();clear();
    if(offline.checked){status.textContent='DEMO OFFLINE · Comparación real desactivada.';return;}
    if(!a.value||!b.value||a.value===b.value){status.textContent='Selecciona dos observaciones distintas.';return;}
    const controller=new AbortController();request=controller;form.setAttribute('aria-busy','true');status.textContent='Descargando y verificando recortes FITS de IRSA…';
    try{
      const data=await realApi.compare(a.value,b.value,controller.signal);
      if(request!==controller||controller.signal.aborted)return;
      if(data.mode!=='real')throw Error('El resultado no está identificado como real');result=data;
      const reasons=data.reasons.length?data.reasons.join(' '):'Criterios exploratorios superados; no es una detección de movimiento.';
      status.textContent=`${data.compatible?'COMPARACIÓN APROXIMADA':'NO COMPARABLE'} · ${reasons} Cobertura válida ${(100*data.coverage_fraction).toFixed(1)} %. ${data.warning}`;
      document.querySelector('#compare-real-meta').textContent=`A: ${data.a.observation_id} · ${data.a.band} · ${data.fits_a.date_obs || data.a.time_start_mjd} · ${data.a.release} | B: ${data.b.observation_id} · ${data.b.band} · ${data.fits_b.date_obs || data.b.time_start_mjd} · ${data.b.release}. Procedencia: NASA/IPAC IRSA. Varianza interpolada aproximada; no usar para significancia.`;
      for(const [key,label] of [['a','Observación A'],['b','Observación B'],['coverage','Cobertura común'],['difference','Diferencia B − A']])if(data.views[key])selector.add(new Option(label,key));
      if(data.compatible && data.views.a && data.views.b)selector.add(new Option('Superposición A / B','overlay'));
      if(data.views.a){panel.hidden=false;show('a');}play.disabled=!data.compatible||!data.views.a||!data.views.b;
    }catch(error){if(request===controller&&!controller.signal.aborted&&error.name!=='AbortError')status.textContent=`No se pudo comparar: ${error.message}`;}
    finally{if(request===controller){request=null;form.removeAttribute('aria-busy');}}
  });
  selector.addEventListener('change',()=>{stop();show(selector.value);});
  play.addEventListener('click',()=>{if(timer!==null){stop();return;}if(!result?.compatible)return;index=0;show('a');timer=setInterval(()=>{index=1-index;show(index?'b':'a');},800);play.textContent='Pausar A / B';play.setAttribute('aria-pressed','true');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(link&&link.getAttribute('href')!=='#explorador')stop();});
}
