/* SPHERALYX AI · visor celeste WebGL inmersivo inspirado en Gaia Sky.
 * No incrusta la aplicación Gaia Sky. Solo dibuja puntos Gaia DR3/AllWISE
 * suministrados por el backend, sin estrellas sintéticas ni distancias ficticias.
 */
export function createNativeCelestialWebGL(stage) {
  const canvas = document.createElement('canvas');
  canvas.className = 'cosmic-webgl-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.pointerEvents = 'none';
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL no disponible');
  stage.append(canvas);
  const shaders = [], programs = [], buffers = [];
  let destroyed = false;
  function program(vertexSource, fragmentSource) {
    function compile(kind, source) {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error('No se pudo crear shader');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Error shader');
      return shader;
    }
    const p = gl.createProgram();
    if (!p) throw new Error('No se pudo crear programa WebGL');
    programs.push(p);
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'Error de enlace WebGL');
    return p;
  }
  const background = program(
    'attribute vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.,1.);}',
    `precision mediump float;
    uniform vec2 uResolution;
    void main(){
      vec2 uv=gl_FragCoord.xy/uResolution;
      vec2 p=(gl_FragCoord.xy-uResolution*.5)/min(uResolution.x,uResolution.y);
      float glow=exp(-length((p-vec2(-.15,.07))*vec2(1.2,2.1))*2.4);
      float dust=exp(-pow((p.y+.18*p.x+.13)*2.9,2.))*exp(-pow(p.x*.85,2.));
      float vignette=1.-.42*smoothstep(.15,.95,length(p));
      vec3 color=vec3(.007,.016,.043)+vec3(.022,.036,.105)*glow+vec3(.043,.020,.084)*dust*.54;
      color*=vignette;
      gl_FragColor=vec4(color,1.);
    }`
  );
  const lines = program(
    'attribute vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.,1.);}',
    'precision mediump float;uniform vec4 uColor;void main(){gl_FragColor=uColor;}'
  );
  const stars = program(
    `attribute vec2 aPosition;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aSelected;
    uniform float uDpr;
    varying vec3 vColor;
    varying float vSelected;
    void main(){
      gl_Position=vec4(aPosition,0.,1.);
      gl_PointSize=min(32.,aSize*uDpr);
      vColor=aColor;
      vSelected=aSelected;
    }`,
    `precision mediump float;
    varying vec3 vColor;
    varying float vSelected;
    void main(){
      float r=length(gl_PointCoord-vec2(.5))*2.;
      if(r>1.)discard;
      float core=exp(-13.*r*r);
      float halo=exp(-3.*r*r);
      float ring=vSelected>.5 ? exp(-pow((r-.66)*18.,2.))*.82 : 0.;
      float alpha=min(1.,core*.94+halo*.32+ring);
      vec3 color=mix(vColor,vec3(1.,.89,.64),step(.5,vSelected)*.42);
      gl_FragColor=vec4(color,alpha);
    }`
  );
  function makeBuffer() {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('No se pudo crear búfer WebGL');
    buffers.push(buffer);
    return buffer;
  }
  const quad = makeBuffer(), lineBuffer = makeBuffer(), starBuffer = makeBuffer();
  const quadData = new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
  const rad = Math.PI / 180;
  const clamp = x => Math.max(-1, Math.min(1, x));
  function project(ra, dec, viewRa, viewDec) {
    const a=ra*rad,d=dec*rad,ca=viewRa*rad,cd=viewDec*rad;
    const x=Math.cos(d)*Math.cos(a),y=Math.cos(d)*Math.sin(a),z=Math.sin(d);
    return [-Math.sin(ca)*x+Math.cos(ca)*y,
      -Math.sin(cd)*Math.cos(ca)*x-Math.sin(cd)*Math.sin(ca)*y+Math.cos(cd)*z,
      Math.cos(cd)*Math.cos(ca)*x+Math.cos(cd)*Math.sin(ca)*y+Math.sin(cd)*z];
  }
  function colorFor(source) {
    if (source.kind === 'wise') return [1, .72, .43];
    if (!Number.isFinite(source.bp_rp)) return [.72, .87, 1];
    if (source.bp_rp > 1.5) return [1, .74, .56];
    if (source.bp_rp < .5) return [.60, .80, 1];
    return [.95, .94, .88];
  }
  function render(state) {
    if (destroyed) return;
    const rect=stage.getBoundingClientRect();
    if (rect.width<2 || rect.height<2) return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const width=Math.round(rect.width*dpr),height=Math.round(rect.height*dpr);
    if (canvas.width!==width) canvas.width=width;
    if (canvas.height!==height) canvas.height=height;
    gl.viewport(0,0,width,height);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(background);
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    const bgPos=gl.getAttribLocation(background,'aPosition');
    gl.enableVertexAttribArray(bgPos);
    gl.vertexAttribPointer(bgPos,2,gl.FLOAT,false,0,0);
    gl.uniform2f(gl.getUniformLocation(background,'uResolution'),width,height);
    gl.drawArrays(gl.TRIANGLES,0,6);
    gl.disableVertexAttribArray(bgPos);

    const radius=Math.min(width,height)*.43;
    const sx=radius*2/width*state.zoom,sy=radius*2/height*state.zoom;
    const convert=p=>[p[0]*sx,p[1]*sy];
    function drawLines(vertices,color) {
      if (!vertices.length) return;
      gl.useProgram(lines);
      gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices.flat()),gl.DYNAMIC_DRAW);
      const loc=gl.getAttribLocation(lines,'aPosition');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
      gl.uniform4f(gl.getUniformLocation(lines,'uColor'),...color);
      gl.drawArrays(gl.LINES,0,vertices.length);
      gl.disableVertexAttribArray(loc);
    }
    if (state.showGrid) {
      const segments=[];
      function curve(samples) {
        let previous=null;
        for (const sample of samples) {
          const p=project(sample[0],sample[1],state.viewRa,state.viewDec);
          if(p[2]<=0){previous=null;continue;}
          const v=convert(p);
          if(previous)segments.push(previous,v);
          previous=v;
        }
      }
      for(let d=-60;d<=60;d+=30)curve(Array.from({length:181},(_,i)=>[i*2,d]));
      for(let a=0;a<360;a+=30)curve(Array.from({length:91},(_,i)=>[a,-90+i*2]));
      drawLines(segments,[.24,.46,.69,.22]);
    }
    const records=[];
    for(const source of (state.sources||[]).slice(0,500)){
      if(!Number.isFinite(source.ra)||!Number.isFinite(source.dec))continue;
      const p=project(source.ra,source.dec,state.viewRa,state.viewDec);
      if(p[2]<=0)continue;
      const v=convert(p);
      if(Math.abs(v[0])>1.04||Math.abs(v[1])>1.04)continue;
      const selected=source.key===state.selectedKey;
      const magnitude=source.kind==='gaia'?source.mag:source.w1mpro;
      const size=selected?19:Number.isFinite(magnitude)?Math.max(5,Math.min(13,12.5-(magnitude-8)*.55)):7;
      records.push(...v,...colorFor(source),size,selected?1:0);
    }
    if(records.length){
      gl.useProgram(stars);
      gl.bindBuffer(gl.ARRAY_BUFFER,starBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(records),gl.DYNAMIC_DRAW);
      for(const [name,count,offset] of [['aPosition',2,0],['aColor',3,8],['aSize',1,20],['aSelected',1,24]]){
        const loc=gl.getAttribLocation(stars,name);
        if(loc<0)continue;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc,count,gl.FLOAT,false,28,offset);
      }
      gl.uniform1f(gl.getUniformLocation(stars,'uDpr'),dpr);
      gl.drawArrays(gl.POINTS,0,records.length/7);
      for(const name of ['aPosition','aColor','aSize','aSelected']){
        const loc=gl.getAttribLocation(stars,name);
        if(loc>=0)gl.disableVertexAttribArray(loc);
      }
    }
    if(state.target){
      const p=project(state.target.ra,state.target.dec,state.viewRa,state.viewDec);
      if(p[2]>0){
        const v=convert(p),r=.022;
        drawLines([[v[0]-r,v[1]],[v[0]+r,v[1]],[v[0],v[1]-r],[v[0],v[1]+r]],[.57,.91,1,.90]);
      }
      if(state.radiusDeg>0){
        const a=state.target.ra*rad,d=state.target.dec*rad,t=state.radiusDeg*rad;
        const c=[Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)];
        const east=[-Math.sin(a),Math.cos(a),0],north=[-Math.sin(d)*Math.cos(a),-Math.sin(d)*Math.sin(a),Math.cos(d)];
        const seg=[];let previous=null;
        for(let i=0;i<=96;i++){
          const angle=i*2*Math.PI/96;
          const v=c.map((x,j)=>x*Math.cos(t)+Math.sin(t)*(east[j]*Math.cos(angle)+north[j]*Math.sin(angle)));
          const p=project((Math.atan2(v[1],v[0])/rad+360)%360,Math.asin(clamp(v[2]))/rad,state.viewRa,state.viewDec);
          if(p[2]<=0){previous=null;continue;}
          const q=convert(p);
          if(previous)seg.push(previous,q);
          previous=q;
        }
        drawLines(seg,[.48,.84,1,.50]);
      }
    }
  }
  function dispose(){
    if(destroyed)return;
    destroyed=true;
    for(const buffer of buffers)gl.deleteBuffer(buffer);
    for(const p of programs)gl.deleteProgram(p);
    for(const shader of shaders)gl.deleteShader(shader);
    canvas.remove();
  }
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    dispose();
    stage.dispatchEvent(new CustomEvent('cosmic-webgl-lost'));
  },{once:true});
  return {render,dispose};
}
