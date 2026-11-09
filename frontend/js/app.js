import { initExplorer } from './explorer.js';
import { initTimeline } from './timeline.js';
import { initSimulation } from './simulation.js';
import { initAnalysis } from './ai-analysis.js';
import { initRealComparison } from './real-comparison.js';
import { initMissionWorkspace } from './mission-workspace.js';
import { initMissionPortal } from './mission-portal.js';
import { initCosmic3D } from './cosmic-3d.js';
import { initGaiaVisualization } from './gaia-visualization.js';
import { initTemporalExplorer } from './temporal-explorer.js';

initExplorer(); initTimeline(); initSimulation(); initAnalysis(); initRealComparison(); initTemporalExplorer(); initMissionWorkspace(); initMissionPortal(); initGaiaVisualization(); initCosmic3D();
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
    document.body.dataset.catalogMode = data?.catalog_mode === 'real' ? 'real' : 'offline';
    document.body.dataset.irsaMode = data?.data_mode === 'offline' ? 'offline' : 'real';
    const irsaLocked = data?.data_mode === 'offline';
    const irsaNotice = document.querySelector('#real-status');
    const irsaSearch = document.querySelector('#real-search button[type="submit"]');
    const cosmicSearch = document.querySelector('#cosmic-search');
    const compareSearch = document.querySelector('#compare-real-form button[type="submit"]');
    const pairSearch = document.querySelector('#find-pairs');
    // En un servidor restringido no ofrecemos acciones que inevitablemente fallan.
    // La casilla offline es una decisión manual y NUNCA representa automáticamente
    // el estado de SPHEREx en el backend (Gaia/WISE pueden seguir online).
    for (const button of [irsaSearch, cosmicSearch, compareSearch, pairSearch]) {
      if (button) {
        button.disabled = irsaLocked;
        if (irsaLocked) button.title = 'SPHEREx/IRSA no está habilitado en este servidor. Gaia y WISE pueden consultarse por separado.';
        else button.removeAttribute('title');
      }
    }
    if (irsaLocked && irsaNotice) {
      irsaNotice.textContent = 'SPHEREx no disponible en este servidor: búsqueda FITS y comparación temporal desactivadas. Gaia DR3 y AllWISE pueden consultarse desde Cosmic Explorer.';
      irsaNotice.classList.add('real-status-server-offline');
    }
    if (data?.data_mode === 'offline' && data?.catalog_mode === 'real') {
      headerDataStatus.innerHTML = '<i aria-hidden="true"></i> GAIA / WISE HABILITADOS · SPHEREx OFFLINE';
      headerDataStatus.classList.add('status-offline');
      headerDataStatus.setAttribute('title', 'Los catálogos reales están disponibles con cuota. Las consultas FITS y temporales de IRSA siguen offline.');
    } else if (data?.data_mode === 'offline') {
      headerDataStatus.innerHTML = '<i aria-hidden="true"></i> DEMO OFFLINE · GAIA / WISE / IRSA DESACTIVADOS';
      headerDataStatus.classList.add('status-offline');
      headerDataStatus.setAttribute('title', 'El 3D funciona; las consultas astronómicas externas están bloqueadas por el servidor.');
    } else if (data?.data_mode === 'real') {
      headerDataStatus.innerHTML = '<i aria-hidden="true"></i> MODO REAL · SERVICIOS NO VERIFICADOS';
      headerDataStatus.setAttribute('title', 'Las consultas están habilitadas; NASA y ESA pueden no responder.');
    }
  }).catch(() => { /* Estado desconocido: conservar el texto original. */ });
}
