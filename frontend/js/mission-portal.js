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
  // El modelo de terceros vive DENTRO del viewport de la portada.
  // El botón principal y los créditos se integran sin dialog ni nueva pantalla.
  const sketchfabBtn = document.querySelector('#portal-sketchfab-toggle');
  const portalEntry = document.querySelector('.portal-model-entry');
  const stage = document.querySelector('.portal-stage');
  const embedUrl = 'https://sketchfab.com/models/c4d55b801842497c9900c7dbcea1727c/embed?autostart=1&ui_theme=dark&annotations_visible=0&ui_hint=0';
  let sketchfabFrame = null;
  const toolbar = document.createElement('div');
  toolbar.className = 'portal-inline-toolbar';
  toolbar.hidden = true;
  toolbar.innerHTML = `<span>MODELO 3D ILUSTRATIVO · SIN ESCALA REAL</span>
    <button type="button" class="portal-inline-close" aria-label="Cerrar modelo 3D y regresar a la portada">✕ Volver a la portada</button>`;
  const toolbarClose = toolbar.querySelector('button');
  toolbar.addEventListener('pointerdown', event => event.stopPropagation());
  toolbar.addEventListener('click', event => event.stopPropagation());
  const credit = document.createElement('div');
  credit.className = 'portal-inline-credit';
  credit.hidden = true;
  credit.innerHTML = 'Solar System Custom · Alberto Benítez · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY</a> · Sketchfab';
  credit.addEventListener('pointerdown', event => event.stopPropagation());
  region.append(toolbar, credit);
  function closeModel() {
    if (sketchfabFrame) { sketchfabFrame.remove(); sketchfabFrame = null; }
    stage.classList.remove('portal-inline-model-active');
    region.classList.remove('portal-sketchfab-active');
    toolbar.hidden = true;
    credit.hidden = true;
    sketchfabBtn?.setAttribute('aria-pressed', 'false');
    portalEntry?.setAttribute('aria-pressed', 'false');
    sketchfabBtn.textContent = 'Ver modelo 3D ilustrativo ↗';
    portalEntry?.focus();
    draw();
  }
  function openModel() {
    if (sketchfabFrame) return;
    sketchfabFrame = document.createElement('iframe');
    sketchfabFrame.className = 'portal-sketchfab-frame';
    sketchfabFrame.title = 'Modelo 3D ilustrativo Solar System Custom de Alberto Benítez en Sketchfab; no a escala';
    sketchfabFrame.src = embedUrl;
    sketchfabFrame.referrerPolicy = 'strict-origin-when-cross-origin';
    sketchfabFrame.allow = 'autoplay; fullscreen; xr-spatial-tracking';
    sketchfabFrame.setAttribute('allowfullscreen', '');
    region.append(sketchfabFrame);
    stage.classList.add('portal-inline-model-active');
    region.classList.add('portal-sketchfab-active');
    toolbar.hidden = false;
    credit.hidden = false;
    sketchfabBtn?.setAttribute('aria-pressed', 'true');
    portalEntry?.setAttribute('aria-pressed', 'true');
    toolbarClose.focus();
  }
  sketchfabBtn?.addEventListener('click', openModel);
  portalEntry?.addEventListener('click', openModel);
  toolbarClose.addEventListener('click', closeModel);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sketchfabFrame) { event.preventDefault(); closeModel(); }
  });
  if('ResizeObserver' in window)new ResizeObserver(draw).observe(region);else window.addEventListener('resize',draw);
  draw();
}
