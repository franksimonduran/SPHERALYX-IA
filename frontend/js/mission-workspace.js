/* Mission Workspace — presentation-only DOM composition.
   Reuses all existing forms, IDs and event listeners. No API changes. */
export function initMissionWorkspace(){
  const panel=document.querySelector('.real-panel');
  if(!panel || panel.querySelector('.real-workspace-grid'))return;
  const heading=panel.querySelector(':scope > .panel-title');
  const intro=panel.querySelector(':scope > p');
  const offline=panel.querySelector('#offline-mode')?.closest('label');
  const documentary=panel.querySelector(':scope > details');
  const form=panel.querySelector('#real-search');
  const status=panel.querySelector('#real-status');
  const observations=panel.querySelector('#real-observations');
  const preview=panel.querySelector('#real-preview');
  const metadata=panel.querySelector('#real-metadata');
  const compare=panel.querySelector('.real-compare');
  if(!heading || !form || !status || !observations || !preview || !compare)return;
  panel.classList.add('mission-real-workspace');
  const grid=document.createElement('div');grid.className='real-workspace-grid';
  const makeColumn=(name,kicker,title)=>{
    const col=document.createElement('div');col.className='mission-workspace-column '+name;
    const label=document.createElement('div');label.className='workspace-column-head';
    const eyebrow=document.createElement('span');eyebrow.textContent=kicker;
    const h=document.createElement('h4');h.textContent=title;
    label.append(eyebrow,h);col.append(label);return col;
  };
  const controls=makeColumn('real-workspace-controls','01 / CONFIGURACIÓN','Consulta científica');
  const image=makeColumn('real-workspace-image','02 / VISUALIZACIÓN','Visor FITS / PNG');
  const results=makeColumn('real-workspace-results','03 / RESULTADOS','Observaciones IRSA');
  [intro,offline,documentary,form,status].filter(Boolean).forEach(el=>controls.append(el));
  const viewport=document.createElement('div');viewport.className='real-image-viewport';
  const label=document.createElement('div');label.className='real-image-empty';
  const graphic=document.createElement('span');graphic.setAttribute('aria-hidden','true');graphic.className='image-empty-graphic';graphic.textContent='⊕';
  const emptyTitle=document.createElement('strong');emptyTitle.textContent='Esperando una observación real';
  const emptyText=document.createElement('p');emptyText.textContent='Busca en IRSA y selecciona un producto para visualizar su recorte FITS. No se muestra una imagen sintética en este panel.';
  label.append(graphic,emptyTitle,emptyText);
  viewport.append(preview,label);image.append(viewport);
  if(metadata)image.append(metadata);
  const resultsHelp=document.createElement('p');resultsHelp.className='workspace-results-help';
  resultsHelp.textContent='Los resultados se obtienen de NASA/IPAC IRSA. Selecciona una observación para visualizar su producto.';
  results.append(resultsHelp,observations);
  grid.append(controls,image,results);
  heading.insertAdjacentElement('afterend',grid);
  compare.classList.add('mission-compare-workspace');
  // Navigation closes over existing anchors, including Validation Lab injected by initAnalysis.
  const nav=document.querySelector('.mission-rail-nav');
  if(nav){
    const links=[...nav.querySelectorAll('a[href^="#"]')];
    function update(){
      const hash=location.hash||'#inicio';
      links.forEach(a=>{
        const active=a.getAttribute('href')===hash;
        a.classList.toggle('active',active);
        if(active)a.setAttribute('aria-current','location');
        else a.removeAttribute('aria-current');
      });
    }
    window.addEventListener('hashchange',update);update();
  }
  // Background image is conceptual and must remain distinguished from IRSA data.
}
