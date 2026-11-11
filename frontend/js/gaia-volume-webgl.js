// GPU renderer for the Gaia DR3 subset already returned by the trusted backend.
// No generated stars, catalog requests, or external scripts are used here.
export function createGaiaVolumeWebGL(canvas, onLost) {
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: false
  });
  if (!gl) return null;
  const vertexSource = [
    'attribute vec3 aPosition;',
    'attribute vec3 aColor;',
    'attribute float aSize;',
    'attribute float aSelected;',
    'uniform float uYaw;',
    'uniform float uPitch;',
    'uniform float uScale;',
    'uniform float uDpr;',
    'uniform vec2 uViewport;',
    'varying vec3 vColor;',
    'varying float vSelected;',
    'void main() {',
    '  float sy = sin(uYaw), cy = cos(uYaw);',
    '  float sp = sin(uPitch), cp = cos(uPitch);',
    '  float xx = aPosition.x * cy - aPosition.y * sy;',
    '  float yy = aPosition.x * sy + aPosition.y * cy;',
    '  float zz = aPosition.z * cp - yy * sp;',
    '  float depth = aPosition.z * sp + yy * cp;',
    '  float perspective = 1.0 / (1.0 + depth * 0.38);',
    '  gl_Position = vec4(xx * uScale * perspective * 2.0 / uViewport.x,',
    '                     zz * uScale * perspective * 2.0 / uViewport.y, depth * 0.25, 1.0);',
    '  gl_PointSize = min(28.0, aSize * uDpr * perspective);',
    '  vColor = aColor;',
    '  vSelected = aSelected;',
    '}'
  ].join('\n');
  const fragmentSource = [
    'precision mediump float;',
    'varying vec3 vColor;',
    'varying float vSelected;',
    'void main() {',
    '  float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;',
    '  if (radius > 1.0) discard;',
    '  float glow = exp(-4.0 * radius * radius);',
    '  float alpha = (vSelected > 0.5 ? 0.96 : 0.86) * glow;',
    '  vec3 color = vSelected > 0.5 ? vec3(1.0, 0.84, 0.51) : vColor;',
    '  gl_FragColor = vec4(color, alpha);',
    '}'
  ].join('\n');
  function shader(type, source) {
    const item = gl.createShader(type);
    if (!item) throw new Error('No se pudo crear el shader WebGL');
    gl.shaderSource(item, source);
    gl.compileShader(item);
    if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(item) || 'Error de compilación WebGL';
      gl.deleteShader(item);
      throw new Error(message);
    }
    return item;
  }
  const vertex = shader(gl.VERTEX_SHADER, vertexSource);
  const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('No se pudo crear el programa WebGL');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Error de enlace WebGL');
  }
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('No se pudo crear el búfer WebGL');
  const fields = [
    ['aPosition', 3, 0], ['aColor', 3, 12],
    ['aSize', 1, 24], ['aSelected', 1, 28]
  ];
  const uniforms = Object.fromEntries(['uYaw', 'uPitch', 'uScale', 'uDpr', 'uViewport']
    .map(name => [name, gl.getUniformLocation(program, name)]));
  let disposed = false;
  const lost = event => { event.preventDefault(); disposed = true; onLost?.(); };
  canvas.addEventListener('webglcontextlost', lost);
  function render(points, camera) {
    if (disposed) return;
    const { width, height, dpr, yaw, pitch, scale } = camera;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    gl.uniform1f(uniforms.uYaw, yaw);
    gl.uniform1f(uniforms.uPitch, pitch);
    gl.uniform1f(uniforms.uScale, scale);
    gl.uniform1f(uniforms.uDpr, dpr);
    gl.uniform2f(uniforms.uViewport, width, height);
    const data = new Float32Array(points.length * 8);
    points.forEach((point, i) => {
      const start = i * 8;
      data.set([point.x, point.y, point.z, ...point.color,
        point.selected ? 17 : point.size, point.selected ? 1 : 0], start);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    for (const [name, count, offset] of fields) {
      const location = gl.getAttribLocation(program, name);
      if (location < 0) continue;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, count, gl.FLOAT, false, 32, offset);
    }
    gl.drawArrays(gl.POINTS, 0, points.length);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', lost);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  }
  return { render, dispose };
}
