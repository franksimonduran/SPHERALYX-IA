import { normalizeObservations } from './real-observations.js';

// Navegación por productos SIA existentes: no interpola épocas ni anima imágenes.
export function initTemporalExplorer(){
  const range=document.querySelector('#temporal-range'),previous=document.querySelector('#temporal-previous'),next=document.querySelector('#temporal-next'),useA=document.querySelector('#temporal-use-a'),useB=document.querySelector('#temporal-use-b'),current=document.querySelector('#temporal-current'),count=document.querySelector('#temporal-count');
  if(!range||!previous||!next||!useA||!useB||!current||!count)return;
  let items=[];
  function render(){
    const index=Number(range.value),item=items[index],available=!!item;
    previous.disabled=!available||index===0;next.disabled=!available||index>=items.length-1;range.disabled=!available;useA.disabled=!available;useB.disabled=!available;
    count.textContent=items.length?`${index+1} / ${items.length} productos`:'Sin observaciones';
    if(!item){current.textContent='Busca observaciones reales en Cosmic Explorer para comenzar.';range.removeAttribute('aria-valuetext');return;}
    const date=item.utc?`${item.utc.replace(/Z$/,'')} UTC`:item.mjd!==null?`MJD ${item.mjd}`:'Fecha no disponible';
    current.textContent=[item.raw.observation_id||'ID no disponible',date,item.collection||'Colección no disponible',item.detector?`Detector ${item.detector}`:'Detector no disponible',item.band||'Banda no disponible','REAL · IRSA'].join(' · ');
    range.setAttribute('aria-valuetext',current.textContent);
  }
  window.addEventListener('real-observations',event=>{items=normalizeObservations(Array.isArray(event.detail)?event.detail:[]);range.min='0';range.max=String(Math.max(0,items.length-1));range.value='0';render();});
  range.addEventListener('input',render);previous.addEventListener('click',()=>{range.value=String(Math.max(0,Number(range.value)-1));render();});next.addEventListener('click',()=>{range.value=String(Math.min(items.length-1,Number(range.value)+1));render();});
  function assign(id){const item=items[Number(range.value)],select=document.querySelector(id);if(!item||!select||![...select.options].some(option=>option.value===item.id))return;select.value=item.id;select.dispatchEvent(new Event('change',{bubbles:true}));}
  useA.addEventListener('click',()=>assign('#real-a'));useB.addEventListener('click',()=>assign('#real-b'));render();
}
