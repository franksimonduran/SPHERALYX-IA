import { initExplorer } from './explorer.js';
import { initTimeline } from './timeline.js';
import { initSimulation } from './simulation.js';
import { initAnalysis } from './ai-analysis.js';
import { initRealComparison } from './real-comparison.js';

initExplorer(); initTimeline(); initSimulation(); initAnalysis(); initRealComparison();
// El archivo distribuido es un marcador 1×1, no el logotipo oficial.
const logo=document.querySelector('.brand-logo'),symbol=document.querySelector('.brand-symbol');
const updateLogo=()=>{const usable=logo.naturalWidth>1&&logo.naturalHeight>1;logo.hidden=!usable;symbol.hidden=usable;};
logo.addEventListener('load',updateLogo);logo.addEventListener('error',updateLogo);if(logo.complete)updateLogo();
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#navigation');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});
nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}});
const links=[...nav.querySelectorAll('a')];
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting)links.forEach(link=>link.classList.toggle('active',link.getAttribute('href')===`#${entry.target.id}`));});},{rootMargin:'-20% 0px -65% 0px'});links.forEach(link=>{const section=document.querySelector(link.getAttribute('href'));if(section)observer.observe(section);});}
