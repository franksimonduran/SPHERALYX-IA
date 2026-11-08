// Transformación visual del PNG, independiente de WCS, análisis y visor simulado.
export function initRealViewer({viewport, image, column, status, coordinates}) {
  const toolbar=document.createElement('div'); toolbar.className='real-viewer-toolbar';
  toolbar.setAttribute('role','group'); toolbar.setAttribute('aria-label','Controles visuales del recorte real');
  const button=(label,text)=>{const el=document.createElement('button');el.type='button';el.className='real-viewer-button';el.setAttribute('aria-label',label);el.textContent=text;toolbar.append(el);return el;};
  const out=button('Alejar vista real','−'),reset=button('Restablecer encuadre de la vista real','Ajustar'),plus=button('Acercar vista real','+');
  const zoomLabel=document.createElement('output');zoomLabel.id='real-viewer-zoom';zoomLabel.setAttribute('aria-live','polite');toolbar.append(zoomLabel);
  const hint=document.createElement('p');hint.className='real-viewer-hint';hint.id='real-viewer-help';
  hint.textContent='Encuadre visual: arrastra o usa las flechas; + y − acercan o alejan, 0 restablece.';
  const footer=document.createElement('footer');footer.className='real-viewer-footer';
  const coords=document.createElement('span'), provenance=document.createElement('span');
  provenance.textContent='IRSA · PNG normalizado · No fotometría ni orientación WCS garantizada';
  footer.append(coords,provenance);
  viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','Vista previa real de IRSA');viewport.setAttribute('aria-describedby','real-viewer-help');
  viewport.before(toolbar);viewport.after(hint,footer);
  const empty=viewport.querySelector('.real-image-empty');
  const emptyTitle=empty.querySelector('strong'), emptyText=empty.querySelector('p');
  let zoom=1,x=0,y=0,drag=null,lastSrc=null;
  const available=()=>!image.hidden && !!image.getAttribute('src');
  function render(){
    const enabled=available();
    out.disabled=!enabled||zoom<=1;plus.disabled=!enabled||zoom>=4;reset.disabled=!enabled;
    zoomLabel.textContent=`${Math.round(zoom*100)} %`;
    image.style.transform=`translate(${x}px, ${y}px) scale(${zoom})`;
    viewport.classList.toggle('can-pan',enabled&&zoom>1);
  }
  function adjust(){zoom=1;x=0;y=0;drag=null;render();}
  function setZoom(value){if(!available())return;zoom=Math.max(1,Math.min(4,value));const limitX=viewport.clientWidth*(zoom-1)/2,limitY=viewport.clientHeight*(zoom-1)/2;x=Math.max(-limitX,Math.min(limitX,x));y=Math.max(-limitY,Math.min(limitY,y));render();}
  function pan(dx,dy){if(!available()||zoom<=1)return;const limitX=viewport.clientWidth*(zoom-1)/2,limitY=viewport.clientHeight*(zoom-1)/2;x=Math.max(-limitX,Math.min(limitX,x+dx));y=Math.max(-limitY,Math.min(limitY,y+dy));render();}
  out.addEventListener('click',()=>setZoom(zoom-.25));plus.addEventListener('click',()=>setZoom(zoom+.25));reset.addEventListener('click',adjust);
  viewport.addEventListener('keydown',event=>{
    if(!available())return;
    const key=event.key;
    if(key==='+'||key==='=')setZoom(zoom+.25);
    else if(key==='-')setZoom(zoom-.25);
    else if(key==='0')adjust();
    else if(key==='ArrowLeft')pan(-20,0);
    else if(key==='ArrowRight')pan(20,0);
    else if(key==='ArrowUp')pan(0,-20);
    else if(key==='ArrowDown')pan(0,20);
    else return;
    event.preventDefault();
  });
  viewport.addEventListener('pointerdown',event=>{if(!available()||zoom<=1||event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};viewport.setPointerCapture(event.pointerId);event.preventDefault();});
  viewport.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;pan(event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY;});
  function stopDrag(event){if(drag?.id===event.pointerId)drag=null;}
  viewport.addEventListener('pointerup',stopDrag);viewport.addEventListener('pointercancel',stopDrag);viewport.addEventListener('lostpointercapture',stopDrag);
  function updateImage(){const src=image.getAttribute('src');if(src!==lastSrc){lastSrc=src;adjust();}else render();}
  new MutationObserver(updateImage).observe(image,{attributes:true,attributeFilter:['hidden','src']});
  function updateStatus(){
    const message=status.textContent||'';
    const busy=message.includes('Cargando recorte')||message.includes('Consultando IRSA');
    viewport.setAttribute('aria-busy',String(busy));
    if(message.includes('Consultando IRSA')){emptyTitle.textContent='Consultando IRSA';emptyText.textContent='Buscando observaciones reales para las coordenadas indicadas…';}
    else if(message.includes('Cargando recorte')){emptyTitle.textContent='Cargando observación real';emptyText.textContent='Recuperando la vista previa desde IRSA…';}
    else if(message.startsWith('Error al consultar IRSA:')){emptyTitle.textContent='Consulta IRSA no disponible';emptyText.textContent=message;}
    else if(message.startsWith('No se pudo mostrar el recorte')){emptyTitle.textContent='Vista previa no disponible';emptyText.textContent=message;}
    else{emptyTitle.textContent='Esperando una observación real';emptyText.textContent='Busca en IRSA y selecciona un producto. No se muestran imágenes sintéticas en este visor.';}
  }
  new MutationObserver(updateStatus).observe(status,{childList:true,characterData:true,subtree:true});
  function updateCoordinates(){const ra=coordinates.querySelector('#ra').value,dec=coordinates.querySelector('#dec').value;coords.textContent=`Entradas actuales · RA ${ra||'—'}° · Dec ${dec||'—'}° (no WCS del visor)`;}
  coordinates.addEventListener('input',updateCoordinates);coordinates.addEventListener('change',updateCoordinates);
  updateCoordinates();updateStatus();render();
}
