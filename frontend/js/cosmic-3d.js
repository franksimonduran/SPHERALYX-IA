// Esfera celeste direccional ICRS. Representa direcciones reales de Gaia DR3 y AllWISE sin distancias físicas ni estrellas inventadas.
import { realApi } from './api.js';

const rad = Math.PI / 180, deg = 180 / Math.PI, wrap = value => ((value % 360) + 360) % 360;

function basis(ra, dec) {
  const a = ra * rad, d = dec * rad;
  return {
    center: [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)],
    east: [-Math.sin(a), Math.cos(a), 0],
    north: [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)],
  };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function projectEquatorial(ra, dec, viewRa, viewDec) {
  const a = ra * rad, d = dec * rad;
  const v = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const b = basis(viewRa, viewDec);
  return { x: dot(v, b.east), y: dot(v, b.north), depth: dot(v, b.center) };
}

export function unprojectEquatorial(x, y, viewRa, viewDec) {
  const q = x * x + y * y;
  if (!Number.isFinite(q) || q > 1) return null;
  const b = basis(viewRa, viewDec), z = Math.sqrt(Math.max(0, 1 - q));
  const v = b.center.map((c, i) => c * z + b.east[i] * x + b.north[i] * y);
  return { ra: wrap(Math.atan2(v[1], v[0]) * deg), dec: Math.asin(Math.max(-1, Math.min(1, v[2]))) * deg };
}

function angularSeparationArcsec(ra1, dec1, ra2, dec2) {
  const r1 = ra1 * rad, d1 = dec1 * rad, r2 = ra2 * rad, d2 = dec2 * rad;
  const a = Math.sin((d2 - d1) / 2) ** 2 + Math.cos(d1) * Math.cos(d2) * Math.sin((r2 - r1) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(Math.max(0, a)))) * deg * 3600;
}

