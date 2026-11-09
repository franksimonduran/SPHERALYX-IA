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
    return Math.min(250, Math.max(1, Math.round((0.68 / s) * 10) / 10));
  }

  // La procedencia de cada capa pertenece al cono consultado, no a los campos
  // RA/Dec que el usuario pueda editar posteriormente.
  function matchesCatalogQuery(meta) {
    const p = coords(), rr = validRadius(), q = meta?.query;
    return Boolean(p && rr !== null && q &&
      Math.abs(Number(q.ra) - p.ra) < 1e-7 &&
      Math.abs(Number(q.dec) - p.dec) < 1e-7 &&
      Math.abs(Number(q.radius_deg) - rr) < 1e-7);
  }

  function allCatalogItems() {
    const items = [];
    for (const s of gaiaSources) items.push({ key: `gaia:${s.source_id}`, kind: 'gaia', raw: s });
    for (const s of wiseSources) items.push({ key: `wise:${s.source_id}`, kind: 'wise', raw: s });
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
      addRow('Catálogo', 'Gaia DR3 (ESA TAP)');
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
    ra.value = wrap(Number(item.raw.ra.toFixed(6))).toFixed(6);
    dec.value = item.raw.dec.toFixed(6);
    ra.dispatchEvent(new Event('input', { bubbles: true }));
    dec.dispatchEvent(new Event('input', { bubbles: true }));
    const label = item.kind === 'gaia' ? `Gaia DR3 ${item.raw.source_id}` : `AllWISE ${item.raw.source_id}`;
    status.textContent = `Coordenadas actualizadas desde ${label}. Pulsa Buscar en IRSA; la búsqueda no se inicia automáticamente.`;
    draw();
  }

  function selectSourceByKey(key, { copyCoords = false } = {}) {
    selectedKey = key || '';
    if (sourceSelect && sourceSelect.value !== selectedKey) sourceSelect.value = selectedKey;
    renderSourceDetail();
    const item = allCatalogItems().find(x => x.key === selectedKey);
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
      if (Math.hypot(sx - cx, sy - cy) > r + 4) continue;
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

    ctx.strokeStyle = 'rgba(141,206,241,.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();
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
      parts.push(`Gaia DR3 (${gaiaMeta.reference_epoch || 'J2016.0'}): ${gaiaSources.length} fuentes reales${gaiaMeta.truncated ? ' (posible truncamiento)' : ''}${matchesCatalogQuery(gaiaMeta) ? '' : ' · CONSULTA ANTERIOR: fuentes ocultas hasta volver al campo consultado'}`);
    }
    if (wiseMeta) {
      parts.push(`AllWISE: ${wiseSources.length} fuentes reales${wiseMeta.truncated ? ' (posible truncamiento)' : ''}${matchesCatalogQuery(wiseMeta) ? '' : ' · CONSULTA ANTERIOR: fuentes ocultas hasta volver al campo consultado'} · asociación candidata no confirmada`);
    }
    if (!parts.length) {
      catalogStatus.textContent = 'Sin catálogos cargados · consulta Gaia DR3 o AllWISE para representar direcciones reales sobre la esfera.';
      return;
    }
    catalogStatus.textContent = `${parts.join(' | ')}. Representación direccional sin distancias físicas.`;
  }

  async function loadCatalog(kind) {
    if (offline?.checked) {
      abortCatalogRequests();
      if (catalogStatus) catalogStatus.textContent = 'DEMO OFFLINE · Consultas a Gaia DR3 y AllWISE desactivadas.';
      return;
    }
    const p = coords(), rr = validRadius();
    if (!p || rr === null) {
      if (catalogStatus) catalogStatus.textContent = 'Coordenadas o radio no válidos: RA [0, 360), Dec [−90, 90], radio (0, 0.25] grados.';
      return;
    }
    const isGaia = kind === 'gaia';
    if (isGaia && gaiaController) gaiaController.abort();
    if (!isGaia && wiseController) wiseController.abort();
    const controller = new AbortController();
    if (isGaia) { gaiaController = controller; if (gaiaBtn) gaiaBtn.disabled = true; }
    else { wiseController = controller; if (wiseBtn) wiseBtn.disabled = true; }
    if (catalogStatus) catalogStatus.textContent = isGaia ? 'Consultando Gaia DR3 en ESA TAP…' : 'Consultando AllWISE en NASA/IPAC IRSA TAP…';

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
    input.addEventListener('input', () => { abortCatalogRequests(); updateCatalogSummary(); draw(); });
    input.addEventListener('change', () => { abortCatalogRequests(); updateCatalogSummary(); draw(); });
  }
  grid.addEventListener('change', draw);
  document.querySelector('#cosmic-center').addEventListener('click', center);
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => { sphereZoom = Math.min(250, Math.round(sphereZoom * 1.6 * 10) / 10); draw(); });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { sphereZoom = Math.max(1, Math.round((sphereZoom / 1.6) * 10) / 10); draw(); });
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => { sphereZoom = 1; draw(); });
  if (gaiaBtn) gaiaBtn.addEventListener('click', () => loadCatalog('gaia'));
  if (wiseBtn) wiseBtn.addEventListener('click', () => loadCatalog('wise'));
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      abortCatalogRequests();
      gaiaSources = []; wiseSources = []; gaiaMeta = null; wiseMeta = null; selectedKey = '';
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
        gaiaSources = []; wiseSources = []; gaiaMeta = null; wiseMeta = null; selectedKey = '';
        populateSourceSelect();
        if (catalogStatus) catalogStatus.textContent = 'DEMO OFFLINE · Consultas a Gaia DR3 y AllWISE desactivadas.';
        draw();
      } else {
        updateCatalogSummary();
      }
    });
  }

  document.querySelector('#cosmic-search').addEventListener('click', () => {
    if (!coords()) {
      status.textContent = 'Introduce coordenadas RA/Dec válidas antes de buscar.';
      return;
    }
    document.querySelector('#real-search').requestSubmit();
    document.querySelector('#real-title').scrollIntoView({ block: 'start' });
  });

  stage.addEventListener('keydown', event => {
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
    if (Math.hypot(mx - cx, my - cy) > r) {
      status.textContent = 'Selecciona un punto dentro de la esfera.';
      return;
    }
    const p = unprojectEquatorial((mx - cx) / (r * sphereZoom), -(my - cy) / (r * sphereZoom), viewRa, viewDec);
    if (p) selected(p);
    else status.textContent = 'Selecciona un punto dentro de la esfera.';
  });

  for (const type of ['pointercancel', 'lostpointercapture']) stage.addEventListener(type, () => { drag = null; });
  if ('ResizeObserver' in window) new ResizeObserver(draw).observe(stage);
  else window.addEventListener('resize', draw);
  populateSourceSelect();
  center();
}
