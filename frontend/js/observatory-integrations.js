/* Integraciones de atlas reales, opt-in y aisladas del análisis temporal SPHEREx.
   WorldWide Telescope: https://docs.worldwidetelescope.org/research-app/latest/embedding/
   SkyView CGI: https://skyview.gsfc.nasa.gov/current/docs/batchpage.html
   Los datos de contexto NO son dos épocas SPHEREx ni mediciones de movimiento. */
export function initObservatoryIntegrations() {
  initWorldWideTelescope();
  initSkyView();
}

function initWorldWideTelescope() {
  const button=document.querySelector('#wwt-load'),wrap=document.querySelector('#wwt-frame-wrap');
  const intro=document.querySelector('#wwt-intro'),status=document.querySelector('#wwt-status');
  if (![button,wrap,intro,status].every(Boolean)) return;
  let iframe=null;
  button.addEventListener('click',()=>{
    if(iframe){
      iframe.remove();iframe=null;wrap.hidden=true;intro.classList.remove('wwt-loaded');
      button.textContent='Activar WorldWide Telescope ↗';
      status.textContent='Atlas cerrado. La página no mantiene una conexión activa con WWT.';
      return;
    }
    iframe=document.createElement('iframe');
    iframe.title='WorldWide Telescope Research App — atlas astronómico externo e independiente de SPHEREx';
    iframe.referrerPolicy='strict-origin-when-cross-origin';
    iframe.allow='accelerometer; clipboard-write; gyroscope; fullscreen';
    iframe.allowFullscreen=true;
    iframe.loading='lazy';
    iframe.src='https://web.wwtassets.org/research/latest/';
    iframe.addEventListener('load',()=>{
      if(iframe?.isConnected)status.textContent='Se cargó la página de WWT. Si no se ve el atlas, utiliza el enlace oficial para abrirlo directamente.';
    });
    wrap.replaceChildren(iframe);wrap.hidden=false;intro.classList.add('wwt-loaded');
    button.textContent='Cerrar atlas inmersivo';
    status.textContent='Cargando WorldWide Telescope desde su alojamiento oficial…';
  });
}

function initSkyView() {
  const root=document.querySelector('#skyview-context');
  if(!root)return;
  const button=root.querySelector('#skyview-load'),status=root.querySelector('#skyview-status');
  const allowed={ 'DSS2 Red':'Óptico · DSS2 Red','2MASS-K':'Infrarrojo cercano · 2MASS-K' };
  let batch=0;
  const buildUrl=(ra,dec,survey)=>{
    const q=new URLSearchParams({
      Position:ra.toFixed(6)+','+dec.toFixed(6),
      Survey:survey, Coordinates:'J2000', Projection:'Tan',
      Size:'0.2',Pixels:'600', Scaling:'Sqrt', Return:'JPEG'
    });
    return 'https://skyview.gsfc.nasa.gov/cgi-bin/images?'+q.toString();
  };
  const official='https://skyview.gsfc.nasa.gov/current/cgi/query.pl';
  button.addEventListener('click',()=>{
    const raField=document.querySelector('#ra'),decField=document.querySelector('#dec');
    const ra=Number(raField?.value),dec=Number(decField?.value);
    if(!raField?.value||!decField?.value||!Number.isFinite(ra)||!Number.isFinite(dec)||ra<0||ra>=360||dec< -90||dec>90){
      status.textContent='Indica coordenadas RA (0–360°) y Dec (−90–90°) válidas en Cosmic Explorer.';
      raField?.focus();return;
    }
    const current=++batch;
    const selected=['a','b'].map(key=>({
      key, survey:root.querySelector('#skyview-survey-'+key).value
    }));
    if(selected.some(s=>!(s.survey in allowed))){
      status.textContent='Relevamiento no permitido. Selecciona un archivo de la lista.';return;
    }
    button.disabled=true;
    let pending=2,loaded=0;
    status.textContent='Consultando imágenes de archivo en NASA SkyView; el servicio externo puede tardar o no responder…';
    const complete=()=>{
      if(current!==batch)return;
      pending--;
      if(!pending){
        button.disabled=false;
        status.textContent=loaded===2
          ?'Dos imágenes de archivo recuperadas para las coordenadas indicadas. Son relevamientos, no épocas SPHEREx.'
          :loaded===1?'Solo una imagen pudo recuperarse. Consulta los enlaces oficiales para revisar la otra.'
          :'SkyView no devolvió imágenes en esta conexión. Usa los enlaces oficiales de cada vista.';
      }
    };
    selected.forEach(({key,survey})=>{
      const image=root.querySelector('#skyview-image-'+key);
      const empty=root.querySelector('#skyview-empty-'+key);
      const caption=root.querySelector('#skyview-caption-'+key);
      const coords=root.querySelector('#skyview-coords-'+key);
      const link=root.querySelector('#skyview-link-'+key);
      const url=buildUrl(ra,dec,survey);
      image.hidden=true;image.removeAttribute('src');
      empty.hidden=false;
      empty.querySelector('strong').textContent='Consultando NASA SkyView…';
      empty.querySelector('small').textContent='Esperando imagen de archivo oficial.';
      caption.textContent=allowed[survey];
      coords.textContent='ICRS · RA '+ra.toFixed(4)+'° · Dec '+dec.toFixed(4)+'° · campo 0.2°';
      const query=new URLSearchParams({Position:ra.toFixed(6)+','+dec.toFixed(6),Survey:survey});
      link.href=official+'?'+query.toString();
      image.onload=()=>{
        if(current!==batch)return;
        if(image.naturalWidth>0&&image.naturalHeight>0){
          loaded++;
          image.hidden=false;empty.hidden=true;
        }
        complete();
      };
      image.onerror=()=>{
        if(current!==batch)return;
        image.hidden=true;empty.hidden=false;
        empty.querySelector('strong').textContent='No se pudo recuperar la imagen';
        empty.querySelector('small').textContent='Puedes consultar este relevamiento directamente en NASA.';
        complete();
      };
      image.src=url;
    });
  });
}
