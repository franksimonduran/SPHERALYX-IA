// Gaia DR3: visualizaciones vinculadas dentro de Cosmic Explorer.
// Solo recibe registros reales del cliente TAP existente; no sintetiza estrellas.
// Diagrama usa G APARENTE vs BP-RP; no estima distancias a partir de paralajes.
export function initGaiaVisualization() {
  const area = document.querySelector('#gaia-linked-views');
  if (!area) return;
  const sky = area.querySelector('#gaia-galactic-canvas');
  const cmd = area.querySelector('#gaia-cmd-canvas');
  const status = area.querySelector('#gaia-linked-status');
  const caption = area.querySelector('#gaia-sky-status');
  const skyBtn = area.querySelector('#gaia-sky-open');
  const aladinHost = area.querySelector('#gaia-aladin');
  const sourceSelect = document.querySelector('#cosmic-source-select');
  const manualOffline = document.querySelector('#offline-mode');
  let sources = [], selectedKey = '', query = null, meta = null;
  let aladin = null, markerLayer = null, aladinLoading = false;
  let redrawPending = false;
  let hot = [];
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const keyOf = s => 'gaia:' + String(s.source_id);
  const pickSource = id => {
    if (!sourceSelect) return;
    const key = 'gaia:' + String(id);
    if (![...sourceSelect.options].some(o => o.value === key)) return;
    sourceSelect.value = key;
    sourceSelect.dispatchEvent(new Event('change', { bubbles:true }));
  };
  function canvasSetup(element) {
    const bounds = element.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.round(width * dpr);
    element.height = Math.round(height * dpr);
    const ctx = element.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }
  function scaffold(ctx,w,h,title,xLabel,yLabel) {
    const m = {left:46,right:15,top:27,bottom:39};
    const px = w-m.left-m.right, py = h-m.top-m.bottom;
    ctx.fillStyle='#071222';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(134,166,212,.14)';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const x=m.left+px*i/4,y=m.top+py*i/4;
      ctx.beginPath();ctx.moveTo(x,m.top);ctx.lineTo(x,h-m.bottom);ctx.stroke();
      ctx.beginPath();ctx.moveTo(m.left,y);ctx.lineTo(w-m.right,y);ctx.stroke();
    }
    ctx.fillStyle='#d9e6fb';ctx.font='600 11px system-ui';ctx.fillText(title,m.left,16);
    ctx.fillStyle='#a3b5d5';ctx.font='10px system-ui';
    ctx.fillText(xLabel,m.left+px/2-ctx.measureText(xLabel).width/2,h-10);
    ctx.save();ctx.translate(11,m.top+py/2);ctx.rotate(-Math.PI/2);ctx.fillText(yLabel,-ctx.measureText(yLabel).width/2,0);ctx.restore();
    return { m, px, py };
  }
  function drawGalactic() {
    const frame = canvasSetup(sky);if(!frame)return;
    const {ctx,width:w,height:h}=frame,{m,px,py}=scaffold(ctx,w,h,'POSICIONES GALÁCTICAS · CONO CONSULTADO','l (°)','b (°)');
    const valid=sources.filter(s=>finite(s.l)&&finite(s.b));
    if(!valid.length) return empty(ctx,w,h,sources.length?'Sin coordenadas galácticas disponibles':'Consulta Gaia DR3 para visualizar fuentes');
    const l0=valid.reduce((acc,s)=>acc+Math.cos(s.l*Math.PI/180),0);
    const l1=valid.reduce((acc,s)=>acc+Math.sin(s.l*Math.PI/180),0);
    const center=(Math.atan2(l1,l0)*180/Math.PI+360)%360;
    const wrapped = l => ((l-center+540)%360)-180;
    let extent=Math.max(.006,...valid.map(s=>Math.abs(wrapped(s.l))),...valid.map(s=>Math.abs(s.b-valid[0].b)));
    extent=Math.min(180,Math.max(extent*1.2,(query?.radius_deg||.02)*1.4));
    const y0=valid.reduce((sum,s)=>sum+s.b,0)/valid.length;
    hot=[];
    const x=l=>m.left+px*(.5-wrapped(l)/(2*extent));
    const y=b=>m.top+py*(.5-(b-y0)/(2*extent));
    ctx.fillStyle='#8ea8c8';ctx.font='10px system-ui';
    for(let i=-2;i<=2;i+=2){
      const value=center+i*extent/2;
      ctx.fillText(((value+360)%360).toFixed(2)+'°',Math.max(1,x((value+360)%360)-15),h-m.bottom+15);
      ctx.fillText((y0+i*extent/2).toFixed(2)+'°',4,y(y0+i*extent/2)+3);
    }
    for(const s of valid){
      const xx=x(s.l),yy=y(s.b),selected=keyOf(s)===selectedKey;
      if(!Number.isFinite(xx)||!Number.isFinite(yy)||xx<m.left-5||xx>w-m.right+5||yy<m.top-5||yy>h-m.bottom+5)continue;
      ctx.beginPath();ctx.arc(xx,yy,selected?5:2.3,0,Math.PI*2);
      ctx.fillStyle=selected?'#ffe0a5':'#8abaff';ctx.fill();
      if(selected){ctx.strokeStyle='#fff0cd';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(xx,yy,9,0,Math.PI*2);ctx.stroke();}
      hot.push({el:sky,x:xx,y:yy,id:String(s.source_id)});
    }
  }
  function drawCMD() {
    const frame=canvasSetup(cmd);if(!frame)return;
    const {ctx,width:w,height:h}=frame,{m,px,py}=scaffold(ctx,w,h,'COLOR–MAGNITUD APARENTE · GAIA DR3','BP − RP (mag)','G aparente (mag)');
    const valid=sources.filter(s=>finite(s.bp_rp)&&finite(s.phot_g_mean_mag));
    if(!valid.length)return empty(ctx,w,h,sources.length?'No hay pares BP−RP / G válidos':'Consulta Gaia DR3 para obtener el diagrama');
    const colors=valid.map(s=>s.bp_rp),mags=valid.map(s=>s.phot_g_mean_mag);
    let minX=Math.min(...colors),maxX=Math.max(...colors),minY=Math.min(...mags),maxY=Math.max(...mags);
    const dx=Math.max(.25,(maxX-minX)*.1),dy=Math.max(.4,(maxY-minY)*.1);
    minX-=dx;maxX+=dx;minY-=dy;maxY+=dy;
    const x=v=>m.left+(v-minX)/(maxX-minX)*px;
    // Magnitud más brillante arriba.
    const y=v=>m.top+(v-minY)/(maxY-minY)*py;
    ctx.fillStyle='#91a9ce';ctx.font='10px system-ui';
    for(let i=0;i<=4;i++){
      const color=minX+(maxX-minX)*i/4,mag=minY+(maxY-minY)*i/4;
      ctx.fillText(color.toFixed(1),Math.max(1,x(color)-9),h-m.bottom+15);
      ctx.fillText(mag.toFixed(1),4,y(mag)+4);
    }
    for(const s of valid){
      const xx=x(s.bp_rp),yy=y(s.phot_g_mean_mag),selected=keyOf(s)===selectedKey;
      ctx.beginPath();ctx.arc(xx,yy,selected?5:2.5,0,Math.PI*2);
      ctx.fillStyle=selected?'#ffe5ae':'rgba(175,141,255,.85)';ctx.fill();
      if(selected){ctx.strokeStyle='#fff0cd';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(xx,yy,9,0,Math.PI*2);ctx.stroke();}
      hot.push({el:cmd,x:xx,y:yy,id:String(s.source_id)});
    }
  }
  function empty(ctx,w,h,message){
    ctx.fillStyle='#b1bdd9';ctx.font='12px system-ui';ctx.textAlign='center';
    ctx.fillText(message.slice(0,51),w/2,h/2);ctx.textAlign='start';
  }
  function draw(){hot=[];drawGalactic();drawCMD();}
  function requestDraw(){
    if(redrawPending)return;
    redrawPending=true;
    requestAnimationFrame(()=>{redrawPending=false;draw();});
  }
  for(const el of [sky,cmd]){
    el.addEventListener('click',event=>{
      const rect=el.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      const nearest=hot.filter(p=>p.el===el).map(p=>({...p,d:Math.hypot(p.x-x,p.y-y)})).sort((a,b)=>a.d-b.d)[0];
      if(nearest?.d<12)pickSource(nearest.id);
    });
  }
  async function ensureAladin(){
    if (manualOffline?.checked) {
      caption.textContent = 'Modo offline elegido: no se cargará el visor CDS ni se solicitarán imágenes externas.';
      return;
    }
    if(aladin||aladinLoading)return;
    if(!query||!finite(query.ra)||!finite(query.dec)){
      caption.textContent='Selecciona un campo con RA/Dec válidas antes de abrir la imagen.';return;
    }
    aladinLoading=true;skyBtn.disabled=true;
    caption.textContent='Cargando visor CDS y estudio de cielo DSS2…';
    try{
      if(!window.A){
        await new Promise((resolve,reject)=>{
          const s=document.createElement('script');
          s.src='https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js';
          s.async=true;
          s.onload=resolve;s.onerror=()=>reject(new Error('No se pudo cargar Aladin Lite'));
          document.head.append(s);
        });
      }
      await window.A.init;
      aladinHost.hidden=false;
      aladin=window.A.aladin('#gaia-aladin',{
        survey:'P/DSS2/color',
        target:query.ra+' '+query.dec,
        fov:Math.max(.05,Math.min(1.5,query.radius_deg*2.7)),
        cooFrame:'ICRSd',showReticle:true,showLayersControl:true
      });
      aladin.on('objectClicked', object => {
        if (object?.data?.source_id != null) pickSource(String(object.data.source_id));
      });
      skyBtn.textContent='Actualizar vista de archivo';
      caption.textContent='CDS Aladin Lite · DSS2 color (archivo, NO SPHEREx). Selecciona una estrella en los gráficos para localizarla.';
      updateAladin();
    }catch(error){
      aladinHost.hidden=true;
      caption.textContent='No se pudo cargar la imagen externa: '+error.message+'. Los gráficos Gaia locales siguen funcionando.';
    }finally{aladinLoading=false;skyBtn.disabled=false;}
  }
  function updateAladin(){
    if(!aladin||!query)return;
    try{
      aladin.gotoRaDec(query.ra,query.dec);
      aladin.setFoV(Math.max(.05,Math.min(1.5,query.radius_deg*2.7)));
      if(!markerLayer){
        markerLayer=window.A.catalog({name:'Gaia DR3 · consulta seleccionada',sourceSize:7,color:'#a98cff',onClick:'showPopup'});
        aladin.addCatalog(markerLayer);
      } else markerLayer.removeAll();
      markerLayer.addSources(sources.filter(s=>finite(s.ra)&&finite(s.dec)).slice(0,200).map(s=>window.A.source(s.ra,s.dec,{name:'Gaia DR3 '+s.source_id,source_id:String(s.source_id)})));
      const selected=sources.find(s=>keyOf(s)===selectedKey);
      if(selected)aladin.gotoRaDec(selected.ra,selected.dec);
    }catch(error){caption.textContent='Error al actualizar Aladin Lite; la visualización Gaia permanece disponible.';}
  }
  skyBtn.addEventListener('click',()=>{
    if (manualOffline?.checked) {
      caption.textContent='Modo offline elegido: imágenes externas de CDS desactivadas.';
      return;
    }
    return aladin ? updateAladin() : ensureAladin();
  });
  manualOffline?.addEventListener('change',()=>{
    if (manualOffline.checked) {
      aladinHost.hidden=true;
      skyBtn.disabled=true;
      caption.textContent='VISOR CDS NO DISPONIBLE · Acceso externo desactivado.';
    } else {
      skyBtn.disabled=false;
      if (aladin) aladinHost.hidden=false;
      caption.textContent=aladin
        ? 'CDS Aladin Lite · DSS2 color (archivo óptico, NO SPHEREx).'
        : 'Visor óptico opcional. Pulsa para cargar el archivo CDS.';
    }
  });
  document.addEventListener('spheralyx:gaia-visualization',event=>{
    const detail=event.detail||{};
    sources=Array.isArray(detail.sources)?detail.sources:[];
    selectedKey=detail.selectedKey||'';
    query=detail.query||null;meta=detail.meta||null;
    const trunc=meta?.truncated?' · muestra limitada (posible truncamiento)':'';
    status.textContent=sources.length
      ? 'Gaia DR3 · '+(meta?.source || 'Archivo Gaia')+' · '+sources.length+' fuentes del cono consultado'+trunc+' · '+(meta?.queried_at_utc||'fecha de consulta no disponible')
      : 'Sin fuentes Gaia cargadas para el campo actual. No se muestran resultados sintéticos.';
    requestDraw();
    if(aladin)updateAladin();
  });
  if('ResizeObserver' in window)new ResizeObserver(requestDraw).observe(area);
  requestDraw();
}
