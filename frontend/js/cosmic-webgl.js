/* Esfera direccional Three.js, bajo demanda; no genera estrellas artificiales.
   Three.js 0.170.0 (MIT): https://github.com/mrdoob/three.js/blob/r170/LICENSE
   El Canvas 2D de cosmic-3d.js sigue funcionando cuando WebGL/CDN falla. */
export async function createCelestialWebGL(stage) {
  if (!('WebGLRenderingContext' in window)) throw new Error('WebGL no disponible en este navegador');
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'cosmic-webgl-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.pointerEvents = 'none';
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);
  const material = new THREE.MeshBasicMaterial({
    color: 0x2b4b91, transparent: true, opacity: 0.13, depthWrite: false
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material);
  scene.add(globe);
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.996, 1.001, 160),
    new THREE.MeshBasicMaterial({ color: 0x84acff, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false })
  );
  rim.position.z = 1.002; // Silueta visual; no geometría de distancia real.
  scene.add(rim);
  const objects = [];
  let alive = true;
  const rad = Math.PI / 180;
  const projection = (ra, dec, viewRa, viewDec) => {
    const a = ra * rad, d = dec * rad, ca = viewRa * rad, cd = viewDec * rad;
    const vx = Math.cos(d) * Math.cos(a), vy = Math.cos(d) * Math.sin(a), vz = Math.sin(d);
    const east = -Math.sin(ca) * vx + Math.cos(ca) * vy;
    const north = -Math.sin(cd) * Math.cos(ca) * vx - Math.sin(cd) * Math.sin(ca) * vy + Math.cos(cd) * vz;
    const depth = Math.cos(cd) * Math.cos(ca) * vx + Math.cos(cd) * Math.sin(ca) * vy + Math.sin(cd) * vz;
    return [east, north, depth];
  };
  function cleanupObjects() {
    for (const o of objects) {
      scene.remove(o);
      o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
    objects.length = 0;
  }
  const addLine = (coordinates, color, opacity = 0.27) => {
    const verts = [];
    let previous = null;
    for (const p of coordinates) {
      if (p[2] < 0) { previous = null; continue; }
      if (previous) verts.push(...previous, ...p);
      previous = p;
    }
    if (!verts.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color, transparent: true, opacity, depthTest: false
    }));
    scene.add(line); objects.push(line);
  };
  function addMarker(ra, dec, kind, viewRa, viewDec, selected) {
    const p = projection(ra, dec, viewRa, viewDec);
    if (p[2] < 0) return;
    const isGaia = kind === 'gaia';
    const points = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3)),
      new THREE.PointsMaterial({ color: isGaia ? 0xb5e9ff : 0xffca82, size: selected ? 10 : (isGaia ? 4.5 : 5.5), sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0.98 })
    );
    scene.add(points); objects.push(points);
    if (selected) {
      const pts = Array.from({length:65}, (_,i) => {
        const angle = 2 * Math.PI * i / 64;
        return [p[0] + .023 * Math.cos(angle), p[1] + .023 * Math.sin(angle), p[2] + .02];
      });
      addLine(pts, 0xffffff, .98);
    }
  }
  function render({ viewRa, viewDec, zoom, showGrid, sources, selectedKey, target, radiusDeg }) {
    if (!alive) return;
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    renderer.setSize(Math.round(bounds.width), Math.round(bounds.height), false);
    // Coincide con el radio geométrico del visor Canvas 2D (43 % del lado menor).
    const halfHeight = bounds.height / (Math.min(bounds.width, bounds.height) * 0.43 * zoom);
    camera.left = -halfHeight * bounds.width / bounds.height;
    camera.right = halfHeight * bounds.width / bounds.height;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    cleanupObjects();
    if (showGrid) {
      for (let d = -60; d <= 60; d += 30) addLine(Array.from({length:181}, (_,i) => projection(i * 2, d, viewRa, viewDec)), 0x7698db);
      for (let a = 0; a < 360; a += 30) addLine(Array.from({length:91}, (_,i) => projection(a, -90 + i * 2, viewRa, viewDec)), 0x7698db);
    }
    const limited = sources.slice(0, 250); // Presupuesto gráfico; servidor ya limita las filas.
    for (const source of limited) {
      if (!Number.isFinite(source.ra) || !Number.isFinite(source.dec)) continue;
      addMarker(source.ra, source.dec, source.kind, viewRa, viewDec, source.key === selectedKey);
    }
    if (target && Number.isFinite(target.ra) && Number.isFinite(target.dec)) {
      const p = projection(target.ra, target.dec, viewRa, viewDec);
      if (p[2] >= 0) {
        addLine([[p[0]-.018,p[1],p[2]+.012],[p[0]+.018,p[1],p[2]+.012]],0xb3efff,.95);
        addLine([[p[0],p[1]-.018,p[2]+.012],[p[0],p[1]+.018,p[2]+.012]],0xb3efff,.95);
      }
      if (Number.isFinite(radiusDeg) && radiusDeg > 0) {
        const a=target.ra*rad,d=target.dec*rad,ang=radiusDeg*rad;
        const c=[Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)];
        const e=[-Math.sin(a),Math.cos(a),0],n=[-Math.sin(d)*Math.cos(a),-Math.sin(d)*Math.sin(a),Math.cos(d)];
        const ring=[];
        for(let i=0;i<=96;i++){
          const t=i*2*Math.PI/96;
          const v=c.map((x,j)=>x*Math.cos(ang)+Math.sin(ang)*(e[j]*Math.cos(t)+n[j]*Math.sin(t)));
          const rra=(Math.atan2(v[1],v[0])*180/Math.PI+360)%360;
          const ddec=Math.asin(Math.max(-1,Math.min(1,v[2])))*180/Math.PI;
          ring.push(projection(rra,ddec,viewRa,viewDec));
        }
        addLine(ring,0x96eaff,.7);
      }
    }
    renderer.render(scene, camera);
  }
  function dispose() {
    if(!alive)return;
    alive=false;cleanupObjects();globe.geometry.dispose();globe.material.dispose();
    rim.geometry.dispose();rim.material.dispose();renderer.dispose();
    renderer.domElement.remove();
  }
  renderer.domElement.addEventListener('webglcontextlost',e=>{ e.preventDefault();dispose();stage.dispatchEvent(new CustomEvent('cosmic-webgl-lost')); }, {once:true});
  return {render, dispose};
}