function fmt(value, decimals = 4, suffix = '') {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(decimals)}${suffix}` : 'No disponible (null)';
}

function fmtWithErr(value, err, decimals = 3, unit = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'No disponible (null)';
  const e = typeof err === 'number' && Number.isFinite(err) ? ` ± ${err.toFixed(decimals)}` : '';
  return `${value.toFixed(decimals)}${e}${unit ? ' ' + unit : ''}`;
}

export function initCosmic3D() {
  const stage = document.querySelector('#cosmic-sphere'), canvas = document.querySelector('#cosmic-canvas');
  const ra = document.querySelector('#ra'), dec = document.querySelector('#dec');
  const radius = document.querySelector('#real-radius'), release = document.querySelector('#real-release');
  const status = document.querySelector('#cosmic-selection-status'), grid = document.querySelector('#cosmic-grid');
  const catalogStatus = document.querySelector('#cosmic-catalog-status');
  const gaiaBtn = document.querySelector('#cosmic-gaia-load'), wiseBtn = document.querySelector('#cosmic-wise-load');
  const clearBtn = document.querySelector('#cosmic-catalog-clear');
  const zoomInBtn = document.querySelector('#cosmic-zoom-in'), zoomOutBtn = document.querySelector('#cosmic-zoom-out'), zoomResetBtn = document.querySelector('#cosmic-zoom-reset');
  const sourceSelect = document.querySelector('#cosmic-source-select'), sourceDetail = document.querySelector('#cosmic-source-detail');
  const useSourceBtn = document.querySelector('#cosmic-use-source'), offline = document.querySelector('#offline-mode');
  if (!stage || !canvas || !ra || !dec || !radius || !release) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    stage.classList.add('cosmic-no-canvas');
    const help = stage.querySelector('#cosmic-help');
    if (help) help.textContent = 'Lienzo 2D no disponible; utiliza el selector de fuentes reales y los controles de coordenadas.';
  }

  let viewRa = 83.8221, viewDec = -5.3911, sphereZoom = 1, drag = null;
  let gaiaSources = [], wiseSources = [], selectedKey = '', projectedHits = [];
  let gaiaMeta = null, wiseMeta = null;
  let gaiaController = null, wiseController = null;
  let copyingCatalogCoords = false;
  // Conservar el campo original cuando el usuario copia las coordenadas de una fuente.
  let catalogFocus = null;
  let webgl = null, webglLoading = false;
  // El modo 3D se carga al solicitarlo: sin dependencia CDN obligatoria para la demo offline.
  const modeBtn = document.createElement('button');
  modeBtn.type = 'button';
  modeBtn.id = 'cosmic-renderer-toggle';
  modeBtn.className = 'cosmic-renderer-toggle';
  modeBtn.textContent = 'Activar Gaia 3D';
  modeBtn.setAttribute('aria-pressed', 'false');
  modeBtn.setAttribute('aria-label', 'Alternar visor Gaia 3D inmersivo y esfera celeste 2D');
  const modeStatus = document.createElement('span');
  modeStatus.id = 'cosmic-renderer-status';
  modeStatus.className = 'cosmic-renderer-status';
  modeStatus.textContent = 'Vista 2D · consulta Gaia DR3 para cargar estrellas reales';
  stage.append(modeBtn, modeStatus);
  const emptyState = document.createElement('div');
  emptyState.id = 'cosmic-gaia-empty';
  emptyState.className = 'cosmic-gaia-empty';
  emptyState.hidden = true;
  const emptyTitle = document.createElement('strong');
  emptyTitle.textContent = 'Explora el cielo real en 3D';
  const emptyText = document.createElement('p');
  emptyText.textContent = 'Consulta Gaia DR3 para proyectar estrellas auténticas en este visor.';
  const emptyLoad = document.createElement('button');
  emptyLoad.type = 'button';
  emptyLoad.textContent = 'Consultar Gaia DR3';
  emptyLoad.addEventListener('click', event => { event.stopPropagation(); gaiaBtn?.click(); });
  emptyState.append(emptyTitle, emptyText, emptyLoad);
  stage.append(emptyState);
  stage.dataset.renderMode = '2d';
  modeBtn.addEventListener('pointerdown', e => e.stopPropagation());
  modeBtn.addEventListener('click', async e => {
    e.stopPropagation();
    if (webglLoading) return;
    if (webgl) {
      webgl.dispose(); webgl = null;
      stage.classList.remove('webgl-active');
      stage.dataset.renderMode = '2d';
      modeBtn.setAttribute('aria-pressed', 'false');
      modeBtn.textContent = 'Activar Gaia 3D';
      modeStatus.textContent = 'Vista 2D · consulta Gaia DR3 para cargar estrellas reales';
      draw();
      return;
    }
    webglLoading = true;
    modeBtn.disabled = true;
    modeStatus.textContent = 'Preparando escena 3D…';
    try {
      // Renderizador local, independiente de CDN. Three.js queda como motor opcional
      // para futuras escenas; este modo es WebGL real y conserva la misma astronomía.
      const { createNativeCelestialWebGL } = await import('./cosmic-native-webgl.js');
      webgl = createNativeCelestialWebGL(stage);
      stage.classList.add('webgl-active');
      stage.dataset.renderMode = '3d';
      modeBtn.setAttribute('aria-pressed', 'true');
      modeBtn.textContent = 'Volver a vista 2D';
      modeStatus.textContent = 'Gaia 3D inmersivo activo · fuentes reales solo tras consulta';
      draw();
      publishGaiaViews();
    } catch (error) {
      stage.classList.remove('webgl-active');
      stage.dataset.renderMode = '2d';
      modeStatus.textContent = '3D no disponible aquí. Vista celeste 2D activa; puedes reintentar.';
      modeBtn.textContent = 'Reintentar Gaia 3D';
    } finally { webglLoading = false; modeBtn.disabled = false; }
  });
  // El usuario no debe descubrir el 3D escondido detrás de un botón:
  // se inicia automáticamente cuando el explorador entra en pantalla.
  // Si falta WebGL o la biblioteca no carga, conserva el Canvas original.
  let auto3dAttempted = false;
  function activateVisible3D() {
    if (auto3dAttempted || webgl || webglLoading || document.visibilityState === 'hidden') return;
    auto3dAttempted = true;
    if (typeof IntersectionObserver === 'undefined') {
      modeBtn.click();
    } else {
      modeBtn.click();
    }
  }
  if (typeof IntersectionObserver !== 'undefined') {
    const auto3dObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        auto3dObserver.disconnect();
        activateVisible3D();
      }
    }, { rootMargin: '80px 0px', threshold: 0.05 });
    auto3dObserver.observe(stage);
  } else {
    // Evita una dependencia adicional en navegadores antiguos.
    activateVisible3D();
  }
  stage.addEventListener('cosmic-webgl-lost', () => {
    webgl = null; stage.classList.remove('webgl-active');
    stage.dataset.renderMode = '2d'; modeBtn.setAttribute('aria-pressed', 'false');
    modeBtn.textContent = 'Activar Gaia 3D';
    modeStatus.textContent = 'Contexto WebGL perdido; visor 2D restaurado.';
    draw();
  });

  const coords = () => {
    const a = Number(ra.value), d = Number(dec.value);
    return ra.value.trim() && dec.value.trim() && Number.isFinite(a) && a >= 0 && a < 360 && Number.isFinite(d) && d >= -90 && d <= 90 ? { ra: a, dec: d } : null;
  };

  const validRadius = () => {
    const rr = Number(radius.value);
    return radius.value.trim() && Number.isFinite(rr) && rr > 0 && rr <= 0.25 ? rr : null;
  };

  function fitConeZoom(rr) {
    const s = Math.sin(Math.max(rr, 0.002) * rad);
    return Math.min(8000, Math.max(1, Math.round((0.68 / s) * 10) / 10));
  }

  // La procedencia de cada capa pertenece al cono consultado, no a los campos
  // RA/Dec que el usuario pueda editar posteriormente.
  function matchesCatalogQuery(meta) {
    const p = coords(), rr = validRadius(), q = meta?.query;
    if (!p || rr === null || !q) return false;
    const same = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-7;
    if (same(q.ra, p.ra) && same(q.dec, p.dec) && same(q.radius_deg, rr)) return true;
    // La consulta sigue siendo el cono original, no un nuevo cono en RA/Dec copiados.
    return Boolean(catalogFocus && selectedKey === catalogFocus.key &&
      same(catalogFocus.ra, p.ra) && same(catalogFocus.dec, p.dec) &&
      same(catalogFocus.radius_deg, rr) &&
      same(catalogFocus.query.ra, q.ra) &&
      same(catalogFocus.query.dec, q.dec) &&
      same(catalogFocus.query.radius_deg, q.radius_deg));
  }

  function publishGaiaViews() {
    const p = coords(), rr = validRadius();
    const valid = p && rr !== null && gaiaMeta && matchesCatalogQuery(gaiaMeta);
    document.dispatchEvent(new CustomEvent('spheralyx:gaia-visualization', { detail: {
      sources: valid ? gaiaSources : [],
      selectedKey: valid && selectedKey.startsWith('gaia:') ? selectedKey : '',
      query: valid ? gaiaMeta.query : p && rr !== null ? { ra:p.ra,dec:p.dec,radius_deg:rr } : null,
      meta: valid ? {source:gaiaMeta.source,service_url:gaiaMeta.service_url,truncated:gaiaMeta.truncated,queried_at_utc:gaiaMeta.queried_at_utc} : null
    }}));
  }
  function allCatalogItems() {
    const items = [];
    if (matchesCatalogQuery(gaiaMeta)) for (const s of gaiaSources) items.push({ key: `gaia:${s.source_id}`, kind: 'gaia', raw: s });
    if (matchesCatalogQuery(wiseMeta)) for (const s of wiseSources) items.push({ key: `wise:${s.source_id}`, kind: 'wise', raw: s });
    return items;
  }

  function populateSourceSelect() {
    if (!sourceSelect) return;
    const items = allCatalogItems();
    sourceSelect.replaceChildren(new Option('Ninguna fuente seleccionada', ''));
    for (const item of items) {
      const s = item.raw;
      const magLabel = item.kind === 'gaia'
        ? (typeof s.phot_g_mean_mag === 'number' ? `G=${s.phot_g_mean_mag.toFixed(2)}` : 'G=null')
        : (typeof s.w1mpro === 'number' ? `W1=${s.w1mpro.toFixed(2)}` : 'W1=null');
      const label = `${item.kind === 'gaia' ? 'Gaia DR3' : 'AllWISE'} ${s.source_id} · ${magLabel} · (${s.ra.toFixed(4)}°, ${s.dec.toFixed(4)}°)`;
      sourceSelect.add(new Option(label, item.key));
    }
    if (selectedKey && items.some(x => x.key === selectedKey)) {
      sourceSelect.value = selectedKey;
    } else {
      selectedKey = '';
      sourceSelect.value = '';
    }
    renderSourceDetail();
  }

  function findCandidateCounterpart(item) {
    // Un campo Gaia nuevo nunca se compara con un catálogo WISE de otra consulta.
    if (!matchesCatalogQuery(gaiaMeta) || !matchesCatalogQuery(wiseMeta)) return null;
    const others = item.kind === 'gaia' ? wiseSources : gaiaSources;
    if (!others.length) return null;
    let best = null, bestSep = 3.0;
    for (const candidate of others) {
      const sep = angularSeparationArcsec(item.raw.ra, item.raw.dec, candidate.ra, candidate.dec);
      if (sep <= bestSep) {
        bestSep = sep;
        best = { source: candidate, separation_arcsec: sep };
      }
    }
    return best;
  }

  function renderSourceDetail() {
    if (!sourceDetail || !useSourceBtn) return;
    const item = allCatalogItems().find(x => x.key === selectedKey);
    if (!item) {
      useSourceBtn.disabled = true;
      sourceDetail.textContent = gaiaSources.length || wiseSources.length
        ? 'Selecciona una fuente real en la esfera o en el selector para inspeccionar sus propiedades de catálogo.'
        : 'Consulta Gaia DR3 o AllWISE y selecciona una fuente para inspeccionar su identificador, época, fotometría, movimiento propio y paralaje sin valores inventados.';
      return;
    }
    useSourceBtn.disabled = false;
    const s = item.raw;
    const dl = document.createElement('dl');
    const addRow = (term, val) => {
      const dt = document.createElement('dt'); dt.textContent = term;
      const dd = document.createElement('dd'); dd.textContent = val;
      dl.append(dt, dd);
    };
    const counterpart = findCandidateCounterpart(item);
    if (item.kind === 'gaia') {
      addRow('Catálogo', `Gaia DR3 · ${gaiaMeta?.source || 'Archivo Gaia'}`);
      addRow('source_id', String(s.source_id));
      addRow('RA / Dec (ICRS)', `${fmt(s.ra, 6, '°')} / ${fmt(s.dec, 6, '°')}`);
      addRow('Época ref.', s.ref_epoch != null ? `J${Number(s.ref_epoch).toFixed(1)}` : 'No disponible (null) · catálogo Gaia DR3: J2016.0');
      addRow('Mag G', fmt(s.phot_g_mean_mag, 3, ' mag'));
      addRow('BP / RP', `${fmt(s.phot_bp_mean_mag, 3)} / ${fmt(s.phot_rp_mean_mag, 3)}`);
      addRow('Color BP−RP', fmt(s.bp_rp, 3, ' mag'));
      addRow('pmRA', fmtWithErr(s.pmra, s.pmra_error, 3, 'mas/año'));
      addRow('pmDec', fmtWithErr(s.pmdec, s.pmdec_error, 3, 'mas/año'));
      addRow('Paralaje', fmtWithErr(s.parallax, s.parallax_error, 3, 'mas'));
      addRow('RUWE', fmt(s.ruwe, 3));
      addRow('Separación al centro', fmt(s.separation_arcsec, 2, '″'));
      if (wiseSources.length) {
        addRow('Asociación AllWISE', counterpart
          ? `Candidata no confirmada: ${counterpart.source.designation} a ${counterpart.separation_arcsec.toFixed(2)}″`
          : 'Sin coincidencia candidata ≤ 3″');
      }
    } else {
      addRow('Catálogo', 'AllWISE (NASA/IPAC IRSA TAP)');
      addRow('Designación', String(s.designation || s.source_id));
      addRow('RA / Dec (J2000)', `${fmt(s.ra, 6, '°')} / ${fmt(s.dec, 6, '°')}`);
      addRow('W1 (3.4 µm)', fmtWithErr(s.w1mpro, s.w1sigmpro, 3, 'mag'));
      addRow('W2 (4.6 µm)', fmtWithErr(s.w2mpro, s.w2sigmpro, 3, 'mag'));
      addRow('W3 (12 µm)', fmtWithErr(s.w3mpro, s.w3sigmpro, 3, 'mag'));
      addRow('W4 (22 µm)', fmtWithErr(s.w4mpro, s.w4sigmpro, 3, 'mag'));
      addRow('Calidad (ph_qual)', s.ph_qual || 'No disponible (null)');
      addRow('Artefactos (cc_flags)', s.cc_flags || 'No disponible (null)');
      addRow('Extensión (ext_flg)', s.ext_flg != null ? String(s.ext_flg) : 'No disponible (null)');
      addRow('Separación al centro', fmt(s.separation_arcsec, 2, '″'));
      addRow('Estado asociación', counterpart
        ? `Candidata no confirmada con Gaia DR3 ${counterpart.source.source_id} (${counterpart.separation_arcsec.toFixed(2)}″)`
        : 'Candidata por proximidad no confirmada');
    }
    const note = document.createElement('p');
    note.textContent = item.kind === 'gaia'
      ? 'Posición direccional en época J2016.0; la paralaje no se convierte en distancia física.'
      : 'Fuente infrarroja AllWISE; cualquier proximidad angular es una asociación candidata no confirmada y no se resta de SPHEREx.';
    sourceDetail.replaceChildren(dl, note);
  }

  function applySelectedSourceToCoords(item) {
    if (!item) return;
    const query = (item.kind === 'gaia' ? gaiaMeta : wiseMeta)?.query;
    catalogFocus = query ? {
      key: item.key, ra: wrap(Number(item.raw.ra.toFixed(6))),
      dec: Number(item.raw.dec.toFixed(6)), radius_deg: validRadius(),
      query: { ...query }
    } : null;
    ra.value = wrap(Number(item.raw.ra.toFixed(6))).toFixed(6);
    dec.value = item.raw.dec.toFixed(6);
    copyingCatalogCoords = true;
    try {
      ra.dispatchEvent(new Event('input', { bubbles: true }));
      dec.dispatchEvent(new Event('input', { bubbles: true }));
    } finally { copyingCatalogCoords = false; }
    const label = item.kind === 'gaia' ? `Gaia DR3 ${item.raw.source_id}` : `AllWISE ${item.raw.source_id}`;
    status.textContent = `Coordenadas actualizadas desde ${label}. El visor conserva el campo original consultado; pulsa Buscar en IRSA para una nueva consulta (no automática).`;
    publishGaiaViews();
    draw();
  }

  function selectSourceByKey(key, { copyCoords = false } = {}) {
    selectedKey = key || '';
    if (sourceSelect && sourceSelect.value !== selectedKey) sourceSelect.value = selectedKey;
    renderSourceDetail();
    const item = allCatalogItems().find(x => x.key === selectedKey);
    publishGaiaViews();
    if (item && copyCoords) {
      applySelectedSourceToCoords(item);
    } else {
      draw();
    }
  }

  function info() {
    const p = coords();
    document.querySelector('#cosmic-ra').textContent = p ? `${p.ra.toFixed(4)}°` : 'No disponible';
    document.querySelector('#cosmic-dec').textContent = p ? `${p.dec.toFixed(4)}°` : 'No disponible';
    document.querySelector('#cosmic-radius').textContent = radius.value ? `${radius.value}°` : 'No disponible';
    document.querySelector('#cosmic-release').textContent = release.value.toUpperCase();
    if (zoomResetBtn) zoomResetBtn.textContent = sphereZoom === 1 ? '1×' : `${sphereZoom < 10 ? sphereZoom.toFixed(1) : Math.round(sphereZoom)}×`;
  }

  function draw() {
    info();
    stage.dataset.view = `${viewRa.toFixed(4)},${viewDec.toFixed(4)}`;
    stage.dataset.zoom = sphereZoom.toFixed(2);
    stage.dataset.gaiaCount = String(gaiaSources.length);
    stage.dataset.wiseCount = String(wiseSources.length);
    stage.dataset.selectedSource = selectedKey;
    stage.dataset.catalogStale = String((gaiaSources.length > 0 && !matchesCatalogQuery(gaiaMeta)) ||
      (wiseSources.length > 0 && !matchesCatalogQuery(wiseMeta)));
    projectedHits = [];
    if (!ctx) return;
    const box = stage.getBoundingClientRect(), w = box.width, h = box.height;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.43, scale = r * sphereZoom;
    const glow = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, 0, cx, cy, r * 1.12);
    glow.addColorStop(0, 'rgba(38,70,100,.48)');
    glow.addColorStop(0.76, 'rgba(12,28,53,.55)');
    glow.addColorStop(0.94, 'rgba(47,104,150,.35)');
    glow.addColorStop(1, 'rgba(5,12,28,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Nebulosa de iluminación *decorativa*: no representa fuentes Gaia ni imágenes FITS.
    // Ningún punto estelar se genera aquí; las marcas de fuentes proceden de TAP.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.33);
    ctx.scale(1, 0.30);
    const nebula = ctx.createRadialGradient(-r * .18, 0, r * .07, 0, 0, r * 1.03);
    nebula.addColorStop(0, 'rgba(157,89,241,.13)');
    nebula.addColorStop(.4, 'rgba(61,95,200,.10)');
    nebula.addColorStop(.77, 'rgba(63,155,216,.055)');
    nebula.addColorStop(1, 'rgba(63,155,216,0)');
    ctx.fillStyle = nebula;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (grid.checked) {
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = 'rgba(130,199,228,.24)';
      const line = points => {
        ctx.beginPath();
        let visible = false;
        for (const [a, d] of points) {
          const p = projectEquatorial(a, d, viewRa, viewDec);
          if (p.depth < 0) { visible = false; continue; }
          const sx = cx + p.x * scale, sy = cy - p.y * scale;
          if (!visible) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
          visible = true;
        }
        ctx.stroke();
      };
      for (let d = -60; d <= 60; d += 30) line(Array.from({ length: 181 }, (_, i) => [i * 2, d]));
      for (let a = 0; a < 360; a += 30) line(Array.from({ length: 91 }, (_, i) => [a, -90 + i * 2]));
    }

    // Fuentes reales Gaia DR3 y AllWISE proyectadas sobre la esfera de radio constante (sin distancias físicas).
    for (const item of allCatalogItems().filter(item =>
      matchesCatalogQuery(item.kind === 'gaia' ? gaiaMeta : wiseMeta))) {
      const s = item.raw;
      const p = projectEquatorial(s.ra, s.dec, viewRa, viewDec);
      if (p.depth < 0) continue;
      const sx = cx + p.x * scale, sy = cy - p.y * scale;
      if (webgl ? (sx < -4 || sy < -4 || sx > w + 4 || sy > h + 4) : Math.hypot(sx - cx, sy - cy) > r + 4) continue;
      projectedHits.push({ key: item.key, item, x: sx, y: sy });

      if (item.kind === 'gaia') {
        const mag = typeof s.phot_g_mean_mag === 'number' && Number.isFinite(s.phot_g_mean_mag) ? s.phot_g_mean_mag : 17.5;
        const radiusPx = Math.max(1.8, Math.min(4.2, 4.4 - (mag - 10) * 0.22));
        const warm = typeof s.bp_rp === 'number' && Number.isFinite(s.bp_rp) && s.bp_rp > 1.2;
        ctx.fillStyle = warm ? 'rgba(255,232,196,.92)' : 'rgba(196,238,255,.94)';
        ctx.shadowBlur = item.key === selectedKey ? 19 : 7;
        ctx.shadowColor = warm ? 'rgba(255,194,138,.54)' : 'rgba(117,172,255,.55)';
        ctx.beginPath();
        ctx.arc(sx, sy, radiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        const w1 = typeof s.w1mpro === 'number' && Number.isFinite(s.w1mpro) ? s.w1mpro : 15.0;
        const sizePx = Math.max(2.0, Math.min(4.0, 4.0 - (w1 - 9) * 0.2));
        ctx.strokeStyle = 'rgba(255,198,109,.95)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(sx, sy - sizePx - 1);
        ctx.lineTo(sx + sizePx + 1, sy);
        ctx.lineTo(sx, sy + sizePx + 1);
        ctx.lineTo(sx - sizePx - 1, sy);
        ctx.closePath();
        ctx.stroke();
      }

      if (item.key === selectedKey) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(sx, sy, 8.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const currentCoords = coords();
    const rr = validRadius();
    if (currentCoords && rr !== null) {
      const target = basis(currentCoords.ra, currentCoords.dec), camera = basis(viewRa, viewDec);
      ctx.beginPath();
      ctx.strokeStyle = '#b8f6ff';
      ctx.lineWidth = 1;
      let active = false;
      for (let i = 0; i <= 72; i++) {
        const t = (i * 2 * Math.PI) / 72;
        const v = target.center.map((c, j) => c * Math.cos(rr * rad) + Math.sin(rr * rad) * (target.east[j] * Math.cos(t) + target.north[j] * Math.sin(t)));
        if (dot(v, camera.center) < 0) { active = false; continue; }
        const x = cx + dot(v, camera.east) * scale, y = cy - dot(v, camera.north) * scale;
        if (!active) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        active = true;
      }
      ctx.stroke();
    }

    if (currentCoords) {
      const p = projectEquatorial(currentCoords.ra, currentCoords.dec, viewRa, viewDec);
      if (p.depth >= 0) {
        const x = cx + p.x * scale, y = cy - p.y * scale;
        ctx.strokeStyle = '#9deeff';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y);
        ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 14);
        ctx.stroke();
      }
    }

    ctx.restore();
    stage.dataset.renderedSources = String(projectedHits.length);
    emptyState.hidden = !webgl || projectedHits.length > 0;
    if (!emptyState.hidden) {
      const stale = stage.dataset.catalogStale === 'true';
      emptyTitle.textContent = stale ? 'El campo consultado ha cambiado' : 'Explora el cielo real en 3D';
      emptyText.textContent = stale
        ? 'Las fuentes pertenecen al cono anterior. Consulta Gaia DR3 en las nuevas coordenadas o vuelve al campo original.'
        : gaiaMeta && gaiaSources.length === 0
          ? 'La consulta devolvió 0 fuentes. Prueba otras coordenadas o un radio mayor.'
          : 'Consulta Gaia DR3 para proyectar estrellas auténticas en este visor. No se generan estrellas ficticias.';
      emptyLoad.disabled = Boolean(gaiaBtn?.disabled || document.body.dataset.catalogMode === 'offline');
    }
    if (webgl) {
      const countGaia = projectedHits.filter(p => p.item.kind === 'gaia').length;
      modeStatus.textContent = projectedHits.length
        ? `Gaia 3D · ${countGaia} Gaia + ${projectedHits.length - countGaia} WISE visibles · campo real`
        : 'Gaia 3D · sin fuentes visibles · consulta Gaia DR3 o centra el campo';
    }

    ctx.strokeStyle = 'rgba(141,206,241,.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();
    if (webgl) {
      try {
        webgl.render({
          viewRa, viewDec, zoom: sphereZoom, showGrid: grid.checked,
          sources: allCatalogItems()
            .filter(item => matchesCatalogQuery(item.kind === 'gaia' ? gaiaMeta : wiseMeta))
            .map(item => ({ key:item.key,kind:item.kind,ra:item.raw.ra,dec:item.raw.dec,mag:item.raw.phot_g_mean_mag,bp_rp:item.raw.bp_rp,w1mpro:item.raw.w1mpro })),
          selectedKey, target: coords(), radiusDeg: validRadius()
        });
      } catch (_) {
        webgl.dispose(); webgl = null; stage.classList.remove('webgl-active');
        stage.dataset.renderMode = '2d'; modeBtn.setAttribute('aria-pressed','false');
        modeBtn.textContent = 'Reintentar Gaia 3D';
        modeStatus.textContent = 'Error gráfico; visor 2D restaurado.';
      }
    }
  }

  function selected(p) {
    ra.value = wrap(Number(p.ra.toFixed(6))).toFixed(6);
    dec.value = p.dec.toFixed(6);
    ra.dispatchEvent(new Event('input', { bubbles: true }));
    dec.dispatchEvent(new Event('input', { bubbles: true }));
    status.textContent = 'Coordenadas actualizadas. Pulsa Buscar en IRSA; los resultados anteriores pertenecen a su búsqueda original.';
    draw();
  }

  function center() {
    const p = coords();
    if (!p) {
      status.textContent = 'Introduce coordenadas RA/Dec válidas antes de centrar.';
      return;
    }
    viewRa = p.ra;
    viewDec = p.dec;
    draw();
  }

  function abortCatalogRequests() {
    if (gaiaController) { gaiaController.abort(); gaiaController = null; }
    if (wiseController) { wiseController.abort(); wiseController = null; }
    if (gaiaBtn) gaiaBtn.disabled = false;
    if (wiseBtn) wiseBtn.disabled = false;
  }

  function updateCatalogSummary() {
    if (!catalogStatus) return;
    const parts = [];
    if (gaiaMeta) {
      parts.push(`Gaia DR3 · ${gaiaMeta.source || 'Archivo ESA'} (${gaiaMeta.reference_epoch || 'J2016.0'}): ${gaiaSources.length} fuentes reales${gaiaMeta.truncated ? ' (posible truncamiento)' : ''}${matchesCatalogQuery(gaiaMeta) ? '' : ' · CONSULTA ANTERIOR: fuentes ocultas hasta volver al campo consultado'}`);
    }
    if (wiseMeta) {
      parts.push(`AllWISE: ${wiseSources.length} fuentes reales${wiseMeta.truncated ? ' (posible truncamiento)' : ''}${matchesCatalogQuery(wiseMeta) ? '' : ' · CONSULTA ANTERIOR: fuentes ocultas hasta volver al campo consultado'} · asociación candidata no confirmada`);
    }
    if (!parts.length) {
      catalogStatus.textContent = 'Sin catálogos cargados · consulta Gaia DR3 o AllWISE para representar fuentes reales en el visor 3D.';
      publishGaiaViews();
      return;
    }
    catalogStatus.textContent = `${parts.join(' | ')}. ${catalogFocus ? 'Se conserva el campo original consultado al copiar una fuente. ' : ''}Representación direccional sin distancias físicas.`;
    publishGaiaViews();
  }

  async function loadCatalog(kind) {
    if (offline?.checked || document.body.dataset.catalogMode === 'offline') {
      abortCatalogRequests();
      if (catalogStatus) catalogStatus.textContent = 'CATÁLOGOS NO DISPONIBLES · No se pueden consultar Gaia DR3 ni AllWISE desde este servidor.';
      return;
    }
    const p = coords(), rr = validRadius();
    if (!p || rr === null) {
      if (catalogStatus) catalogStatus.textContent = 'Coordenadas o radio no válidos: RA [0, 360), Dec [−90, 90], radio (0, 0.25] grados.';
      return;
    }
    const isGaia = kind === 'gaia';
    catalogFocus = null;
    if (isGaia && gaiaController) gaiaController.abort();
    if (!isGaia && wiseController) wiseController.abort();
    const controller = new AbortController();
    if (isGaia) { gaiaController = controller; if (gaiaBtn) gaiaBtn.disabled = true; }
    else { wiseController = controller; if (wiseBtn) wiseBtn.disabled = true; }
    if (catalogStatus) catalogStatus.textContent = isGaia ? 'Consultando Gaia DR3 (ESA / Gaia@AIP)…' : 'Consultando AllWISE en NASA/IPAC IRSA TAP…';

    try {
      const data = isGaia
        ? await realApi.gaiaSources({ ra: p.ra, dec: p.dec, radius: rr, limit: 120 }, controller.signal)
        : await realApi.wiseSources({ ra: p.ra, dec: p.dec, radius: rr, limit: 120 }, controller.signal);
      if ((isGaia ? gaiaController : wiseController) !== controller || controller.signal.aborted) return;
      if (data.mode !== 'real' || !Array.isArray(data.sources)) throw new Error('Formato de respuesta de catálogo no reconocido');

      if (isGaia) {
        gaiaSources = data.sources;
        gaiaMeta = { ...data, query: { ra: p.ra, dec: p.dec, radius_deg: rr } };
      } else {
        wiseSources = data.sources;
        wiseMeta = { ...data, query: { ra: p.ra, dec: p.dec, radius_deg: rr } };
      }
      viewRa = p.ra;
      viewDec = p.dec;
      sphereZoom = fitConeZoom(rr);
      populateSourceSelect();
      if (!data.sources.length) {
        if (catalogStatus) {
          catalogStatus.textContent = `${isGaia ? 'Gaia DR3' : 'AllWISE'} devolvió 0 fuentes reales en este cono (RA ${p.ra.toFixed(4)}°, Dec ${p.dec.toFixed(4)}°, r=${rr}°). No se generan estrellas sustitutas.`;
        }
      } else {
        updateCatalogSummary();
      }
      draw();
    } catch (error) {
      if ((isGaia ? gaiaController : wiseController) === controller && !controller.signal.aborted && error.name !== 'AbortError') {
        if (isGaia) { gaiaSources = []; gaiaMeta = null; }
        else { wiseSources = []; wiseMeta = null; }
        populateSourceSelect();
        draw();
        publishGaiaViews();
        if (catalogStatus) {
          catalogStatus.textContent = `Error al consultar ${isGaia ? 'Gaia DR3' : 'AllWISE'}: ${error.message}. No se muestran fuentes sintéticas.`;
        }
      }
    } finally {
      if (isGaia && gaiaController === controller) { gaiaController = null; if (gaiaBtn) gaiaBtn.disabled = false; }
      if (!isGaia && wiseController === controller) { wiseController = null; if (wiseBtn) wiseBtn.disabled = false; }
    }
  }

  for (const input of [ra, dec, radius, release]) {
    input.addEventListener('input', () => { abortCatalogRequests(); if (!copyingCatalogCoords) { catalogFocus = null; populateSourceSelect(); } updateCatalogSummary(); draw(); });
    input.addEventListener('change', () => { abortCatalogRequests(); if (!copyingCatalogCoords) { catalogFocus = null; populateSourceSelect(); } updateCatalogSummary(); draw(); });
  }
  grid.addEventListener('change', draw);
  document.querySelector('#cosmic-center').addEventListener('click', center);
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => { sphereZoom = Math.min(8000, Math.round(sphereZoom * 1.6 * 10) / 10); draw(); });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { sphereZoom = Math.max(1, Math.round((sphereZoom / 1.6) * 10) / 10); draw(); });
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => { sphereZoom = 1; draw(); });
  if (gaiaBtn) gaiaBtn.addEventListener('click', () => loadCatalog('gaia'));
  if (wiseBtn) wiseBtn.addEventListener('click', () => loadCatalog('wise'));
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      abortCatalogRequests();
      gaiaSources = []; wiseSources = []; gaiaMeta = null; wiseMeta = null; selectedKey = ''; catalogFocus = null;
      sphereZoom = 1;
      populateSourceSelect();
      updateCatalogSummary();
      draw();
    });
  }
  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => selectSourceByKey(sourceSelect.value, { copyCoords: false }));
  }
  if (useSourceBtn) {
    useSourceBtn.addEventListener('click', () => {
      const item = allCatalogItems().find(x => x.key === selectedKey);
      if (item) applySelectedSourceToCoords(item);
    });
  }
  if (offline) {
    offline.addEventListener('change', () => {
      if (offline.checked) {
        abortCatalogRequests();
        gaiaSources = []; wiseSources = []; gaiaMeta = null; wiseMeta = null; selectedKey = ''; catalogFocus = null;
        populateSourceSelect();
        if (catalogStatus) catalogStatus.textContent = 'CATÁLOGOS NO DISPONIBLES · No se pueden consultar Gaia DR3 ni AllWISE desde este servidor.';
        draw();
      } else {
        updateCatalogSummary();
      }
    });
  }

  document.querySelector('#cosmic-search').addEventListener('click', () => {
    if (document.body.dataset.irsaMode === 'offline') {
      status.textContent = 'SPHEREx está restringido en este servidor. Consulta Gaia DR3 o AllWISE desde los controles del explorador.';
      return;
    }
    if (!coords()) {
      status.textContent = 'Introduce coordenadas RA/Dec válidas antes de buscar.';
      return;
    }
    document.querySelector('#real-search').requestSubmit();
    document.querySelector('#real-title').scrollIntoView({ block: 'start' });
  });

  // Acercamiento continuo sin cambiar las coordenadas ni volver a consultar servicios.
  stage.addEventListener('wheel', event => {
    event.preventDefault();
    sphereZoom = Math.max(1, Math.min(8000, sphereZoom * (event.deltaY < 0 ? 1.22 : 1 / 1.22)));
    draw();
  }, { passive: false });

  stage.addEventListener('keydown', event => {
    if (event.target !== stage) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selected({ ra: viewRa, dec: viewDec });
      return;
    }
    const keys = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] };
    if (!keys[event.key]) return;
    event.preventDefault();
    const stepScale = 1 / Math.max(1, Math.min(25, sphereZoom * 0.25));
    viewRa = wrap(viewRa + keys[event.key][0] * stepScale);
    viewDec = Math.max(-90, Math.min(90, viewDec + keys[event.key][1] * stepScale));
    draw();
  });

  stage.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
    if (drag.moved) {
      const dragScale = 0.35 / Math.max(1, sphereZoom * 0.5);
      viewRa = wrap(viewRa - dx * dragScale);
      viewDec = Math.max(-90, Math.min(90, viewDec + dy * dragScale));
      draw();
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
  });

  stage.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const click = !drag.moved;
    drag = null;
    if (!click) return;
    const rect = stage.getBoundingClientRect(), r = Math.min(rect.width, rect.height) * 0.43;
    const mx = event.clientX - rect.left, my = event.clientY - rect.top;
    const cx = rect.width / 2, cy = rect.height / 2;
    let nearest = null, bestDist = 12;
    for (const hit of projectedHits) {
      const d = Math.hypot(hit.x - mx, hit.y - my);
      if (d < bestDist) { bestDist = d; nearest = hit; }
    }
    if (nearest) {
      selectSourceByKey(nearest.key, { copyCoords: true });
      return;
    }
    if (!webgl && Math.hypot(mx - cx, my - cy) > r) {
      status.textContent = 'Selecciona una dirección dentro del visor.';
      return;
    }
    const p = unprojectEquatorial((mx - cx) / (r * sphereZoom), -(my - cy) / (r * sphereZoom), viewRa, viewDec);
    if (p) selected(p);
    else status.textContent = 'Selecciona una dirección válida del cielo.';
  });

  for (const type of ['pointercancel', 'lostpointercapture']) stage.addEventListener(type, () => { drag = null; });
  if ('ResizeObserver' in window) new ResizeObserver(draw).observe(stage);
  else window.addEventListener('resize', draw);
  populateSourceSelect();
  center();
  publishGaiaViews();
}
