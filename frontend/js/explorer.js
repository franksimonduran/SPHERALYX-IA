import { state, update, realApi } from './api.js';
import { normalizeObservations, createObservationList } from './real-observations.js';

// El formulario de coordenadas configura solamente búsquedas a archivos reales.
// No genera estrellas, épocas, trayectorias o resultados sintéticos.
export function initExplorer() {
  const form=document.querySelector('#coordinates-form');
  form?.addEventListener('submit',event=>{
    event.preventDefault();
    const raInput=document.querySelector('#ra'),decInput=document.querySelector('#dec');
    const ra=Number(raInput.value),dec=Number(decInput.value);
    const error=document.querySelector('#coordinates-error'),status=document.querySelector('#coordinates-status');
    const badRa=!raInput.value.trim()||!Number.isFinite(ra)||ra<0||ra>=360;
    const badDec=!decInput.value.trim()||!Number.isFinite(dec)||dec< -90||dec>90;
    raInput.setAttribute('aria-invalid',String(badRa));
    decInput.setAttribute('aria-invalid',String(badDec));
    if(badRa||badDec){
      error.textContent='Introduce RA entre 0 y menos de 360°, y Dec entre −90° y 90°.';
      (badRa?raInput:decInput).focus();return;
    }
    error.textContent='';
    update({ra,dec,selected:null});
    if(status)status.textContent='Coordenadas actualizadas. Pulsa «Buscar en IRSA» para consultar observaciones reales.';
  });
  initRealExplorer();
}

function initRealExplorer() {
  const form=document.querySelector('#real-search'),status=document.querySelector('#real-status'),list=document.querySelector('#real-observations'),metadata=document.querySelector('#real-metadata'),image=document.querySelector('#real-preview');
  let searchController=null, previewController=null, imageUrl=null, items=[], selected=null;
  const observationsView=createObservationList(list, selectObservation);
  function clearPreview(){if(previewController)previewController.abort();previewController=null;if(selected?.state==='cargando')observationsView.setState(selected.id,'disponible');selected=null;observationsView.setSelected(null);if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=null;image.hidden=true;image.removeAttribute('src');metadata.textContent='';}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(searchController)searchController.abort();searchController=null;form.removeAttribute('aria-busy');clearPreview();items=[];observationsView.setItems(items);window.dispatchEvent(new CustomEvent('real-observations', {detail:[]}));if(document.body.dataset.irsaMode==='offline'){status.textContent='SPHEREx no está habilitado en este servidor. Consulta Gaia DR3 o AllWISE, o ejecuta IRSA en un entorno con acceso habilitado.';return;}
    const ra=Number(document.querySelector('#ra').value),dec=Number(document.querySelector('#dec').value),radius=Number(document.querySelector('#real-radius').value),release=document.querySelector('#real-release').value;
    if(!document.querySelector('#ra').value||!document.querySelector('#dec').value||!Number.isFinite(ra)||!Number.isFinite(dec)||ra<0||ra>=360||dec< -90||dec>90||!Number.isFinite(radius)||radius<=0||radius>.25){status.textContent='Coordenadas o radio no válidos: RA [0, 360), Dec [−90, 90], radio (0, 0.25] grados.';return;}
    const controller=new AbortController();searchController=controller;status.textContent='Consultando IRSA…';form.setAttribute('aria-busy','true');
    try {const result=await realApi.search({ra,dec,radius,release},controller.signal);if(searchController!==controller||controller.signal.aborted)return;if(result.mode!=='real'||!Array.isArray(result.observations))throw new Error('Respuesta real no reconocida');items=normalizeObservations(result.observations);observationsView.setItems(items);window.dispatchEvent(new CustomEvent('real-observations',{detail:items.map(item=>item.raw)}));const limit=Number.isFinite(result.limit)&&result.limit>0?result.limit:null;const truncated=limit!==null&&result.observations.length>=limit;const missing=result.observations.length-items.length;status.textContent=items.length?`${items.length} productos reales de IRSA${truncated?' · límite alcanzado: posible truncamiento':''}. ${missing?`${missing} filas duplicadas o sin ID omitidas. `:''}La respuesta puede estar incompleta incluso sin alcanzar el límite. Selecciona una para obtener su recorte.`:'IRSA no devolvió observaciones seleccionables para este campo y colección; la respuesta puede estar incompleta.';}
    catch(error){if(searchController===controller&&!controller.signal.aborted&&error.name!=='AbortError')status.textContent=`Error al consultar IRSA: ${error.message}`;}
    finally{if(searchController===controller){searchController=null;form.removeAttribute('aria-busy');}}
  });
  async function selectObservation(row){if(selected?.id===row.id&&(row.state==='cargando'||row.state==='recuperada'))return;clearPreview();selected=row;observationsView.setSelected(row.id);const controller=new AbortController();previewController=controller;observationsView.setState(row.id,'cargando');status.textContent='Cargando recorte real de IRSA…';
    try{const item=row.raw;if(item.mode && item.mode!=='real')throw new Error('El recurso no está identificado como real');const response=await realApi.preview(item.id,controller.signal);const blob=await response.blob();if(!blob.type.startsWith('image/png'))throw new Error('La vista previa no es PNG');if(previewController!==controller||controller.signal.aborted)return;imageUrl=URL.createObjectURL(blob);image.src=imageUrl;image.hidden=false;metadata.replaceChildren();const details=document.createElement('p');details.textContent=`${item.observation_id || 'ID no disponible'} · ${row.utc ? row.utc.replace(/Z$/, '')+' UTC' : 'Fecha UTC no disponible'} · MJD ${row.mjd ?? 'no disponible'} · ${row.collection || 'Colección no disponible'} · ${row.band || 'Banda no disponible'} · Detector: ${row.detector || 'no disponible'}. Vista visual normalizada, no fotometría. FLAGS no nulos: ${response.headers.get('X-Flagged-Pixels') || 'desconocido'}.`;metadata.append(details);if(row.coverage){const coverage=document.createElement('p');coverage.textContent=`Cobertura SIA: ${row.coverage}. La intersección no garantiza que el centro esté cubierto.`;metadata.append(coverage);}const reference=document.createElement('a');try{const u=new URL(item.reference_url);if(u.protocol==='https:'&&u.hostname==='irsa.ipac.caltech.edu'){reference.href=u.href;reference.target='_blank';reference.rel='noopener noreferrer';reference.textContent='Archivo original en NASA/IPAC IRSA ↗';metadata.append(reference);}}catch{/* referencia no disponible */}observationsView.setState(row.id,'recuperada');status.textContent='REAL · Recorte de IRSA. No se afirma detección de movimiento sin validación.';}
    catch(error){if(previewController===controller&&!controller.signal.aborted&&error.name!=='AbortError'){observationsView.setState(row.id,'error');status.textContent=`No se pudo mostrar el recorte: ${error.message}`;}}
    finally{if(previewController===controller)previewController=null;}
  }
}
