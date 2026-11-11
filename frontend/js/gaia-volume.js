import { createGaiaVolumeWebGL } from './gaia-volume-webgl.js';
/* Vista volumétrica inspirada en la experiencia Gaia Sky, NO el programa Gaia Sky.
 * Únicamente posiciones Gaia DR3 con paralaje positivo y S/N >= 10.
 * Distancia geométrica aproximada d(pc)=1000/parallax(mas), no inferencia bayesiana.
 * Se conserva la selección y la procedencia del cono; no se sintetizan estrellas.
 */
export function initGaiaVolume() {
  const host=document.querySelector('#gaia-volume'),canvas=document.querySelector('#gaia-volume-canvas');
  if(!host||!canvas)return;
  const ctx=canvas.getContext('2d'),status=host.querySelector('#gaia-volume-status');
  const detail=host.querySelector('#gaia-volume-detail');
  const reset=host.querySelector('#gaia-volume-reset');
  const select=host.querySelector('#gaia-volume-select');
  const distance=host.querySelector('#gaia-volume-range');
  if(!ctx)return;
  // Keep the accessible Canvas viewer as the permanent fallback.
  const stage=host.querySelector('.gaia-volume-stage');
  const gpuCanvas=document.createElement('canvas');
  gpuCanvas.id='gaia-volume-gpu';
  gpuCanvas.setAttribute('aria-hidden','true');
  gpuCanvas.hidden=true;
  stage.append(gpuCanvas);
  const modeButton=document.createElement('button');
  modeButton.id='gaia-volume-mode';
  modeButton.type='button';
  modeButton.setAttribute('aria-label','Alternar representación 3D WebGL y 2D de fuentes Gaia');
  reset.insertAdjacentElement('afterend',modeButton);
  const fullscreenButton=document.createElement('button');
  fullscreenButton.id='gaia-volume-fullscreen';
  fullscreenButton.type='button';
  fullscreenButton.textContent='Pantalla completa';
  modeButton.insertAdjacentElement('afterend',fullscreenButton);
  let gpu=null,renderMode='2d';
  function setMode(mode){
    renderMode=mode==='webgl'&&gpu?'webgl':'2d';
    gpuCanvas.hidden=renderMode!=='webgl';
    host.dataset.renderMode=renderMode;
    modeButton.disabled=!gpu;
    modeButton.setAttribute('aria-pressed',String(renderMode==='webgl'));
    modeButton.textContent=gpu?(renderMode==='webgl'?'Cambiar a vista 2D':'Activar vista 3D WebGL'):'Vista 2D · WebGL no disponible';
  }
  try{
    gpu=createGaiaVolumeWebGL(gpuCanvas,()=>{
      gpu=null;
      setMode('2d');
      render();
    });
  }catch(error){gpu=null;}
  setMode(gpu?'webgl':'2d');
  modeButton.addEventListener('click',()=>{setMode(renderMode==='webgl'?'2d':'webgl');render();});
  fullscreenButton.addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement===stage)await document.exitFullscreen();
      else await stage.requestFullscreen();
    }catch(error){detail.textContent='Pantalla completa no disponible en este navegador.';}
  });
  let lastDataKey='';
  let stars=[],yaw=.42,pitch=.24,zoom=1,drag=null,selected='',meta=null,points=[];
  const good=s=>Number.isFinite(s?.ra)&&Number.isFinite(s?.dec)&&Number.isFinite(s?.parallax)&&Number.isFinite(s?.parallax_error)&&s.parallax>0&&s.parallax_error>0&&s.parallax/s.parallax_error>=10;
  const f=n=>Number.isFinite(n)?n.toFixed(2):'—';
  function render(){
    const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;
    if(w<2||h<2)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#070f23');bg.addColorStop(1,'#11132d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const cx=w/2,cy=h/2,scale=Math.min(w,h)*.37*zoom;
    ctx.strokeStyle='rgba(129,166,221,.14)';ctx.lineWidth=1;
    for(let i=1;i<=3;i++){ctx.beginPath();ctx.ellipse(cx,cy,scale*i/3,scale*i/9,0,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='#94aacb';ctx.font='11px system-ui';ctx.fillText('GAIA DR3 · VOLUMEN LOCAL · PARALAJE S/N ≥ 10',16,23);
    const max=Number(distance.value),sinY=Math.sin(yaw),cosY=Math.cos(yaw),sinP=Math.sin(pitch),cosP=Math.cos(pitch);
    points=[];
    for(const s of stars){
      const pc=1000/s.parallax;
      if(pc>max)continue;
      const a=s.ra*Math.PI/180,d=s.dec*Math.PI/180;
      const r=pc/max;
      const x=r*Math.cos(d)*Math.cos(a),y=r*Math.cos(d)*Math.sin(a),z=r*Math.sin(d);
      const xx=x*cosY-y*sinY,yy=x*sinY+y*cosY;
      const zz=z*cosP-yy*sinP,depth=z*sinP+yy*cosP;
      const perspective=1/(1+depth*.38);
      const px=cx+xx*scale*perspective,py=cy-zz*scale*perspective;
      points.push({s,px,py,depth,pc});
    }
    points.sort((a,b)=>b.depth-a.depth);
    for(const p of points){
      const chosen=String(p.s.source_id)===selected;
      const size=chosen?6:Math.max(1.8,Math.min(4.4,5.1-(p.s.phot_g_mean_mag??15)*.17));
      ctx.beginPath();ctx.arc(p.px,p.py,size,0,Math.PI*2);
      ctx.fillStyle=chosen?'#ffda92':Number.isFinite(p.s.bp_rp)&&p.s.bp_rp>1.5?'#ffb997':'#a8d9ff';ctx.fill();
      if(chosen){ctx.strokeStyle='#fff3c4';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.px,p.py,10,0,Math.PI*2);ctx.stroke();}
    }
    if(gpu&&renderMode==='webgl'){
      try{
        const gpuPoints=points.map(p=>{
          const a=p.s.ra*Math.PI/180,d=p.s.dec*Math.PI/180,r=p.pc/max;
          return {x:r*Math.cos(d)*Math.cos(a),y:r*Math.cos(d)*Math.sin(a),z:r*Math.sin(d),
            color:Number.isFinite(p.s.bp_rp)&&p.s.bp_rp>1.5?[1,.72,.57]:[.66,.84,1],
            size:Math.max(4,Math.min(9,8.5-(p.s.phot_g_mean_mag??15)*.22)),
            selected:String(p.s.source_id)===selected};
        });
        gpu.render(gpuPoints,{width:w,height:h,dpr,yaw,pitch,scale});
      }catch(error){
        gpu.dispose();gpu=null;setMode('2d');
      }
    }
    if(!points.length){ctx.fillStyle='#b7c8e2';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText(stars.length?'No hay fuentes dentro del rango de distancia':'Consulta Gaia DR3 para cargar distancias verificables',cx,cy);ctx.textAlign='start';}
    status.textContent=(renderMode==='webgl'?'WebGL 3D':'Canvas 2D')+' · '+(meta?points.length+' / '+stars.length+' fuentes Gaia DR3 con paralaje fiable · radio visual '+max+' pc · '+(meta.source||'Archivo Gaia'):'Sin consulta Gaia DR3 · no se generan estrellas de relleno');
    host.dataset.count=String(points.length);
  }
  function updateDetail(){
    const p=points.find(p=>String(p.s.source_id)===selected);
    detail.textContent=p?'Gaia DR3 '+p.s.source_id+' · '+f(p.pc)+' pc (inversión aproximada) · paralaje '+f(p.s.parallax)+' ± '+f(p.s.parallax_error)+' mas · S/N '+f(p.s.parallax/p.s.parallax_error):'Selecciona una estrella para inspeccionar su paralaje y distancia aproximada.';
  }
  function choose(id){
    selected=String(id||'');render();updateDetail();
    if(selected){
      const other=document.querySelector('#cosmic-source-select');
      if(other&&[...other.options].some(o=>o.value==='gaia:'+selected)){other.value='gaia:'+selected;other.dispatchEvent(new Event('change',{bubbles:true}));}
    }
  }
  document.addEventListener('spheralyx:gaia-visualization',event=>{
    const data=event.detail||{};
    stars=(Array.isArray(data.sources)?data.sources:[]).filter(good);
    meta=data.meta||null;selected=String(data.selectedKey||'').replace(/^gaia:/,'');
    const dataKey=JSON.stringify(data.query||null)+'|'+stars.map(s=>String(s.source_id)).join(',');
    const changed=dataKey!==lastDataKey;
    lastDataKey=dataKey;
    const values=stars.map(s=>1000/s.parallax);
    const max=values.length?Math.ceil(Math.max(...values)/100)*100:1000;
    if(changed){
      distance.max=String(Math.max(100,Math.min(20000,max)));
      distance.value=distance.max;
      select.replaceChildren(new Option('Selecciona una estrella real',''));
      for(const s of stars)select.add(new Option('Gaia '+s.source_id+' · '+f(1000/s.parallax)+' pc',String(s.source_id)));
    }
    select.value=selected||'';render();updateDetail();
  });
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5)drag.moved=true;yaw+=dx*.008;pitch=Math.max(-1.5,Math.min(1.5,pitch+dy*.008));drag={x:e.clientX,y:e.clientY};render();});
  canvas.addEventListener('pointerup',e=>{
    if(!drag)return;
    const p=canvas.getBoundingClientRect(),x=e.clientX-p.left,y=e.clientY-p.top;
    const nearest=points.reduce((best,item)=>{const dist=Math.hypot(item.px-x,item.py-y);return dist<best.dist?{dist,id:item.s.source_id}:best;},{dist:13,id:null});
    const moved=drag.moved;drag=null;if(!moved&&nearest.id)choose(nearest.id);
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.6,Math.min(3,zoom*(e.deltaY>0?.9:1.1)));render();},{passive:false});
  canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')yaw-=.1;else if(e.key==='ArrowRight')yaw+=.1;else if(e.key==='ArrowUp')pitch=Math.max(-1.5,pitch-.1);else if(e.key==='ArrowDown')pitch=Math.min(1.5,pitch+.1);else return;e.preventDefault();render();});
  reset.addEventListener('click',()=>{yaw=.42;pitch=.24;zoom=1;render();});
  select.addEventListener('change',()=>choose(select.value));
  distance.addEventListener('input',()=>{render();updateDetail();});
  window.addEventListener('resize',render);
  render();
}
