import { initExplorer } from './explorer.js';
import { initTimeline } from './timeline.js';
import { initSimulation } from './simulation.js';
import { initAnalysis } from './ai-analysis.js';
import { initRealComparison } from './real-comparison.js';
import { initMissionWorkspace } from './mission-workspace.js';

initExplorer(); initTimeline(); initSimulation(); initAnalysis(); initRealComparison(); initMissionWorkspace();
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
