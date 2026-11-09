import { initExplorer } from './explorer.js';
import { initTimeline } from './timeline.js';
import { initSimulation } from './simulation.js';
import { initAnalysis } from './ai-analysis.js';
import { initRealComparison } from './real-comparison.js';
import { initMissionWorkspace } from './mission-workspace.js';
import { initMissionPortal } from './mission-portal.js';
import { initCosmic3D } from './cosmic-3d.js';
import { initTemporalExplorer } from './temporal-explorer.js';

initExplorer(); initTimeline(); initSimulation(); initAnalysis(); initRealComparison(); initTemporalExplorer(); initMissionWorkspace(); initMissionPortal(); initCosmic3D();
// El logotipo oficial se muestra únicamente si la imagen cargada es válida.
const logo=document.querySelector('.brand-logo'),symbol=document.querySelector('.brand-symbol');
const updateLogo=()=>{const usable=logo.naturalWidth>1&&logo.naturalHeight>1;logo.hidden=!usable;symbol.hidden=usable;};
logo.addEventListener('load',updateLogo);logo.addEventListener('error',updateLogo);if(logo.complete)updateLogo();
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#navigation');
const closeMenu=()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');};
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
window.addEventListener('hashchange',closeMenu);
nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
const links=[...document.querySelectorAll('#navigation a, .mission-rail-nav a')];
const markActive=id=>links.forEach(link=>{
  const active=link.getAttribute('href')===`#${id}`;
  link.classList.toggle('active',active);
  if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
});
if(location.hash&&document.querySelector(location.hash))markActive(location.hash.slice(1));
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting)markActive(entry.target.id);});},{rootMargin:'-20% 0px -65% 0px'});links.forEach(link=>{const section=document.querySelector(link.getAttribute('href'));if(section)observer.observe(section);});}

// Informa el modo de datos del servidor; la disponibilidad upstream sigue sin verificarse.
const headerDataStatus = document.querySelector('.header-status');
if (headerDataStatus) {
  fetch('/health', { cache: 'no-store' }).then(async response => {
    if (!response.ok) return;
    const data = await response.json();
    if (data?.data_mode === 'offline') {
      headerDataStatus.innerHTML = '<i aria-hidden="true"></i> DEMO OFFLINE · GAIA / WISE / IRSA DESACTIVADOS';
      headerDataStatus.classList.add('status-offline');
      const offlineCheckbox = document.querySelector('#offline-mode');
      if (offlineCheckbox && !offlineCheckbox.checked) {
        offlineCheckbox.checked = true;
        offlineCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      headerDataStatus.setAttribute('title', 'El 3D funciona; las consultas astronómicas externas están bloqueadas por el servidor.');
    } else if (data?.data_mode === 'real') {
      headerDataStatus.innerHTML = '<i aria-hidden="true"></i> MODO REAL · SERVICIOS NO VERIFICADOS';
      headerDataStatus.setAttribute('title', 'Las consultas están habilitadas; NASA y ESA pueden no responder.');
    }
  }).catch(() => { /* Estado desconocido: conservar el texto original. */ });
}
