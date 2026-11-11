// Prueba de integración sin dependencias: node frontend/tests/audit.mjs
// Requiere Chrome o Edge; CHROME_PATH permite especificar el ejecutable.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let metadataRequests=0, previewRequests=0;
let restrictServer = false;
const browser = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && existsSync(p));
if (!browser) throw new Error('No se encontró Chrome o Edge. Define CHROME_PATH.');
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.webp':'image/webp' };
const server = createServer(async (req,res) => {
  if(req.url==='/__test/server-restrict') {restrictServer=true;res.writeHead(200);res.end('ok');return;}
  if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:'ok',data_mode:restrictServer?'offline':'real',catalog_mode:'real',upstream_checked:false}));return;}
  if(req.url==='/api/experimental/classification' && req.method==='POST'){
    const group={sources:1,tp:1,fp:0,fn:0,recall:1},row={stationary:0,possibly_moving:1,ambiguous:0,insufficient:0};
    const classification={tp:1,fp:0,fn:0,precision:1,recall:1,f1:1,false_motion_rate:0,ambiguity_rate:0,confusion:{stationary:{...row,possibly_moving:0},moving:row},by_brightness:{faint:group,bright:group}};
    const track={id:1,class:'possibly_moving',points:[{epoch:0,x:20,y:20},{epoch:1,x:22,y:20},{epoch:2,x:24,y:20}],displacement_east_north_arcsec:[-4,0],velocity_east_north_arcsec_day:[-.2,0],velocity_sigma_per_axis_arcsec_day:.01,reduced_residual_heuristic:.1};
    const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aAAAAABJRU5ErkJggg==';
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({metrics:{classification,association:{tp:2,fp:0,fn:0,precision:1,recall:1},mean_vector_error_arcsec:.1,mean_velocity_error_arcsec_day:.01,error_sample_count:1},images:[image,image,image],registration:[{shift_px:[0,0]},{shift_px:[0,0]},{shift_px:[0,0]}],tracks:[track],warnings:['Solo sintético']}));return;
  }
  if(req.url==='/api/experimental/validation' && req.method==='POST'){
    let body='';for await (const chunk of req) body+=chunk;
    const params=JSON.parse(body);if(params.seed===79){res.writeHead(503);res.end();return;}
    const metrics={tp:3,fp:1,fn:2,precision:params.seed===78?null:.75,recall:.6,f1:2/3,mean_error_arcsec:params.seed===78?null:.1,bootstrap_95:{precision:params.seed===78?null:[.5,1],recall:[.3,.8],f1:[.4,.9]},error_distribution_arcsec:{count:3,p50:.08,p90:.2}};
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({scenarios:[{seed:params.seed,detections:[4,4],conservative:metrics,baseline:metrics,elapsed_seconds:.1}],methods:{conservative:metrics,baseline:metrics},ambiguity:{ambiguous_edges:1,candidate_edges:4,rate:.25},elapsed_seconds:.2,warnings:['Solo campos sintéticos']}));return;
  }
  if(req.url==='/api/experimental/motion' && req.method==='POST'){
    const a={x:20,y:30,sigma_pixel:.03},b={x:23,y:32,sigma_pixel:.03};
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({size:128,detections:[[a],[b]],measurements:[{a,b,displacement_arcsec:3.6,uncertainty_arcsec:.04,velocity_arcsec_day:.36,uncertainty_velocity_arcsec_day:.004}],metrics:{true_positive:1,false_positive:0,false_negative:0,precision:1,recall:1,mean_absolute_displacement_error_arcsec:.01},ambiguous_edges:0,warnings:['Datos sintéticos']}));return;
  }
  if(req.url==='/api/temporal/pairs' && req.method==='POST'){
    let requestBody='';for await(const chunk of req)requestBody+=chunk;
    if(JSON.parse(requestBody).ra===12.34) await new Promise(resolve=>setTimeout(resolve,500));
    const a={id:'a'.repeat(64),observation_id:'TEST-A',band:'D2',time_start_mjd:60000},b={id:'b'.repeat(64),observation_id:'TEST-B',band:'D2',time_start_mjd:60001};
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({evaluated_count:1,candidates_prefiltered:1,accepted_count:0,notice:'simulado',pairs:[{a,b,detector:'D2',release:'qr2',status:'rechazado',reasons:['Calibración no verificada'],coverage_fraction:.7,spectral_match_fraction:.2,spectral_status:'aproximada_no_verificada'}]}));return;
  }
  if(req.url==='/api/temporal/compare' && req.method==='POST'){
    let body='';for await(const chunk of req)body+=chunk;const params=JSON.parse(body),incompatible=params.b==='c'.repeat(64);
    if(params.a==='c'.repeat(64)){res.writeHead(504,{'content-type':'application/json'});res.end(JSON.stringify({detail:'Tiempo de comparación agotado'}));return;}
    if(params.a==='b'.repeat(64)&&params.b==='a'.repeat(64))await new Promise(resolve=>setTimeout(resolve,400));
    const img='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aAAAAABJRU5ErkJggg==';
    const observation={observation_id:'TEST-IRSA',band:'D2',time_start_mjd:60000,release:'qr2'};
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({mode:'real',compatible:!incompatible,reasons:incompatible?['CWAVE/CBAND no verificadas']:[],coverage_fraction:.8,warning:'Exploratorio',a:observation,b:observation,fits_a:{date_obs:'2025-01-01'},fits_b:{date_obs:'2025-02-01'},views:{a:img,b:img,coverage:img,difference:img}}));return;
  }
  if (req.url.startsWith('/api/gaia/sources')) {
    if(req.url.includes('ra=12.34')) await new Promise(resolve=>setTimeout(resolve,500));
    if(req.url.includes('ra=22.34')){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({detail:'ESA Gaia TAP no disponible'}));return;}
    if(req.url.includes('ra=44.44')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({mode:'real',source:'ESA Gaia Archive TAP',catalog:'Gaia DR3 (gaiadr3.gaia_source)',reference_epoch:'J2016.0',count:0,limit:120,truncated:false,sources:[]}));return;}
    const truncated=req.url.includes('ra=33.33');
    const sources=[
      {source_id:'3017364063331140096',catalog:'Gaia DR3',ra:83.8221,dec:-5.3911,l:209.014,b:-19.381,ref_epoch:2016.0,phot_g_mean_mag:11.452,bp_rp:0.612,phot_bp_mean_mag:11.72,phot_rp_mean_mag:11.108,pmra:1.25,pmra_error:0.032,pmdec:-0.84,pmdec_error:0.029,parallax:2.41,parallax_error:0.035,ruwe:1.021,separation_arcsec:0.0},
      {source_id:'3017364063331140097',catalog:'Gaia DR3',ra:83.8255,dec:-5.3885,l:209.019,b:-19.376,ref_epoch:2016.0,phot_g_mean_mag:15.81,bp_rp:null,phot_bp_mean_mag:null,phot_rp_mean_mag:null,pmra:null,pmra_error:null,pmdec:-2.1,pmdec_error:0.12,parallax:null,parallax_error:null,ruwe:null,separation_arcsec:15.32}
    ];
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({mode:'real',source:'ESA Gaia Archive TAP',catalog:'Gaia DR3 (gaiadr3.gaia_source)',reference_epoch:'J2016.0',count:sources.length,limit:120,truncated,sources}));return;
  }
  if (req.url.startsWith('/api/wise/sources')) {
    if(req.url.includes('ra=12.34')) await new Promise(resolve=>setTimeout(resolve,500));
    if(req.url.includes('ra=22.34')){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({detail:'IRSA TAP AllWISE no disponible'}));return;}
    if(req.url.includes('ra=44.44')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({mode:'real',source:'NASA/IPAC IRSA TAP',catalog:'AllWISE Source Catalog (allwise_p3as_psd)',association_status:'candidata_por_proximidad_no_confirmada',count:0,limit:120,truncated:false,sources:[]}));return;}
    const sources=[
      {source_id:'J053517.30-052327.9',designation:'J053517.30-052327.9',catalog:'AllWISE',ra:83.822083,dec:-5.391083,w1mpro:8.912,w1sigmpro:0.023,w2mpro:8.451,w2sigmpro:0.021,w3mpro:6.12,w3sigmpro:0.045,w4mpro:3.81,w4sigmpro:null,ph_qual:'AAAB',cc_flags:'0000',ext_flg:0,separation_arcsec:0.08,association_status:'candidata_no_confirmada'}
    ];
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({mode:'real',source:'NASA/IPAC IRSA TAP',catalog:'AllWISE Source Catalog (allwise_p3as_psd)',association_status:'candidata_por_proximidad_no_confirmada',count:sources.length,limit:120,truncated:false,sources}));return;
  }
  // Respuestas de API controladas para verificar integración sin depender de IRSA.
  if (req.url.startsWith('/api/observations')) {
    if(req.url.includes('ra=12.34')) await new Promise(resolve=>setTimeout(resolve,500));
    if(req.url.includes('ra=22.34')){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({detail:'IRSA no disponible'}));return;}
    if(req.url.includes('ra=44.44')){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({mode:'real',limit:100,observations:[]}));return;}
    const id='a'.repeat(64), item={id,mode:'real',observation_id:'TEST-IRSA',band:'D2',time_start_mjd:60000,collection:'spherex_qr2',reference_url:'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/level2/example.fits'};
    if(req.url===`/api/observations/${id}`)metadataRequests++;
    if(req.url===`/api/observations/${id}/preview`){previewRequests++;res.writeHead(200,{'content-type':'image/png','X-Flagged-Pixels':'3'});res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aAAAAABJRU5ErkJggg==','base64'));return;}
    if(req.url===`/api/observations/${'b'.repeat(64)}/preview`){await new Promise(resolve=>setTimeout(resolve,400));res.writeHead(200,{'content-type':'image/png'});res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aAAAAABJRU5ErkJggg==','base64'));return;}
    if(req.url===`/api/observations/${'c'.repeat(64)}/preview`){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({detail:'Recorte no disponible'}));return;}
    if(req.url.includes('ra=33.33')){const a={...item,detector:'D2',observation_time_utc:'2023-02-25T00:00:00.000'},b={...item,id:'b'.repeat(64),observation_id:'TEST-IRSA-2',band:'D3',detector:'D3',time_start_mjd:59999},c={...item,id:'c'.repeat(64),observation_id:'SIN-FECHA',band:null,detector:null,time_start_mjd:null};res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({mode:'real',limit:4,observations:[a,c,b,a]}));return;}
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(req.url===`/api/observations/${id}`?item:{mode:'real',limit:100,observations:[item,{...item,id:'b'.repeat(64),observation_id:'TEST-IRSA-2',time_start_mjd:60001}]}));return;
  }
  try { const path=resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url,'http://localhost').pathname)); if(path!==root&&!path.startsWith(root+sep)) throw Error('ruta'); const data=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});res.end(data); }
  catch { res.writeHead(404);res.end(); }
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port, profile=await mkdtemp(resolve(tmpdir(),'spheralyx-audit-'));
const child=spawn(browser,['--headless=new','--disable-gpu','--disable-dev-shm-usage','--no-zygote','--no-sandbox','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let stderr='';child.stderr.on('data',x=>stderr+=x);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let socket;
try {
  let endpoint;
  for(let i=0;i<300&&!endpoint;i++){await wait(100);endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];}
  if(!endpoint)throw Error('Chrome no inició el protocolo de depuración: '+stderr.slice(-1800));
  const debugPort=new URL(endpoint).port;
  const target=await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
  let id=0;const pending=new Map(),errors=[];
  socket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);else if(msg.method==='Runtime.consoleAPICalled'&&msg.params.type==='error')errors.push('console.error: '+msg.params.args.map(x=>x.value||x.description).join(' '));};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,{resolve,reject});socket.send(JSON.stringify({id:request,method,params}));});
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  let ready=false;
  for(let i=0;i<150;i++){
    ready=await evaluate(`location.href.startsWith('http://127.0.0.1:${port}/') && document.readyState === 'complete' && !!document.querySelector('#compare-real-title') && !!document.querySelector('#cosmic-sphere') && !!document.querySelector('#coordinates-form')`);
    if(ready)break;
    await wait(100);
  }
  if(!ready)throw Error('Inicialización incompleta: '+JSON.stringify({state:await evaluate("({url:location.href,readyState:document.readyState,temporal:!!document.querySelector('#compare-real-title')})"),errors}));
  async function check(name, expression){if(!await evaluate(expression))throw Error(`FALLO: ${name}`);console.log('OK:',name);}
  await check('solo módulos de archivos reales, sin candidatos o simulaciones públicas',"(()=>{const ids=['inicio','explorador','real-title','compare-real-title','calibracion-educativa','gaia-linked-views'];return ids.every(id=>!!document.getElementById(id))&&['simulacion','analisis','descubrimientos','classification-lab','validation-lab'].every(id=>!document.getElementById(id))&&!document.querySelector('#sky')&&!document.querySelector('#offline-mode')&&!document.querySelector('[id^=run-analysis]')})()");
  await check('iconos locales de navegación y nombres accesibles',`(async()=>{const links=[...document.querySelectorAll('.mission-rail-nav a')],icons=links.map(a=>a.querySelector('.nav-icon'));if(links.length!==6||icons.some(i=>!i||i.getAttribute('aria-hidden')!=='true'||getComputedStyle(i).maskImage==='none')||links.some(a=>!a.textContent.trim()))return false;return (await Promise.all(['house','telescope','clock-3','orbit','flask-conical','book-open'].map(async name=>{const r=await fetch('/assets/lucide/'+name+'.svg');return r.ok&&(r.headers.get('content-type')||'').includes('image/svg+xml')&&(await r.text()).includes('<svg')}))).every(Boolean)})()`);
  await check('tres atlas oficiales visibles en sus apartados y sin petición externa inicial',`(()=>{
    const w=document.querySelector('#wwt-observatory'),s=document.querySelector('#skyview-context'),a=document.querySelector('.gaia-linked-grid>.gaia-sky-card');
    return !!w&&!!s&&!!a&&w.closest('#inicio')&&s.closest('.real-panel')!==null
      &&!!a.querySelector('#gaia-sky-open')&&!!a.querySelector('#gaia-aladin[hidden]')
      &&!!w.querySelector('#wwt-load')&&w.querySelector('#wwt-frame-wrap[hidden]')&&!w.querySelector('iframe')
      &&s.querySelectorAll('.skyview-image-well img:not([src])').length===2
      &&s.textContent.includes('no son dos épocas SPHEREx')&&s.textContent.includes('NASA SkyView');
  })()`);
  await check('tres atlas tienen accesos elegantes y rutas a las secciones correctas',`(()=>{
    const links=[...document.querySelectorAll('.observatory-atlas-links a')];
    return links.length===3
      &&links.map(a=>a.getAttribute('href')).join(',')==='#wwt-observatory,#gaia-linked-views,#skyview-context'
      &&links.every(a=>document.querySelector(a.getAttribute('href')))
      &&!!document.querySelector('#skyview-from-aladin')
      &&!!document.querySelector('#skyview-open-aladin');
  })()`);
  await check('SkyView elimina imágenes antiguas al cambiar coordenadas o relevamiento',`(()=>{
    const image=document.querySelector('#skyview-image-a'),empty=document.querySelector('#skyview-empty-a');
    const ra=document.querySelector('#ra'),survey=document.querySelector('#skyview-survey-a');
    const originalRa=ra.value,originalSurvey=survey.value;
    image.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aAAAAABJRU5ErkJggg==';
    image.hidden=false;empty.hidden=true;
    ra.value='83.823';ra.dispatchEvent(new Event('input',{bubbles:true}));
    const coordsReset=image.hidden&&!image.hasAttribute('src')&&!empty.hidden
      &&document.querySelector('#skyview-status').textContent.includes('Coordenadas modificadas');
    ra.value=originalRa;ra.dispatchEvent(new Event('input',{bubbles:true}));
    survey.value='2MASS-K';survey.dispatchEvent(new Event('change',{bubbles:true}));
    const surveyReset=document.querySelector('#skyview-status').textContent.includes('Relevamiento modificado')
      &&document.querySelector('#skyview-caption-a').textContent.includes('2MASS-K');
    survey.value=originalSurvey;survey.dispatchEvent(new Event('change',{bubbles:true}));
    return coordsReset&&surveyReset;
  })()`);
  await check('SkyView genera enlaces NASA por coordenadas verificadas, sin falsos FITS',`(async()=>{
    const source=await import('/js/observatory-integrations.js');
    if(typeof source.buildSkyViewUrl!=='function')return false;
    const address=source.buildSkyViewUrl(83.8221,-5.3911,'DSS2 Red');
    const u=new URL(address);
    return u.protocol==='https:'&&u.host==='skyview.gsfc.nasa.gov'&&u.pathname==='/cgi-bin/images'
      &&u.searchParams.get('Position')==='83.822100,-5.391100'
      &&u.searchParams.get('Survey')==='DSS2 Red'&&u.searchParams.get('Return')==='JPEG';
  })()`);
  await check('Temporal Explorer vacío con indicaciones honestas, sin mapas inventados',"(()=>{const range=document.querySelector('#temporal-range'),area=document.querySelector('.temporal-real-overview');return range.disabled&&document.querySelector('#temporal-use-a').disabled&&document.querySelector('#temporal-use-b').disabled&&document.querySelector('#temporal-current').textContent.includes('Busca observaciones reales')&&area.querySelector('#temporal-empty')&&!area.querySelector('.temporal-orbit')&&area.textContent.includes('datos reales')&&[...document.querySelectorAll('.temporal-individual img')].every(image=>image.hidden)})()");
  await check('portada con fondo del modelo solicitado y sin Sistema Solar anterior',`(()=>{const stage=document.querySelector('.portal-stage'),bg=document.querySelector('#portal-ambient'),frame=bg?.querySelector('.portal-ambient-frame');return !!stage&&!!bg&&!document.querySelector('.portal-ambient-attribution')&&frame?.src.includes('4a4e7aec37c04320a09ac4c7434b8810')&&frame?.title.includes('Alien Space Nebula 1')&&!document.querySelector('.portal-model-entry')&&!document.querySelector('#portal-sketchfab-toggle')&&!document.querySelector('#portal-sphere')&&!document.querySelector('#portal-reset')})()`);
  await check('modo 3D opcional mantiene visor 2D y fuentes sin inventar',`(()=>{const stage=document.querySelector('#cosmic-sphere'),b=document.querySelector('#cosmic-renderer-toggle'),state=document.querySelector('#cosmic-renderer-status');return !!b&&b.tagName==='BUTTON'&&b.getAttribute('aria-pressed')==='false'&&stage.dataset.renderMode==='2d'&&!!state&&stage.querySelector('#cosmic-canvas')&&stage.dataset.gaiaCount==='0'&&stage.dataset.wiseCount==='0'})()`);
  await check('fondo 3D es decorativo, sin captura de clics y con controles solicitados como opcionales',`(()=>{const frame=document.querySelector('.portal-ambient-frame'),bg=document.querySelector('.portal-ambient');return !!frame&&frame.getAttribute('tabindex')==='-1'&&getComputedStyle(frame).pointerEvents==='none'&&getComputedStyle(bg).pointerEvents==='none'&&frame.src.includes('ui_controls=0')&&frame.src.includes('ui_infos=0')&&frame.src.includes('annotations_visible=0')&&frame.src.includes('annotation_tooltip_visible=0')&&frame.src.includes('ui_animations=0')&&getComputedStyle(frame).borderTopWidth==='0px'&&frame.getBoundingClientRect().width>bg.getBoundingClientRect().width*1.2&&getComputedStyle(bg).overflow==='hidden'&&getComputedStyle(bg).maskImage!=='none'})()`);
  await check('proyección ecuatorial RA/Dec y polos',`(async()=>{const {projectEquatorial:p,unprojectEquatorial:u}=await import('/js/cosmic-3d.js');for(const [ra,dec] of [[0,0],[359.999,0],[20,90],[200,-90],[83.8221,-5.3911]]){const projected=p(ra,dec,ra,dec),back=u(projected.x,projected.y,ra,dec);if(!back||Math.abs(back.dec-dec)>1e-6||(Math.abs(dec)<89.999&&Math.abs(((back.ra-ra+540)%360)-180)>1e-6))return false;}return u(1.01,0,0,0)===null})()`);
  await check('selección 3D actualiza coordenadas sin consultar IRSA',`(()=>{const sky=document.querySelector('#cosmic-sphere'),ra=document.querySelector('#ra'),dec=document.querySelector('#dec'),beforeRa=ra.value,beforeDec=dec.value,original=window.fetch;let calls=0;window.fetch=(...args)=>{calls++;return original(...args)};sky.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));sky.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));const selected=ra.value!==beforeRa&&document.querySelector('#cosmic-ra').textContent.includes('88.8221')&&document.querySelector('#cosmic-selection-status').textContent.includes('Coordenadas actualizadas');ra.value=beforeRa;dec.value=beforeDec;ra.dispatchEvent(new Event('input',{bubbles:true}));dec.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#cosmic-center').click();window.fetch=original;return selected&&calls===0})()`);
  await check('selección 3D normaliza RA en 360 grados',`(()=>{const sky=document.querySelector('#cosmic-sphere'),ra=document.querySelector('#ra'),dec=document.querySelector('#dec'),a=ra.value,d=dec.value;ra.value='359.9999999';dec.value='0';document.querySelector('#cosmic-center').click();sky.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));const ok=Number(ra.value)===0;ra.value=a;dec.value=d;ra.dispatchEvent(new Event('input',{bubbles:true}));dec.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#cosmic-center').click();return ok})()`);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await check('contenido de misión permanece accesible encima del fondo decorativo',`(()=>{const intro=document.querySelector('.portal-intro'),panel=document.querySelector('.portal-mission-panel'),bg=document.querySelector('.portal-ambient');return getComputedStyle(bg).pointerEvents==='none'&&intro.querySelector('.portal-explore')&&panel.querySelectorAll('nav a').length===3})()`);



  await check('espacio REAL con coordenadas compartidas y controles accesibles',"(()=>{const panel=document.querySelector('.real-workspace-controls');return panel.contains(document.querySelector('#coordinates-form'))&&panel.contains(document.querySelector('#real-search'))&&!!document.querySelector('.real-image-viewport[tabindex=\"0\"]')&&document.querySelector('[aria-label=\"Acercar vista real\"]').disabled})()");
  await check('normalización cronológica y duplicados',`(async()=>{const {normalizeObservations:n}=await import('/js/real-observations.js');const rows=n([{id:'b',time_start_mjd:60001},{id:'none',time_start_mjd:null},{id:'a',time_start_mjd:60000},{id:'b',time_start_mjd:59900},{id:'utc',observation_time_utc:'2023-02-26T00:00:00.000'},{id:'',time_start_mjd:1}]);return rows.map(x=>x.id).join(',')==='a,b,utc,none'&&rows.at(-1).day===null&&rows[0].state==='disponible'})()`);
  await check('comparación educativa Webb separada del motor temporal científico',`(()=>{
    const el=document.querySelector('#calibracion-educativa');
    if(!el||!document.querySelector('.real-compare')||!document.querySelector('#real-title'))return false;
    const imgs=[...el.querySelectorAll('.spectral-layer img')];
    return imgs.length===2&&imgs[0].getAttribute('src')==='assets/orion/orion-nircam-long.webp'&&imgs[1].getAttribute('src')==='assets/orion/orion-nircam-short.webp'&&el.textContent.includes('no son dos épocas de SPHEREx')&&el.textContent.includes('M. McCaughrean')&&el.textContent.includes('CC BY-SA 3.0 IGO')&&!el.querySelector('form[action*="temporal"]');
  })()`);
  await check('dos archivos Webb optimizados abren sin depender de ESA',`(async()=>{
    const images=[...document.querySelectorAll('#calibracion-educativa .spectral-layer img')];
    await Promise.all(images.map(async img=>{img.loading='eager';try{await img.decode();}catch{}}));
    return images.every(img=>img.naturalWidth>=1200&&img.naturalHeight>=800)&&images[0].naturalWidth===images[1].naturalWidth&&images[0].naturalHeight===images[1].naturalHeight;
  })()`);
  await check('deslizador A/B y zoom sincronizado responden a controles',`(()=>{
    const root=document.querySelector('#calibracion-educativa'),range=root.querySelector('#spectral-reveal'),viewer=root.querySelector('.spectral-demo-viewer'),out=root.querySelector('#spectral-reveal-value');
    range.value='73';range.dispatchEvent(new Event('input',{bubbles:true}));
    const slider=viewer.style.getPropertyValue('--spectral-reveal')==='73%'&&out.textContent==='73%';
    root.querySelector('#spectral-only-short').click();
    const short=range.value==='100'&&root.querySelector('#spectral-only-short').getAttribute('aria-pressed')==='true';
    root.querySelector('#spectral-only-long').click();
    const long=range.value==='0'&&root.querySelector('#spectral-only-long').getAttribute('aria-pressed')==='true';
    root.querySelector('#spectral-zoom-in').click();
    const zoom=viewer.style.getPropertyValue('--spectral-zoom')==='1.2';
    root.querySelector('#spectral-reset').click();
    return slider&&short&&long&&zoom&&range.value==='50'&&viewer.style.getPropertyValue('--spectral-zoom')==='1'&&root.querySelector('#spectral-zoom-out').disabled;
  })()`);
  await check('control de calibración y procedencia reales visibles',"(()=>{const real=document.querySelector('#real-title').closest('.real-panel'),temporal=real.querySelector('.real-compare');return real.textContent.includes('OBSERVACIÓN REAL')&&temporal.querySelector('.calibration-notice').textContent.includes('calibración')&&temporal.textContent.includes('CWAVE / CBAND')&&temporal.textContent.includes('IRSA')&&!document.querySelector('#simulacion')&&!document.querySelector('#descubrimientos')})()");
  await check('imagen de marca o alternativa según dimensiones',"(()=>{const img=document.querySelector('.brand-logo'),fallback=document.querySelector('.brand-symbol'),usable=img.naturalWidth>1&&img.naturalHeight>1;return img.complete && img.hidden===!usable && fallback.hidden===usable})()");
  await check('logo utilizable y error conservan alternativa',"(()=>{const img=document.querySelector('.brand-logo'),fallback=document.querySelector('.brand-symbol');Object.defineProperties(img,{naturalWidth:{configurable:true,value:120},naturalHeight:{configurable:true,value:80}});img.dispatchEvent(new Event('load'));const shown=!img.hidden&&fallback.hidden;Object.defineProperties(img,{naturalWidth:{configurable:true,value:0},naturalHeight:{configurable:true,value:0}});img.dispatchEvent(new Event('error'));const failed=img.hidden&&!fallback.hidden;delete img.naturalWidth;delete img.naturalHeight;img.dispatchEvent(new Event('load'));return shown&&failed})()");
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await wait(120);
  await check('navegación única en escritorio: solo sidebar visible',`(()=>{
    const nav=document.querySelector('#navigation'),rail=document.querySelector('.mission-rail'),button=document.querySelector('.menu-toggle');
    return getComputedStyle(nav).display==='none'&&getComputedStyle(rail).display!=='none'&&getComputedStyle(button).display==='none'&&document.querySelectorAll('.mission-rail-nav a').length===6;
  })()`);
  await check('portada: CTA accesible y panel derecho sin superposición',`(()=>{
    const intro=document.querySelector('.portal-intro').getBoundingClientRect(),
      panel=document.querySelector('.portal-mission-panel').getBoundingClientRect(),
      button=document.querySelector('.portal-explore').getBoundingClientRect();
    const el=document.elementFromPoint(button.left+button.width/2,button.top+button.height/2);
    return intro.right<=panel.left+2&&!!el?.closest('.portal-explore');
  })()`);
  for(const width of [375,430,768,1024,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await wait(120);
    await check(`navegación exclusiva a ${width}px`,`(()=>{
      const desktop=${width}>1100;
      const rail=getComputedStyle(document.querySelector('.mission-rail')).display!=='none';
      const toggle=getComputedStyle(document.querySelector('.menu-toggle')).display!=='none';
      const nav=getComputedStyle(document.querySelector('#navigation')).display!=='none';
      return desktop?rail&&!toggle&&!nav:!rail&&toggle&&!nav;
    })()`);
    await check(`portada con fondo legible a ${width}px`,`(()=>{
      const intro=document.querySelector('.portal-intro').getBoundingClientRect(),
        panel=document.querySelector('.portal-mission-panel').getBoundingClientRect(),
        bg=document.querySelector('.portal-ambient').getBoundingClientRect();
      return intro.width>130&&panel.width>170&&bg.width>200&&
        (${width}<=690?panel.top>=intro.bottom-2:intro.right<=panel.left+2);
    })()`);
  }
  for(const width of [375,430,768,1024,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await wait(150);if(!await evaluate('document.documentElement.scrollWidth <= innerWidth'))console.error('Elementos fuera de pantalla:',await evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:Math.round(e.getBoundingClientRect().right)}))"));await check(`sin desbordamiento horizontal a ${width}px`,"document.documentElement.scrollWidth <= innerWidth");await check(`paneles REAL adaptados a ${width}px`,`(()=>{const a=document.querySelector('.real-workspace-controls').getBoundingClientRect(),b=document.querySelector('.real-workspace-image').getBoundingClientRect(),c=document.querySelector('.real-workspace-results').getBoundingClientRect();return ${width<=430?'b.top>a.top && c.top>b.top':width===1440?'b.left>a.left && c.left>b.left && Math.abs(a.top-c.top)<2':'b.left>a.left && c.top>a.top'}})()`);}
  await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:false});
  await wait(200);
  await check('menú móvil y navegación',"(async()=>{const b=document.querySelector('.menu-toggle');b.click();const open=b.getAttribute('aria-expanded')==='true';document.querySelector('#navigation a[href=\"#explorador\"]').click();await new Promise(r=>setTimeout(r,50));return open && b.getAttribute('aria-expanded')==='false' && location.hash==='#explorador'})()");
  await check('menú móvil cierra con Escape y devuelve foco',"(()=>{const b=document.querySelector('.menu-toggle');b.click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return b.getAttribute('aria-expanded')==='false'&&!document.querySelector('#navigation').classList.contains('open')&&document.activeElement===b})()");
  await evaluate("document.querySelector('.menu-toggle').click();document.querySelector('.menu-toggle').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await check('tabulador real accede al menú y muestra foco',"(()=>{const e=document.activeElement,s=getComputedStyle(e);return e===document.querySelector('#navigation a')&&s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>=2})()");
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await check('preferencia de movimiento reducido',"matchMedia('(prefers-reduced-motion: reduce)').matches && getComputedStyle(document.documentElement).scrollBehavior==='auto' && parseFloat(getComputedStyle(document.querySelector('.button')).transitionDuration)<0.01");
  await send('Emulation.setEmulatedMedia',{features:[]});
  for(const section of ['inicio','explorador','real-title','compare-real-title','calibracion-educativa','gaia-linked-views']) await check(`navegación ${section}`,`(async()=>{document.querySelector('#navigation a[href="#${section}"]').click();await new Promise(r=>setTimeout(r,50));return location.hash==='#${section}'})()`);
  await check('accesos del portal a módulos reales sin simulaciones',`(()=>{const guide=document.querySelector('.portal-guide'),links=[...guide.querySelectorAll('.portal-links a')];return links.map(a=>a.getAttribute('href')).join(',')==='#explorador,#compare-real-title,#calibracion-educativa'&&links.every(a=>document.querySelector(a.getAttribute('href'))&&a.tabIndex>=0)&&guide.querySelectorAll('.portal-steps li').length===3&&document.querySelector('.portal-independence').textContent.includes('no oficial')})()`);
  await check('límites RA/Dec y errores accesibles',`(()=>{let ra=document.querySelector('#ra'),dec=document.querySelector('#dec'),form=document.querySelector('#coordinates-form');const test=(a,d,valid)=>{ra.value=a;dec.value=d;form.requestSubmit();return (document.querySelector('#coordinates-error').textContent==='')===valid};return test('0','-90',true)&&test('359.9999999','90',true)&&test('360','0',false)&&ra.getAttribute('aria-invalid')==='true'&&test('-1','0',false)&&test('1','91',false)&&dec.getAttribute('aria-invalid')==='true'&&test('1','-91',false)&&test('','0',false)&&test('83.8221','-5.3911',true)})()`);
  await check('etiquetas de controles de las seis secciones',"(()=>{const controls=[...document.querySelectorAll('main input,main select')].filter(e=>e.getClientRects().length&&!e.disabled);return controls.every(e=>e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.labels?.length)})()");
  await check('botón de consulta temporal dirige a búsqueda real',`(()=>{const b=document.querySelector('#temporal-open-search'),form=document.querySelector('#real-search');b.click();return document.activeElement===form.querySelector('button[type=submit]')})()`);
  await check('controles visibles accesibles y vista previa vacía sin imágenes de relleno',`(()=>{const inputs=[...document.querySelectorAll('main input,main select')].filter(e=>e.getClientRects().length&&!e.disabled);return inputs.every(e=>e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.labels?.length)&&[...document.querySelectorAll('.temporal-preview-empty')].length===2&&[...document.querySelectorAll('.temporal-preview-empty')].every(e=>e.textContent.includes('IRSA'))})()`);
  await check('integración REAL con API de prueba sin inventar fuentes',`(async()=>{document.querySelector('#cosmic-search').click();for(let i=0;i<30&&!document.querySelector('#real-observations button[data-id]');i++)await new Promise(r=>setTimeout(r,50));const button=document.querySelector('#real-observations button[data-id]');if(!button)return false;button.click();for(let i=0;i<30&&document.querySelector('#real-preview').hidden;i++)await new Promise(r=>setTimeout(r,50));return !document.querySelector('#real-preview').hidden&&document.querySelector('#real-status').textContent.includes('REAL')&&document.querySelector('#real-metadata').textContent.includes('TEST-IRSA')&&!document.querySelector('#sky')&&!document.querySelector('#candidate-detail')})()`);
  await check('zoom y encuadre visual REAL por teclado',`(async()=>{await new Promise(r=>setTimeout(r,20));const plus=document.querySelector('[aria-label="Acercar vista real"]'),reset=document.querySelector('[aria-label="Restablecer encuadre de la vista real"]'),viewport=document.querySelector('.real-image-viewport'),image=document.querySelector('#real-preview'),out=document.querySelector('#real-viewer-zoom');if(plus.disabled)return false;plus.click();plus.click();viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));const moved=out.textContent==='150 %'&&image.style.transform.includes('translate(20px, 0px)');reset.click();return moved&&out.textContent==='100 %'&&image.style.transform.includes('translate(0px, 0px)')&&document.querySelector('.real-viewer-footer').textContent.includes('no WCS')})()`);
  await evaluate("document.querySelector('.real-image-viewport').scrollIntoView({block:'center',behavior:'instant'});document.querySelector('[aria-label=\"Acercar vista real\"]').click()");
  const viewportCenter=await evaluate("(()=>{const r=document.querySelector('.real-image-viewport').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:viewportCenter.x,y:viewportCenter.y});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:viewportCenter.x,y:viewportCenter.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:viewportCenter.x+20,y:viewportCenter.y+10,button:'left',buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:viewportCenter.x+20,y:viewportCenter.y+10,button:'left',clickCount:1});
  await check('encuadre visual REAL por puntero',"(()=>{const img=document.querySelector('#real-preview'),moved=img.style.transform.includes('translate(20px, 10px)');document.querySelector('[aria-label=\"Restablecer encuadre de la vista real\"]').click();return moved})()");
  await check('selección recuperada y sin descarga duplicada',`(()=>{const b=document.querySelector('#real-observations button[aria-pressed=true]');if(!b||b.dataset.state!=='recuperada')return false;b.click();return true})()`);
  if(metadataRequests!==0 || previewRequests!==1) throw Error(`Llamadas redundantes: metadatos=${metadataRequests}, vistas=${previewRequests}`);
  await check('cronología REAL asigna épocas existentes a A y B',`(async()=>{const range=document.querySelector('#temporal-range'),a=document.querySelector('#real-a'),b=document.querySelector('#real-b');if(range.disabled||range.max!=='1'||!document.querySelector('#temporal-current').textContent.includes('TEST-IRSA'))return false;document.querySelector('#temporal-use-a').click();document.querySelector('#temporal-next').click();const next=range.value==='1'&&document.querySelector('#temporal-current').textContent.includes('TEST-IRSA-2');document.querySelector('#temporal-use-b').click();await new Promise(r=>setTimeout(r,500));return next&&a.value==='a'.repeat(64)&&b.value==='b'.repeat(64)&&document.querySelector('#compare-real-views').hidden&&document.querySelector('#compare-play').disabled})()`);
  await check('ficha temporal contiene solo metadatos del producto real recibido',`(()=>{const card=document.querySelector('#temporal-real-record'),empty=document.querySelector('#temporal-empty'),title=document.querySelector('#temporal-real-id').textContent,button=document.querySelector('#temporal-inspect-real');return !card.hidden&&empty.hidden&&title.includes('TEST-IRSA-2')&&document.querySelector('#temporal-real-band').textContent.includes('D2')&&document.querySelector('#temporal-real-date').textContent.includes('MJD')&&!button.disabled})()`);
  await check('comparación REAL con API simulada y animación separada',`(async()=>{const a=document.querySelector('#real-a'),b=document.querySelector('#real-b');a.value='a'.repeat(64);b.value='b'.repeat(64);document.querySelector('#compare-real-form').requestSubmit();for(let i=0;i<40&&document.querySelector('#compare-real-views').hidden;i++)await new Promise(r=>setTimeout(r,50));const select=document.querySelector('#compare-view'),play=document.querySelector('#compare-play');if(document.querySelector('#compare-real-views').hidden||!Array.from(select.options).some(o=>o.value==='difference'))return false;select.value='overlay';select.dispatchEvent(new Event('change'));const overlay=!document.querySelector('#compare-real-overlay').hidden;play.click();const playing=play.getAttribute('aria-pressed')==='true';play.click();return overlay&&playing&&play.getAttribute('aria-pressed')==='false'&&document.querySelector('#compare-real-status').textContent.includes('APROXIMADA')})()`);
  await check('selección A/B independiente y cancelación temporal',`(async()=>{const a=document.querySelector('#real-a'),b=document.querySelector('#real-b'),slots=document.querySelectorAll('.temporal-individual');b.add(new Option('SIN-FECHA','c'.repeat(64)));a.value='b'.repeat(64);a.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,30));a.value='a'.repeat(64);a.dispatchEvent(new Event('change'));b.value='c'.repeat(64);b.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,650));return !slots[0].querySelector('img').hidden&&slots[0].querySelector('p').textContent.includes('TEST-IRSA')&&slots[1].querySelector('img').hidden&&slots[1].querySelector('p').textContent.includes('Error')})()`);
  await check('bloqueo científico ante diferencia incompatible inesperada',`(async()=>{document.querySelector('#compare-real-form').requestSubmit();for(let i=0;i<40&&!document.querySelector('#compare-real-status').textContent.includes('INCOMPATIBLE');i++)await new Promise(r=>setTimeout(r,50));const select=document.querySelector('#compare-view');return ![...select.options].some(o=>['difference','overlay'].includes(o.value))&&document.querySelector('#compare-play').disabled&&document.querySelector('#compare-real-status').textContent.includes('CWAVE/CBAND')})()`);
  await check('timeout temporal libera estado y permite nueva selección',`(async()=>{const a=document.querySelector('#real-a'),b=document.querySelector('#real-b'),form=document.querySelector('#compare-real-form'),status=document.querySelector('#compare-real-status');a.add(new Option('SIN-FECHA','c'.repeat(64)));a.value='c'.repeat(64);b.value='a'.repeat(64);form.requestSubmit();const busy=form.querySelector('button[type=submit]').disabled;for(let i=0;i<40&&!status.textContent.includes('Tiempo de comparación agotado');i++)await new Promise(r=>setTimeout(r,25));const failed=busy&&status.textContent.includes('Tiempo de comparación agotado')&&!form.hasAttribute('aria-busy')&&!form.querySelector('button[type=submit]').disabled&&document.querySelector('#compare-real-views').hidden&&document.querySelector('#compare-play').disabled;a.value='a'.repeat(64);a.dispatchEvent(new Event('change'));return failed&&status.textContent.includes('Selección modificada')})()`);
  await check('cancelación de comparación ignora respuesta tardía',`(async()=>{const a=document.querySelector('#real-a'),b=document.querySelector('#real-b'),f=document.querySelector('#compare-real-form'),status=document.querySelector('#compare-real-status');a.value='b'.repeat(64);b.value='a'.repeat(64);f.requestSubmit();await new Promise(r=>setTimeout(r,30));a.value='a'.repeat(64);a.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,500));return status.textContent.includes('Selección modificada')&&!f.hasAttribute('aria-busy')&&!f.querySelector('button[type=submit]').disabled&&document.querySelector('#compare-real-views').hidden&&document.querySelector('#compare-play').disabled})()`);
  await check('cronología, filtros y truncamiento REAL',`(async()=>{const ra=document.querySelector('#ra');ra.value='33.33';document.querySelector('#real-search').requestSubmit();for(let i=0;i<60&&!document.querySelector('#real-status').textContent.includes('posible truncamiento');i++)await new Promise(r=>setTimeout(r,50));const list=document.querySelector('#real-observations'),buttons=[...list.querySelectorAll('button[data-id]')],filter=list.querySelector('[data-filter=band]'),options=[...filter.options].map(o=>o.value);if(buttons.map(b=>b.dataset.id[0]).join('')!=='bac'||!list.textContent.includes('Fecha no disponible')||!document.querySelector('#real-status').textContent.includes('1 filas duplicadas')||options.join(',')!==',D2,D3')return false;const day=list.querySelector('[data-filter=day]'),detector=list.querySelector('[data-filter=detector]'),collection=list.querySelector('[data-filter=collection]');day.value='2023-02-25';day.dispatchEvent(new Event('change'));if(list.querySelectorAll('button[data-id]').length!==1||list.querySelector('button[data-id]').dataset.id[0]!=='a')return false;day.value='';day.dispatchEvent(new Event('change'));detector.value='D2';detector.dispatchEvent(new Event('change'));if(list.querySelectorAll('button[data-id]').length!==1)return false;detector.value='';detector.dispatchEvent(new Event('change'));if([...collection.options].map(o=>o.value).join(',')!==',spherex_qr2')return false;filter.value='D3';filter.dispatchEvent(new Event('change'));const visible=list.querySelectorAll('button[data-id]');const ok=visible.length===1&&visible[0].dataset.id[0]==='b'&&document.querySelector('#real-a').options.length===4;ra.value='83.8221';return ok})()`);
  await check('vista antigua cancelada no sustituye la selección nueva',`(async()=>{const list=document.querySelector('#real-observations'),filter=list.querySelector('[data-filter=band]');list.querySelector('button[data-id]').click();await new Promise(r=>setTimeout(r,0));const loading=list.querySelector('button[data-id]').dataset.state==='cargando'&&document.querySelector('.real-image-viewport').getAttribute('aria-busy')==='true'&&document.querySelector('.real-image-empty strong').textContent==='Cargando observación real';filter.value='';filter.dispatchEvent(new Event('change'));list.querySelector('button[data-id="'+ 'a'.repeat(64) +'"]').click();await new Promise(r=>setTimeout(r,600));const chosen=list.querySelector('button[aria-pressed=true]'),old=list.querySelector('button[data-id="'+ 'b'.repeat(64) +'"]');return loading&&chosen?.dataset.id[0]==='a'&&chosen.dataset.state==='recuperada'&&old.dataset.state==='disponible'&&document.querySelector('#real-metadata').textContent.includes('TEST-IRSA')})()`);
  await check('error de vista real identificado en la lista',`(async()=>{const list=document.querySelector('#real-observations');document.querySelector('[aria-label="Acercar vista real"]').click();list.querySelector('button[data-id="'+ 'c'.repeat(64) +'"]').click();for(let i=0;i<40&&!document.querySelector('#real-status').textContent.includes('Recorte no disponible');i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,0));return list.querySelector('button[aria-pressed=true]')?.dataset.state==='error'&&document.querySelector('#real-preview').hidden&&document.querySelector('#real-status').textContent.includes('Recorte no disponible')&&document.querySelector('.real-image-empty strong').textContent==='Vista previa no disponible'&&document.querySelector('[aria-label="Acercar vista real"]').disabled&&document.querySelector('#real-viewer-zoom').textContent==='100 %'})()`);
  await check('búsqueda vacía limpia lista y comparador',`(async()=>{const ra=document.querySelector('#ra');ra.value='44.44';document.querySelector('#real-search').requestSubmit();for(let i=0;i<40&&!document.querySelector('#real-status').textContent.includes('no devolvió');i++)await new Promise(r=>setTimeout(r,50));const ok=!document.querySelector('#real-observations button[data-id]')&&document.querySelector('#real-a').options.length===1&&document.querySelector('#real-preview').hidden;ra.value='83.8221';return ok})()`);
  await check('búsqueda de pares y explicación de rechazo',`(async()=>{document.querySelector('#find-pairs').click();for(let i=0;i<40&&!document.querySelector('#pair-results button');i++)await new Promise(r=>setTimeout(r,50));const area=document.querySelector('#pair-results'),button=area.querySelector('button');if(!button)return false;button.click();return area.textContent.includes('Calibración no verificada')&&area.textContent.includes('70.0%')&&document.querySelector('#real-a').value==='a'.repeat(64)&&document.querySelector('#real-b').value==='b'.repeat(64)})()`);
  await check('respuestas tardías y errores de red',`(async()=>{const ra=document.querySelector('#ra'), form=document.querySelector('#real-search'), area=document.querySelector('#pair-results');ra.value='12.34';document.querySelector('#find-pairs').click();ra.value='22.34';ra.dispatchEvent(new Event('input',{bubbles:true}));form.requestSubmit();await new Promise(r=>setTimeout(r,650));const error=document.querySelector('#real-status').textContent.includes('IRSA no disponible');return error&&!area.textContent.includes('Calibración no verificada')&&!document.querySelector('#find-pairs').disabled})()`);
  await check('búsqueda real antigua no sustituye error reciente',`(async()=>{const ra=document.querySelector('#ra'),form=document.querySelector('#real-search');ra.value='12.34';form.requestSubmit();await new Promise(r=>setTimeout(r,30));ra.value='22.34';form.requestSubmit();await new Promise(r=>setTimeout(r,650));return document.querySelector('#real-status').textContent.includes('IRSA no disponible')&&document.querySelector('.real-image-empty strong').textContent==='Consulta IRSA no disponible'&&!document.querySelector('#real-observations button')&&!form.hasAttribute('aria-busy')})()`);
  await check('esfera direccional sin estrellas decorativas iniciales',`(()=>{const s=document.querySelector('#cosmic-sphere');return s.dataset.gaiaCount==='0'&&s.dataset.wiseCount==='0'&&s.dataset.renderedSources==='0'})()`);
  await check('consulta Gaia DR3, selección real y copia de RA/Dec sin buscar en IRSA',`(async()=>{const ra=document.querySelector('#ra'),dec=document.querySelector('#dec');ra.value='83.8221';dec.value='-5.3911';document.querySelector('#cosmic-gaia-load').click();for(let i=0;i<40&&document.querySelector('#cosmic-sphere').dataset.gaiaCount!=='2';i++)await new Promise(r=>setTimeout(r,25));const s=document.querySelector('#cosmic-sphere'),sel=document.querySelector('#cosmic-source-select'),detail=document.querySelector('#cosmic-source-detail');if(s.dataset.renderedSources!=='2'||sel.options.length!==3)return false;let irsaCalls=0;const orig=window.fetch;window.fetch=(...args)=>{if(String(args[0]).startsWith('/api/observations'))irsaCalls++;return orig(...args)};sel.value='gaia:3017364063331140097';sel.dispatchEvent(new Event('change'));const nullShown=detail.textContent.includes('3017364063331140097')&&detail.textContent.includes('No disponible (null)')&&detail.textContent.includes('no se convierte en distancia');document.querySelector('#cosmic-use-source').click();window.fetch=orig;const copied=Number(ra.value)===83.8255&&Number(dec.value)===-5.3885&&irsaCalls===0&&document.querySelector('#cosmic-selection-status').textContent.includes('Gaia DR3 3017364063331140097');ra.value='83.8221';dec.value='-5.3911';ra.dispatchEvent(new Event('input',{bubbles:true}));dec.dispatchEvent(new Event('input',{bubbles:true}));return nullShown&&copied})()`);
  await check('mapa galáctico y color magnitud reciben Gaia real y conservan selección',`(()=>{const panel=document.querySelector('#gaia-linked-views'),gal=document.querySelector('#gaia-galactic-canvas'),cmd=document.querySelector('#gaia-cmd-canvas'),status=document.querySelector('#gaia-linked-status'),sky=document.querySelector('#gaia-aladin'),sel=document.querySelector('#cosmic-source-select');return !!panel&&!!gal&&!!cmd&&gal.width>0&&cmd.width>0&&status.textContent.includes('2 fuentes')&&!!sky&&sky.hidden===true&&sel.options.length===3&&sel.value==='gaia:3017364063331140097'})()`);
  await check('Gaia Sky web 3D usa solo paralajes fiables y conserva la selección con alternativa 2D',`(async()=>{const host=document.querySelector('#gaia-volume'),select=document.querySelector('#gaia-volume-select'),mode=document.querySelector('#gaia-volume-mode'),gpu=document.querySelector('#gaia-volume-gpu'),cosmic=document.querySelector('#cosmic-source-select');await new Promise(r=>setTimeout(r,100));if(!host||!gpu||!mode||host.dataset.count!=='1'||select.options.length!==2||!document.querySelector('#gaia-volume-status').textContent.includes('1 / 1')||!['2d','webgl'].includes(host.dataset.renderMode))return false;const original=cosmic.value;select.value='3017364063331140096';select.dispatchEvent(new Event('change'));const linked=cosmic.value==='gaia:3017364063331140096'&&document.querySelector('#gaia-volume-detail').textContent.includes('414.94 pc');if(!linked)return false;const was=host.dataset.renderMode;if(!mode.disabled){mode.click();if(host.dataset.renderMode===was)return false;mode.click();if(host.dataset.renderMode!==was)return false;}else if(was!=='2d')return false;cosmic.value=original;cosmic.dispatchEvent(new Event('change'));return host.dataset.count==='1'&&document.querySelector('#gaia-volume-status').textContent.includes('Gaia DR3')})()`);
  await check('visor óptico CDS es opcional y no se presenta como FITS SPHEREx',`(()=>{const card=document.querySelector('.gaia-sky-card'),b=document.querySelector('#gaia-sky-open');return !!card&&!!b&&card.textContent.includes('DSS2')&&card.textContent.toLowerCase().includes('no es spherex')&&document.querySelector('#gaia-aladin').hidden})()`);
  await check('consulta AllWISE y asociación candidata no confirmada con Gaia DR3',`(async()=>{document.querySelector('#cosmic-wise-load').click();for(let i=0;i<40&&document.querySelector('#cosmic-sphere').dataset.wiseCount!=='1';i++)await new Promise(r=>setTimeout(r,25));const sel=document.querySelector('#cosmic-source-select'),detail=document.querySelector('#cosmic-source-detail');sel.value='wise:J053517.30-052327.9';sel.dispatchEvent(new Event('change'));return document.querySelector('#cosmic-sphere').dataset.renderedSources==='3'&&detail.textContent.includes('J053517.30-052327.9')&&detail.textContent.includes('8.912')&&detail.textContent.includes('Candidata no confirmada con Gaia DR3 3017364063331140096')})()`);
  await check('Aladin Lite opt-in inicializa carta de archivo y enlaza selección Gaia',`(async()=>{
    const host=document.querySelector('#gaia-aladin'),button=document.querySelector('#gaia-sky-open');
    if(!host.hidden)return false;
    const calls={goto:0,zoom:0,add:0,sources:0,clear:0,selected:null};
    const layer={addSources(items){calls.sources=items.length},removeAll(){calls.clear++}};
    window.A={init:Promise.resolve(),aladin(selector,opts){
      if(selector!=='#gaia-aladin'||opts.survey!=='P/DSS2/color')throw Error('Aladin options');
      return {on(name,cb){if(name==='objectClicked')calls.clicked=cb},gotoRaDec(){calls.goto++},setFoV(){calls.zoom++},addCatalog(){calls.add++}};
    },catalog(){return layer},source(ra,dec,data){return {ra,dec,data}}};
    button.click();
    for(let i=0;i<35&&host.hidden;i++)await new Promise(r=>setTimeout(r,20));
    if(host.hidden||calls.sources!==2||calls.goto<1||calls.zoom<1||calls.add!==1||!calls.clicked)return false;
    calls.clicked({data:{source_id:'3017364063331140096'}});
    const selected=document.querySelector('#cosmic-source-select').value==='gaia:3017364063331140096';
    button.click();
    return selected&&calls.clear>=1&&calls.add===1;
  })()`);
  await check('catálogos reales no se dibujan sobre un cono diferente al consultado',`(()=>{const ra=document.querySelector('#ra'),dec=document.querySelector('#dec'),radius=document.querySelector('#real-radius'),sphere=document.querySelector('#cosmic-sphere'),status=document.querySelector('#cosmic-catalog-status');const before={ra:ra.value,dec:dec.value,radius:radius.value};const visible=Number(sphere.dataset.renderedSources)>0;ra.value='90.0000';ra.dispatchEvent(new Event('input',{bubbles:true}));const invalidated=sphere.dataset.catalogStale==='true'&&sphere.dataset.renderedSources==='0'&&status.textContent.includes('CONSULTA ANTERIOR')&&document.querySelector('#cosmic-source-select').options.length===1;ra.value=before.ra;dec.value=before.dec;radius.value=before.radius;ra.dispatchEvent(new Event('input',{bubbles:true}));const restored=sphere.dataset.catalogStale==='false'&&Number(sphere.dataset.renderedSources)>0;return visible&&invalidated&&restored})()`);
  await check('truncamiento, cero fuentes, error y cancelación en catálogos sin inventar estrellas',`(async()=>{const ra=document.querySelector('#ra'),status=document.querySelector('#cosmic-catalog-status'),sphere=document.querySelector('#cosmic-sphere');ra.value='33.33';document.querySelector('#cosmic-gaia-load').click();for(let i=0;i<40&&!status.textContent.includes('posible truncamiento');i++)await new Promise(r=>setTimeout(r,25));const truncOk=status.textContent.includes('posible truncamiento');ra.value='44.44';document.querySelector('#cosmic-catalog-clear').click();document.querySelector('#cosmic-gaia-load').click();for(let i=0;i<40&&!status.textContent.includes('0 fuentes reales');i++)await new Promise(r=>setTimeout(r,25));const emptyOk=sphere.dataset.gaiaCount==='0'&&sphere.dataset.renderedSources==='0';ra.value='12.34';document.querySelector('#cosmic-gaia-load').click();await new Promise(r=>setTimeout(r,30));ra.value='22.34';ra.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#cosmic-gaia-load').click();await new Promise(r=>setTimeout(r,600));const errOk=status.textContent.includes('ESA Gaia TAP no disponible')&&sphere.dataset.gaiaCount==='0'&&sphere.dataset.renderedSources==='0';ra.value='83.8221';document.querySelector('#cosmic-catalog-clear').click();return truncOk&&emptyOk&&errOk})()`);
  await check('modelo 3D incorporado como fondo general del portal sin ventana emergente',`(()=>{const stage=document.querySelector('.portal-stage'),bg=stage.querySelector('.portal-ambient'),intro=stage.querySelector('.portal-intro'),panel=stage.querySelector('.portal-mission-panel');return !!bg&&getComputedStyle(bg).position==='absolute'&&intro&&panel&&!document.querySelector('#portal-model-dialog')&&!document.querySelector('.portal-orb')})()`);
  await evaluate("fetch('/__test/server-restrict').then(()=>location.reload())");
  let offlineReady=false;
  for(let i=0;i<100&&!offlineReady;i++){
    await wait(100);
    offlineReady=await evaluate("document.body.dataset.irsaMode==='offline' && document.body.dataset.catalogMode==='real' && !!document.querySelector('#cosmic-gaia-load')");
  }
  await check('Render restringido desactiva IRSA pero mantiene Gaia/WISE sin modo demo',`(()=>{return document.body.dataset.irsaMode==='offline'&&!document.querySelector('#offline-mode')&&document.querySelector('#real-search button[type="submit"]').disabled&&document.querySelector('#cosmic-search').disabled&&document.querySelector('#find-pairs').disabled&&document.querySelector('#compare-real-form button[type="submit"]').disabled&&!document.querySelector('#cosmic-gaia-load').disabled&&!document.querySelector('#cosmic-wise-load').disabled&&document.querySelector('#real-status').textContent.includes('SPHEREx no disponible')})()`);
  await check('Gaia sigue consultable con SPHEREx restringido en servidor',`(async()=>{document.querySelector('#cosmic-gaia-load').click();for(let i=0;i<40&&document.querySelector('#cosmic-sphere').dataset.gaiaCount!=='2';i++)await new Promise(r=>setTimeout(r,25));return document.querySelector('#cosmic-sphere').dataset.gaiaCount==='2'&&document.querySelector('#gaia-linked-status').textContent.includes('2 fuentes')})()`);
  if(errors.length)throw Error('Errores de consola o JavaScript: '+errors.join('; '));
  console.log('OK: sin excepciones JavaScript ni console.error durante la prueba');
  if(process.env.SPHERALYX_AUDIT_SCREENSHOTS){
    const directory=await mkdtemp(resolve(process.env.SPHERALYX_AUDIT_SCREENSHOTS,'spheralyx-capturas-'));
    for(const width of [375,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});for(const section of ['inicio','explorador','compare-real-title','calibracion-educativa']){await evaluate(`document.getElementById('${section}').scrollIntoView({block:'start',behavior:'instant'})`);await wait(100);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(directory,`${section}-${width}.png`),Buffer.from(shot.data,'base64'));}}
    console.log(`Capturas de módulos reales: ${directory}`);
  }
} finally { if(socket)socket.close();child.kill();server.close();await wait(300);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{}); }
