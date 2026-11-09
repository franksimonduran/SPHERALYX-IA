// Esfera conceptual: puntos generados, no catálogo ni posiciones astronómicas.
export function initMissionPortal() {
  const canvas=document.querySelector('#portal-sphere'), region=document.querySelector('.portal-orb'), reset=document.querySelector('#portal-reset');
  if(!canvas||!region||!reset)return;
  const ctx=canvas.getContext('2d');
  if(!ctx){region.classList.add('portal-no-canvas');return;}
  let yaw=-.45,pitch=.2,drag=null;
  const points=[];const count=2900, golden=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<count;i++){const y=1-2*(i+.5)/count,r=Math.sqrt(1-y*y),a=i*golden;points.push([Math.cos(a)*r,y,Math.sin(a)*r,i]);}
  const stars=[];let seed=2147483;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<150;i++)stars.push([random(),random(),random()]);
  function draw(){
    const rect=region.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const dpr=Math.min(window.devicePixelRatio||1,2),w=rect.width,h=rect.height;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    for(const [x,y,b] of stars){ctx.fillStyle=`rgba(183,222,250,${.12+b*.48})`;ctx.beginPath();ctx.arc(x*w,y*h,.35+b*.65,0,Math.PI*2);ctx.fill();}
    const cx=w*.49,cy=h*.53,r=Math.min(w*.44,h*.48), glow=ctx.createRadialGradient(cx,cy,r*.63,cx,cy,r*1.2);
    glow.addColorStop(0,'rgba(10,29,45,0)');glow.addColorStop(.72,'rgba(58,143,195,.08)');glow.addColorStop(.86,'rgba(107,195,245,.26)');glow.addColorStop(1,'rgba(25,76,119,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,r*1.2,0,Math.PI*2);ctx.fill();
    const disk=ctx.createRadialGradient(cx-r*.3,cy-r*.4,0,cx,cy,r);disk.addColorStop(0,'#11283a');disk.addColorStop(.65,'#071421');disk.addColorStop(1,'#02070d');ctx.fillStyle=disk;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
    const cyaw=Math.cos(yaw),syaw=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    for(const [x,y,z,i] of points){const xx=x*cyaw-z*syaw,zz=x*syaw+z*cyaw,yy=y*cp-zz*sp,depth=y*sp+zz*cp;if(depth<0)continue;const alpha=.13+depth*.52+((i%13===0)? .2:0);ctx.fillStyle=`rgba(159,216,246,${Math.min(alpha,.85)})`;ctx.fillRect(cx+xx*r,cy+yy*r,depth>.8?1.5:1,depth>.8?1.5:1);}
    ctx.strokeStyle='rgba(160,223,255,.4)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
    for(const [x,y,z] of [[-.52,-.36,.77],[.33,-.42,.84],[-.31,.19,.93],[.57,.12,.81],[-.07,.53,.84]]){const xx=x*cyaw-z*syaw,zz=x*syaw+z*cyaw,yy=y*cp-zz*sp,depth=y*sp+zz*cp;if(depth<=0)continue;const px=cx+xx*r,py=cy+yy*r;ctx.strokeStyle='rgba(137,224,251,.35)';ctx.lineWidth=.7;for(const rad of [8,15,23]){ctx.beginPath();ctx.arc(px,py,rad,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#a1efff';ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();}
    region.dataset.orientation=`${yaw.toFixed(2)},${pitch.toFixed(2)}`;
  }
  function rotate(dx,dy){yaw+=dx;pitch=Math.max(-1.2,Math.min(1.2,pitch+dy));draw();}
  region.addEventListener('keydown',event=>{const keys={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};if(!keys[event.key])return;event.preventDefault();rotate(...keys[event.key]);});
  region.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};region.setPointerCapture(event.pointerId);});
  region.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;rotate((event.clientX-drag.x)*.008,(event.clientY-drag.y)*.008);drag.x=event.clientX;drag.y=event.clientY;});
  const stop=event=>{if(drag?.id===event.pointerId)drag=null;};region.addEventListener('pointerup',stop);region.addEventListener('pointercancel',stop);region.addEventListener('lostpointercapture',stop);
  reset.addEventListener('click',()=>{yaw=-.45;pitch=.2;draw();});
  // El modelo externo se abre en un diálogo propio: nunca debajo del título de portada.
  // Sketchfab es un recurso ilustrativo, NO geometría astronómica ni imagen SPHEREx.
  const sketchfabBtn = document.querySelector('#portal-sketchfab-toggle');
  const portalEntry = document.querySelector('.portal-model-entry');
  const modelLink = 'https://sketchfab.com/3d-models/solar-system-custom-c4d55b801842497c9900c7dbcea1727c';
  const embedUrl = 'https://sketchfab.com/models/c4d55b801842497c9900c7dbcea1727c/embed?autostart=1&ui_theme=dark&annotations_visible=0&ui_hint=0';
  let sketchfabFrame = null;
  const dialog = document.createElement('dialog');
  dialog.id = 'portal-model-dialog';
  dialog.className = 'portal-model-dialog';
  dialog.setAttribute('aria-labelledby', 'portal-model-title');
  dialog.innerHTML = `
    <div class="portal-model-layout">
      <header class="portal-model-header">
        <div><span>SPHERALYX AI · VISOR EXTERNO 3D</span>
          <h2 id="portal-model-title">Sistema Solar ilustrativo</h2>
          <p>Modelo de divulgación · no representa tamaños, distancias ni observaciones SPHEREx a escala.</p></div>
        <button type="button" class="portal-model-close" aria-label="Cerrar modelo tridimensional">✕ Cerrar</button>
      </header>
      <div class="portal-model-viewport" id="portal-model-viewport"></div>
      <footer class="portal-model-footer">
        <span>Modelo: <a href="${modelLink}" target="_blank" rel="noopener noreferrer">Solar System Custom</a> · Alberto Benítez · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY</a>.</span>
        <span>Sketchfab puede mostrar sus propios controles y paneles de inspección.</span>
      </footer>
    </div>`;
  document.body.append(dialog);
  const viewport = dialog.querySelector('#portal-model-viewport');
  const closeButton = dialog.querySelector('.portal-model-close');
  function closeModel() {
    if (dialog.open) dialog.close();
    if (sketchfabFrame) { sketchfabFrame.remove(); sketchfabFrame = null; }
    sketchfabBtn?.setAttribute('aria-pressed','false');
    portalEntry?.setAttribute('aria-pressed','false');
    sketchfabBtn.textContent = 'Ver modelo 3D ilustrativo ↗';
    sketchfabBtn?.focus();
  }
  function openModel() {
    if (dialog.open) return;
    sketchfabFrame = document.createElement('iframe');
    sketchfabFrame.className = 'portal-sketchfab-frame';
    sketchfabFrame.title = 'Sistema Solar ilustrativo de Alberto Benítez en Sketchfab (no a escala)';
    sketchfabFrame.src = embedUrl;
    sketchfabFrame.referrerPolicy = 'strict-origin-when-cross-origin';
    sketchfabFrame.allow = 'autoplay; fullscreen; xr-spatial-tracking';
    sketchfabFrame.setAttribute('allowfullscreen', '');
    viewport.append(sketchfabFrame);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open','');
    sketchfabBtn?.setAttribute('aria-pressed','true');
    portalEntry?.setAttribute('aria-pressed','true');
    sketchfabBtn.textContent = 'Modelo 3D abierto';
    closeButton.focus();
  }
  sketchfabBtn?.addEventListener('click', openModel);
  portalEntry?.addEventListener('click', openModel);
  closeButton.addEventListener('click', closeModel);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeModel(); });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeModel();
  });
  if('ResizeObserver' in window)new ResizeObserver(draw).observe(region);else window.addEventListener('resize',draw);
  draw();
}
