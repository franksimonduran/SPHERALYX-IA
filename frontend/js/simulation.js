import { state, update, observations } from './api.js';
export function initSimulation() {
  const play=document.querySelector('#play'),speed=document.querySelector('#speed');let timer=null;
  const advance=step=>update({epoch:(state.epoch+step+observations.length)%observations.length});
  const stop=()=>{if(timer!==null)clearInterval(timer);timer=null;play.textContent='▶';play.setAttribute('aria-label','Reproducir');play.setAttribute('aria-pressed','false');};
  const start=()=>{if(timer!==null)return;timer=setInterval(()=>advance(1),Number(speed.value));play.textContent='❚❚';play.setAttribute('aria-label','Pausar');play.setAttribute('aria-pressed','true');};
  play.addEventListener('click',()=>timer?stop():start());speed.addEventListener('change',()=>{if(timer){stop();start();}});document.querySelector('#previous').addEventListener('click',()=>advance(-1));document.querySelector('#next').addEventListener('click',()=>advance(1));
  document.querySelector('#reset-timeline').addEventListener('click',()=>{stop();update({epoch:0});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(link&&link.getAttribute('href')!=='#simulacion')stop();});
  window.addEventListener('hashchange',()=>{if(location.hash!=='#simulacion')stop();});
}
