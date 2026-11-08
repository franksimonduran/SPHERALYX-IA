import { state, events, update, observations } from './api.js';
import { drawField } from './explorer.js';

export function initTimeline() {
  const range=document.querySelector('#timeline-range'),first=document.querySelector('#compare-first'),current=document.querySelector('#compare-current');
  const render=()=>{range.value=String(state.epoch);document.querySelector('#timeline-label').textContent=`${String(state.epoch+1).padStart(2,'0')} / ${String(observations.length).padStart(2,'0')}`;document.querySelector('#compare-label').textContent=`ACTUAL · ${observations[state.epoch].label.toUpperCase()}`;drawField(first,0,{markers:true});drawField(current,state.epoch,{markers:true});};
  range.addEventListener('input',()=>update({epoch:Number(range.value)}));events.addEventListener('change',render);window.addEventListener('resize',render);render();
}
