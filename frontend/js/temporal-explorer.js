import { normalizeObservations } from './real-observations.js';

// Solo metadatos reales de SIA2; no genera ni interpola épocas, estrellas o trayectorias.
export function initTemporalExplorer() {
  const root=document.querySelector('.real-compare');
  const range=root?.querySelector('#temporal-range');
  const previous=root?.querySelector('#temporal-previous');
  const next=root?.querySelector('#temporal-next');
  const useA=root?.querySelector('#temporal-use-a');
  const useB=root?.querySelector('#temporal-use-b');
  const current=root?.querySelector('#temporal-current');
  const count=root?.querySelector('#temporal-count');
  const empty=root?.querySelector('#temporal-empty');
  const record=root?.querySelector('#temporal-real-record');
  const openSearch=root?.querySelector('#temporal-open-search');
  const inspect=root?.querySelector('#temporal-inspect-real');
  if (![range,previous,next,useA,useB,current,count,empty,record,openSearch,inspect].every(Boolean))return;
  let items=[];
  const text=(id,value)=>{const el=root.querySelector(id);if(el)el.textContent=value;};
  function render() {
    const index=Number(range.value),item=items[index],available=!!item;
    previous.disabled=!available||index===0;
    next.disabled=!available||index>=items.length-1;
    range.disabled=!available;
    useA.disabled=!available;
    useB.disabled=!available;
    inspect.disabled=!available;
    count.textContent=items.length?`${index+1} / ${items.length} productos reales`:'Sin observaciones';
    empty.hidden=available;
    record.hidden=!available;
    if(!item){
      current.textContent='Busca observaciones reales en Cosmic Explorer para comenzar.';
      range.removeAttribute('aria-valuetext');
      return;
    }
    const date=item.utc?`${item.utc.replace(/Z$/,'')} UTC`:item.mjd!==null?`MJD ${item.mjd}`:'Fecha no disponible';
    text('#temporal-real-id',item.raw.observation_id||'Identificador no disponible');
    text('#temporal-real-date',date);
    text('#temporal-real-release',item.collection||'No disponible');
    text('#temporal-real-band',item.band||'No disponible');
    text('#temporal-real-detector',item.detector||'No disponible');
    current.textContent=[item.raw.observation_id||'ID no disponible',date,item.collection||'Colección no disponible',item.detector?`Detector ${item.detector}`:'Detector no disponible',item.band||'Banda no disponible','REAL · IRSA'].join(' · ');
    range.setAttribute('aria-valuetext',current.textContent);
  }
  openSearch.addEventListener('click',()=>{
    const form=document.querySelector('#real-search');
    if(!form)return;
    form.scrollIntoView({behavior:'smooth',block:'center'});
    form.querySelector('button[type=submit]')?.focus({preventScroll:true});
  });
  inspect.addEventListener('click',()=>{
    const item=items[Number(range.value)];
    if(!item)return;
    const button=[...document.querySelectorAll('#real-observations button[data-id]')].find(el=>el.dataset.id===item.id);
    if(!button)return;
    button.click();
    document.querySelector('.real-workspace-image')?.scrollIntoView({behavior:'smooth',block:'center'});
  });
  window.addEventListener('real-observations',event=>{
    items=normalizeObservations(Array.isArray(event.detail)?event.detail:[]);
    range.min='0';range.max=String(Math.max(0,items.length-1));range.value='0';
    render();
  });
  range.addEventListener('input',render);
  previous.addEventListener('click',()=>{range.value=String(Math.max(0,Number(range.value)-1));render();});
  next.addEventListener('click',()=>{range.value=String(Math.min(items.length-1,Number(range.value)+1));render();});
  function assign(id){
    const item=items[Number(range.value)],select=document.querySelector(id);
    if(!item||!select||![...select.options].some(option=>option.value===item.id))return;
    select.value=item.id;
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  useA.addEventListener('click',()=>assign('#real-a'));
  useB.addEventListener('click',()=>assign('#real-b'));
  render();
}
