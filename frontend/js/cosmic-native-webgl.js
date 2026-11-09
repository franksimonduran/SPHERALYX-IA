/* Renderer direccional WebGL sin CDN, alternativa a Three.js.
   Solo transforma direcciones RA/Dec; no inventa estrellas ni distancias. */
export function createNativeCelestialWebGL(stage) {
  const canvas = document.createElement('canvas');
  canvas.className = 'cosmic-webgl-canvas';
  canvas.setAttribute('aria-hidden','true');
  canvas.style.pointerEvents = 'none';
  const gl = canvas.getContext('webgl', { alpha:true, antialias:true, premultipliedAlpha:false });
  if (!gl) throw new Error('WebGL no disponible');
  stage.append(canvas);
  const shaders = [];
  const program = (vs,fs) => {
    function shader(kind,source) {
      const s=gl.createShader(kind);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)||'Error shader');
      return s;
    }
    const p=gl.createProgram();
    gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'Error WebGL');
    return p;
  };
  const orb=program(
    'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}',
    `precision mediump float;
    uniform vec2 resolution;
    void main(){
      vec2 p=(gl_FragCoord.xy-resolution*.5)/(min(resolution.x,resolution.y)*.43);
      float d=length(p);
      float disk=1.-smoothstep(.986,1.008,d);
      float rim=exp(-pow((d-1.)*115.,2.));
      float halo=exp(-pow((d-1.04)*10.,2.));
      vec3 dark=vec3(.025,.045,.12);
      vec3 blue=vec3(.11,.19,.41);
      vec3 violet=vec3(.22,.12,.42);
      vec3 shade=mix(dark,blue*(.75+.30*(-p.x+p.y)),smoothstep(1.,0.,d));
      shade+=violet*exp(-length((p-vec2(-.3,.2))*2.4))*0.50;
      vec3 rgb=shade*disk+vec3(.28,.56,.95)*rim*.46+vec3(.13,.15,.36)*halo*.22;
      float alpha=clamp(disk*.96+rim*.4+halo*.13,0.,1.);
      gl_FragColor=vec4(rgb,alpha);
    }`
  );
  const marker=program(
    'attribute vec3 position;uniform float size;void main(){gl_Position=vec4(position.xy,0.,1.);gl_PointSize=size;}',
    `precision mediump float; uniform vec4 color; uniform float roundPoint;
    void main(){if(roundPoint>.5 && length(gl_PointCoord-vec2(.5))>.48)discard;gl_FragColor=color;}`
  );
  const rect=gl.createBuffer(),buf=gl.createBuffer();
  let destroyed=false;
  const sphereVerts=new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]);
  const degrees=Math.PI/180;
  function project(ra,dec,vra,vdec) {
    const a=ra*degrees,d=dec*degrees,ca=vra*degrees,cd=vdec*degrees;
    const vx=Math.cos(d)*Math.cos(a),vy=Math.cos(d)*Math.sin(a),vz=Math.sin(d);
    return [-Math.sin(ca)*vx+Math.cos(ca)*vy,-Math.sin(cd)*Math.cos(ca)*vx-Math.sin(cd)*Math.sin(ca)*vy+Math.cos(cd)*vz,Math.cos(cd)*Math.cos(ca)*vx+Math.cos(cd)*Math.sin(ca)*vy+Math.sin(cd)*vz];
  }
  const cap=x=>Math.max(-1,Math.min(1,x));
  function render(state) {
    if(destroyed)return;
    const b=stage.getBoundingClientRect();
    if(!b.width||!b.height)return;
    const dpr=Math.min(devicePixelRatio||1,1.5);
    const width=Math.max(1,Math.round(b.width*dpr)),height=Math.max(1,Math.round(b.height*dpr));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    gl.viewport(0,0,width,height);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(orb);
    gl.bindBuffer(gl.ARRAY_BUFFER,rect);
    gl.bufferData(gl.ARRAY_BUFFER,sphereVerts,gl.STATIC_DRAW);
    const orbPos=gl.getAttribLocation(orb,'position');
    gl.enableVertexAttribArray(orbPos);gl.vertexAttribPointer(orbPos,2,gl.FLOAT,false,0,0);
    gl.uniform2f(gl.getUniformLocation(orb,'resolution'),width,height);
    gl.drawArrays(gl.TRIANGLES,0,6);
    gl.disableVertexAttribArray(orbPos);
    gl.useProgram(marker);
    const posLoc=gl.getAttribLocation(marker,'position');
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,0,0);
    const radius=Math.min(width,height)*.43;
    const sx=radius*2/width*state.zoom,sy=radius*2/height*state.zoom;
    const convert=p=>[p[0]*sx,p[1]*sy,p[2]];
    const draw=(points,primitive,color,size=2,circular=false)=>{
      if(points.length===0)return;
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.DYNAMIC_DRAW);
      gl.uniform1f(gl.getUniformLocation(marker,'size'),size*dpr);
      gl.uniform1f(gl.getUniformLocation(marker,'roundPoint'),circular?1:0);
      gl.uniform4f(gl.getUniformLocation(marker,'color'),...color);
      gl.drawArrays(primitive,0,points.length);
    };
    if(state.showGrid){
      const seg=[];
      const line=arr=>{
        let prev=null;
        for(const p of arr){
          if(p[2]<0){prev=null;continue;}
          const q=convert(p);
          if(prev)seg.push(prev,q);
          prev=q;
        }
      };
      for(let d=-60;d<=60;d+=30)line(Array.from({length:181},(_,i)=>project(i*2,d,state.viewRa,state.viewDec)));
      for(let a=0;a<360;a+=30)line(Array.from({length:91},(_,i)=>project(a,-90+i*2,state.viewRa,state.viewDec)));
      draw(seg,gl.LINES,[.39,.66,1,.31],1);
    }
    const sources=(state.sources||[]).slice(0,250);
    const gaia=[],wise=[],selected=[];
    for(const s of sources){
      if(!Number.isFinite(s.ra)||!Number.isFinite(s.dec))continue;
      const p=project(s.ra,s.dec,state.viewRa,state.viewDec);
      if(p[2]<0)continue;
      const v=convert(p);
      if(s.key===state.selectedKey)selected.push(v);
      else if(s.kind==='gaia')gaia.push(v);
      else wise.push(v);
    }
    draw(gaia,gl.POINTS,[.76,.91,1,1],4,true);
    draw(wise,gl.POINTS,[1,.75,.42,1],6,true);
    draw(selected,gl.POINTS,[1,1,1,1],12,true);
    if(state.target){
      const p=project(state.target.ra,state.target.dec,state.viewRa,state.viewDec);
      if(p[2]>=0){
        const v=convert(p),r=.025;
        draw([[v[0]-r,v[1],0],[v[0]+r,v[1],0],[v[0],v[1]-r,0],[v[0],v[1]+r,0]],gl.LINES,[.61,.94,1,.95],2);
      }
      const rr=state.radiusDeg;
      if(rr>0){
        const a=state.target.ra*degrees,d=state.target.dec*degrees,t=rr*degrees;
        const center=[Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)];
        const east=[-Math.sin(a),Math.cos(a),0],north=[-Math.sin(d)*Math.cos(a),-Math.sin(d)*Math.sin(a),Math.cos(d)];
        const pts=[];
        for(let i=0;i<=96;i++){
          const f=i*2*Math.PI/96;
          const v=center.map((x,j)=>x*Math.cos(t)+Math.sin(t)*(east[j]*Math.cos(f)+north[j]*Math.sin(f)));
          const p=project((Math.atan2(v[1],v[0])*180/Math.PI+360)%360,Math.asin(cap(v[2]))*180/Math.PI,state.viewRa,state.viewDec);
          pts.push(p);
        }
        const segments=[];let previous=null;
        for(const p of pts){
          if(p[2]<0){previous=null;continue;}
          const v=convert(p);if(previous)segments.push(previous,v);previous=v;
        }
        draw(segments,gl.LINES,[.53,.92,1,.84],1);
      }
    }
    gl.disableVertexAttribArray(posLoc);
  }
  function dispose(){
    if(destroyed)return;destroyed=true;
    gl.deleteBuffer(rect);gl.deleteBuffer(buf);
    gl.deleteProgram(orb);gl.deleteProgram(marker);
    for(const shader of shaders)gl.deleteShader(shader);
    canvas.remove();
  }
  canvas.addEventListener('webglcontextlost', e=>{e.preventDefault();dispose();stage.dispatchEvent(new CustomEvent('cosmic-webgl-lost'));},{once:true});
  return {render,dispose};
}
