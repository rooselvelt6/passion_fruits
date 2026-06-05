/* ======================== DISEÑADOR DE ETIQUETAS v2 ======================== */

const DISENO_DEFAULT = {
  nombre: 'Sirope de Parchita',
  slogan: '100% Natural',
  fondo: '#E8A137',
  texto: '#FFFFFF',
  logoDataURL: null,
  tamano: '1000',
  forma: 'classic'
};

let disenoActual = { ...DISENO_DEFAULT };
let bottleScene = null, bottleCamera = null, bottleRenderer = null;
let bottleControls = null, bottleMesh = null, labelMesh = null, capMesh = null;
let logoImage = null;
let bottleInitialized = false;

const BOTTLE_SIZES = {
  '250':  { scale: 0.55, h: 3.0, r: 0.6, labelH: 1.6, labelY: 0.7 },
  '500':  { scale: 0.7,  h: 3.8, r: 0.7, labelH: 1.9, labelY: 0.9 },
  '1000': { scale: 1.0,  h: 4.8, r: 0.85, labelH: 2.3, labelY: 1.2 },
  '2000': { scale: 1.25, h: 5.5, r: 1.0, labelH: 2.6, labelY: 1.4 }
};

const BOTTLE_SHAPES = {
  classic: {
    name: 'Clásica', icon: '\u{1F9F4}',
    profile: (h, r) => [
      [0,0], [r*0.9,0], [r,0.02], [r,h*0.68],
      [r*0.82,h*0.76], [r*0.5,h*0.84], [r*0.28,h*0.9],
      [r*0.2,h*0.95], [r*0.18,h], [r*0.14,h], [r*0.14,h*0.94], [0,h*0.94]
    ]
  },
  slim: {
    name: 'Elegante', icon: '\u{1F3FA}',
    profile: (h, r) => [
      [0,0], [r*0.7,0], [r*0.75,0.02], [r*0.75,h*0.5],
      [r*0.7,h*0.6], [r*0.45,h*0.72], [r*0.25,h*0.82],
      [r*0.15,h*0.9], [r*0.12,h*0.95], [r*0.1,h],
      [r*0.08,h], [r*0.08,h*0.93], [0,h*0.93]
    ]
  },
  square: {
    name: 'Moderna', icon: '\u{1F9CA}',
    profile: (h, r) => [
      [0,0], [r*0.95,0], [r,0.02], [r,h*0.75],
      [r*0.85,h*0.78], [r*0.55,h*0.82], [r*0.25,h*0.88],
      [r*0.2,h*0.95], [r*0.18,h], [r*0.14,h], [r*0.14,h*0.94], [0,h*0.94]
    ]
  },
  flask: {
    name: 'Petaca', icon: '\u{1FAD7}',
    profile: (h, r) => [
      [0,0], [r*1.1,0], [r*1.2,0.02], [r*1.2,h*0.75],
      [r*1.1,h*0.8], [r*0.6,h*0.88], [r*0.35,h*0.94],
      [r*0.3,h], [r*0.25,h], [r*0.25,h*0.94], [0,h*0.94]
    ]
  },
  premium: {
    name: 'Premium', icon: '\u{1F48E}',
    profile: (h, r) => [
      [0,0], [r*0.5,0.01], [r*0.8,0.03], [r,0.06],
      [r,h*0.55], [r*0.85,h*0.65], [r*0.55,h*0.76],
      [r*0.3,h*0.85], [r*0.18,h*0.92], [r*0.14,h],
      [r*0.12,h], [r*0.12,h*0.94], [0,h*0.94]
    ]
  }
};

const SHAPE_HEIGHT_MULT = {
  classic: 1, slim: 1.3, square: 0.95, flask: 0.75, premium: 1.1
};
const SHAPE_RADIUS_MULT = {
  classic: 1, slim: 0.7, square: 1.05, flask: 1.25, premium: 0.9
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath();
}

function adjustBrightness(hex, pct) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (num>>16) + pct));
  const g = Math.min(255, Math.max(0, ((num>>8)&0xFF) + pct));
  const b = Math.min(255, Math.max(0, (num&0xFF) + pct));
  return `#${(r<<16|g<<8|b).toString(16).padStart(6,'0')}`;
}

function hexToRgba(hex, a) {
  const num = parseInt(hex.replace('#',''), 16);
  return `rgba(${num>>16},${(num>>8)&0xFF},${num&0xFF},${a})`;
}

function generateLabelCanvas(design, w, h) {
  w = w || (BOTTLE_SIZES[design.tamano]?.scale <= 0.7 ? 360 : 512);
  h = h || (BOTTLE_SIZES[design.tamano]?.scale <= 0.7 ? 150 : 200);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, w*0.3, h);
  grad.addColorStop(0, adjustBrightness(design.fondo, 15));
  grad.addColorStop(0.5, design.fondo);
  grad.addColorStop(1, adjustBrightness(design.fondo, -20));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.strokeStyle = design.texto;
  ctx.lineWidth = 3.5;
  roundRect(ctx, 9, 9, w-18, h-18, 16);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const innerGrad = ctx.createLinearGradient(0, 0, 0, h);
  innerGrad.addColorStop(0, hexToRgba(design.texto, 0.15));
  innerGrad.addColorStop(0.5, hexToRgba(design.texto, 0.05));
  innerGrad.addColorStop(1, hexToRgba(design.texto, 0.12));
  ctx.fillStyle = innerGrad;
  roundRect(ctx, 14, 14, w-28, h-28, 12);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = hexToRgba(design.texto, 0.2);
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  roundRect(ctx, 22, 22, w-44, h-44, 10);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const midY = h / 2;
  const logoSize = w <= 360 ? 30 : 44;
  const hasLogo = logoImage && logoImage.complete && logoImage.naturalWidth > 0;

  if (hasLogo) {
    const aspect = logoImage.naturalWidth / logoImage.naturalHeight;
    const lw = logoSize * aspect;
    const lh = logoSize;
    ctx.save();
    ctx.beginPath();
    ctx.arc(w/2, midY - (w<=360?26:36), logoSize/2+3, 0, Math.PI*2);
    ctx.fillStyle = hexToRgba(design.texto, 0.1);
    ctx.fill();
    ctx.closePath();
    ctx.beginPath();
    ctx.arc(w/2, midY - (w<=360?26:36), logoSize/2, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(logoImage, w/2 - lw/2, midY - (w<=360?26:36) - lh/2, lw, lh);
    ctx.restore();
  }

  const nSize = w <= 360 ? 18 : 26;
  ctx.save();
  ctx.shadowColor = hexToRgba(design.fondo, 0.4);
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = design.texto;
  ctx.font = `extra bold ${nSize}px Outfit, "Helvetica Neue", sans-serif`;
  ctx.letterSpacing = '2px';
  ctx.fillText(design.nombre.toUpperCase(), w/2, midY + (hasLogo ? (w<=360?10:16) : -4));
  ctx.restore();

  const sSize = w <= 360 ? 10 : 14;
  ctx.fillStyle = hexToRgba(design.texto, 0.85);
  ctx.font = `300 ${sSize}px Outfit, "Helvetica Neue", sans-serif`;
  ctx.letterSpacing = '1px';
  ctx.fillText(design.slogan.toLowerCase(), w/2, midY + (hasLogo ? (w<=360?28:42) : 20));

  ctx.fillStyle = hexToRgba(design.texto, 0.2);
  ctx.font = `${w<=360?6:8}px Outfit, sans-serif`;
  ctx.letterSpacing = '2px';

  ctx.beginPath();
  const lx1 = w*0.25, lx2 = w*0.35;
  ctx.moveTo(lx1, h-14); ctx.lineTo(lx2, h-14);
  ctx.moveTo(w-lx1, h-14); ctx.lineTo(w-lx2, h-14);
  ctx.strokeStyle = hexToRgba(design.texto, 0.3);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillText(`${design.tamano}ml`, w/2, h-14);

  return canvas;
}

function createBottleProfilePoints(h, r, shape) {
  const shapeFn = BOTTLE_SHAPES[shape] || BOTTLE_SHAPES.classic;
  const hm = SHAPE_HEIGHT_MULT[shape] || 1;
  const rm = SHAPE_RADIUS_MULT[shape] || 1;
  const pts = shapeFn.profile(h * hm, r * rm);
  return pts.map(p => new THREE.Vector2(p[0], p[1]));
}

function initBottle3D() {
  if (bottleInitialized) return;
  if (typeof THREE === 'undefined') return;
  const container = document.getElementById('bottle-3d-canvas');
  if (!container) return;

  const w = container.clientWidth || 500;
  const hc = container.clientHeight || 420;

  bottleScene = new THREE.Scene();
  bottleCamera = new THREE.PerspectiveCamera(30, w / hc, 0.1, 50);
  bottleCamera.position.set(3.5, 2.5, 4.5);
  bottleCamera.lookAt(0, 1.5, 0);

  bottleRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  bottleRenderer.setSize(w, hc);
  bottleRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  bottleRenderer.toneMapping = 1;
  bottleRenderer.toneMappingExposure = 1.2;
  container.appendChild(bottleRenderer.domElement);

  bottleControls = new THREE.OrbitControls(bottleCamera, bottleRenderer.domElement);
  bottleControls.enableDamping = true;
  bottleControls.dampingFactor = 0.08;
  bottleControls.minDistance = 2;
  bottleControls.maxDistance = 12;
  bottleControls.target.set(0, 1.5, 0);
  bottleControls.autoRotate = true;
  bottleControls.autoRotateSpeed = 2;

  const ambient = new THREE.AmbientLight(0x404060, 0.5);
  bottleScene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  bottleScene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(4, 6, 5);
  bottleScene.add(dir);
  const fill = new THREE.DirectionalLight(0xffdd99, 0.5);
  fill.position.set(-3, 2, -4);
  bottleScene.add(fill);
  const rim = new THREE.DirectionalLight(0x88ccff, 0.3);
  rim.position.set(0, -3, 6);
  bottleScene.add(rim);

  rebuildBottle();
  bottleInitialized = true;
  animateBottle();
}

function rebuildBottle() {
  if (!bottleScene) return;
  if (bottleMesh) { bottleScene.remove(bottleMesh); bottleMesh = null; }
  if (labelMesh) { bottleScene.remove(labelMesh); labelMesh = null; }
  if (capMesh) { bottleScene.remove(capMesh); capMesh = null; }

  const sizeName = disenoActual.tamano || '1000';
  const size = BOTTLE_SIZES[sizeName] || BOTTLE_SIZES['1000'];
  const s = size.scale;
  const shape = disenoActual.forma || 'classic';
  const h = size.h * s;
  const r = size.r * s;

  const profile = createBottleProfilePoints(h, r, shape);
  const geo = new THREE.LatheGeometry(profile, 36);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xc8e8d0, transparent: true, opacity: 0.2,
    roughness: 0.1, metalness: 0.05, clearcoat: 0.5,
    clearcoatRoughness: 0.2, side: THREE.DoubleSide, ior: 1.5
  });
  bottleMesh = new THREE.Mesh(geo, mat);
  bottleScene.add(bottleMesh);

  const capH = h * 0.045;
  const capR = r * (shape === 'flask' ? 0.35 : 0.22);
  const capGeo = new THREE.CylinderGeometry(capR, capR * 1.1, capH, 12);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x5D4037, roughness: 0.5, metalness: 0.2
  });
  capMesh = new THREE.Mesh(capGeo, capMat);
  const bh = h * (SHAPE_HEIGHT_MULT[shape] || 1);
  capMesh.position.y = bh;
  bottleScene.add(capMesh);

  const labelCanvas = generateLabelCanvas(disenoActual);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.needsUpdate = true;

  const lh = size.labelH * s;
  const ly = size.labelY * s;
  const lr = r + 0.015;

  const labelGeo = new THREE.CylinderGeometry(lr, lr, lh, 20, 1, true, -Math.PI*0.35, Math.PI*0.7);
  labelGeo.translate(0, ly, 0);
  const labelMat2 = new THREE.MeshBasicMaterial({
    map: texture, side: THREE.DoubleSide, transparent: true, depthWrite: false
  });
  labelMesh = new THREE.Mesh(labelGeo, labelMat2);
  bottleScene.add(labelMesh);

  const shadowGeo = new THREE.CircleGeometry(r * 1.8, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.03;
  bottleScene.add(shadow);

  const targetY = bh * 0.45;
  bottleControls.target.set(0, targetY, 0);
  if (!bottleControls.autoRotate) bottleControls.autoRotate = true;

  const previewCanvas = document.getElementById('label-canvas-preview');
  if (previewCanvas) {
    previewCanvas.width = labelCanvas.width;
    previewCanvas.height = labelCanvas.height;
    const pCtx = previewCanvas.getContext('2d');
    pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pCtx.drawImage(labelCanvas, 0, 0);
  }
}

function animateBottle() {
  if (!bottleRenderer || !bottleScene || !bottleCamera) return;
  requestAnimationFrame(animateBottle);
  if (bottleControls) bottleControls.update();
  bottleRenderer.render(bottleScene, bottleCamera);
}

function actualizarVistaPrevia() {
  const nombre = document.getElementById('label-nombre')?.value || disenoActual.nombre;
  const slogan = document.getElementById('label-slogan')?.value || disenoActual.slogan;
  const fondo = document.getElementById('label-fondo')?.value || disenoActual.fondo;
  const texto = document.getElementById('label-texto')?.value || disenoActual.texto;
  document.getElementById('label-fondo-hex').textContent = fondo;
  document.getElementById('label-texto-hex').textContent = texto;
  disenoActual.nombre = nombre;
  disenoActual.slogan = slogan;
  disenoActual.fondo = fondo;
  disenoActual.texto = texto;

  const customChip = document.getElementById('custom-palette-chip');
  const matching = Array.from(document.querySelectorAll('.palette-chip:not(#custom-palette-chip)')).find(
    b => b.dataset.fondo === fondo && b.dataset.texto === texto
  );
  if (matching) {
    customChip.classList.add('hidden');
    customChip.classList.remove('active');
    document.querySelectorAll('.palette-chip').forEach(b => b.classList.remove('active'));
    matching.classList.add('active');
  } else {
    customChip.dataset.fondo = fondo;
    customChip.dataset.texto = texto;
    customChip.querySelector('span:first-child').style.background = fondo;
    customChip.querySelector('span:last-child').style.background = texto;
    customChip.classList.remove('hidden');
    document.querySelectorAll('.palette-chip').forEach(b => b.classList.remove('active'));
    customChip.classList.add('active');
  }

  if (bottleInitialized) rebuildBottle();
}

function aplicarPaleta(btn) {
  const fondo = btn.dataset.fondo;
  const texto = btn.dataset.texto;
  document.getElementById('label-fondo').value = fondo;
  document.getElementById('label-texto').value = texto;
  document.getElementById('label-fondo-hex').textContent = fondo;
  document.getElementById('label-texto-hex').textContent = texto;
  disenoActual.fondo = fondo;
  disenoActual.texto = texto;
  document.querySelectorAll('.palette-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (btn.id !== 'custom-palette-chip') document.getElementById('custom-palette-chip').classList.add('hidden');
  if (bottleInitialized) rebuildBottle();
}

function seleccionarForma(shape, btn) {
  disenoActual.forma = shape;
  document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (bottleInitialized) rebuildBottle();
}

function seleccionarTamaño(size, btn) {
  disenoActual.tamano = size;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (bottleInitialized) rebuildBottle();
}

function cargarLogo(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    disenoActual.logoDataURL = e.target.result;
    logoImage = new Image();
    logoImage.onload = function() {
      const preview = document.getElementById('logo-preview');
      preview.innerHTML = '';
      preview.classList.remove('hidden');
      preview.style.position = 'relative';
      const img = document.createElement('img');
      img.src = disenoActual.logoDataURL;
      preview.appendChild(img);
      const rm = document.createElement('button');
      rm.innerHTML = '\u2715';
      rm.className = 'remove-logo';
      rm.onclick = function() { removerLogo(); };
      preview.appendChild(rm);
      if (bottleInitialized) rebuildBottle();
    };
    logoImage.src = disenoActual.logoDataURL;
  };
  reader.readAsDataURL(file);
}

function removerLogo() {
  disenoActual.logoDataURL = null;
  logoImage = null;
  const preview = document.getElementById('logo-preview');
  preview.innerHTML = '';
  preview.classList.add('hidden');
  document.getElementById('label-logo').value = '';
  if (bottleInitialized) rebuildBottle();
}

function guardarDiseno() {
  try {
    localStorage.setItem('parchita_etiqueta', JSON.stringify(disenoActual));
    const status = document.getElementById('diseno-status');
    if (status) {
      status.innerHTML = '<i class="fas fa-check-circle" style="color:var(--success)"></i> Dise\u00f1o guardado';
      setTimeout(() => { status.innerHTML = ''; }, 3000);
    }
  } catch(e) {
    const status = document.getElementById('diseno-status');
    if (status) status.innerHTML = '<i class="fas fa-exclamation-circle" style="color:var(--danger)"></i> Error al guardar';
  }
}

function cargarDisenoGuardado() {
  try {
    const saved = localStorage.getItem('parchita_etiqueta');
    if (saved) {
      const parsed = JSON.parse(saved);
      disenoActual = { ...DISENO_DEFAULT, ...parsed };
      if (parsed.logoDataURL) {
        logoImage = new Image();
        logoImage.onload = function() { if (bottleInitialized) rebuildBottle(); };
        logoImage.src = parsed.logoDataURL;
      }
      document.getElementById('label-nombre').value = disenoActual.nombre;
      document.getElementById('label-slogan').value = disenoActual.slogan;
      document.getElementById('label-fondo').value = disenoActual.fondo;
      document.getElementById('label-texto').value = disenoActual.texto;
      document.getElementById('label-fondo-hex').textContent = disenoActual.fondo;
      document.getElementById('label-texto-hex').textContent = disenoActual.texto;
      document.querySelectorAll('.size-btn').forEach(b => b.classList.toggle('active', b.dataset.size === disenoActual.tamano));
      document.querySelectorAll('.shape-btn').forEach(b => b.classList.toggle('active', b.dataset.shape === disenoActual.forma));
      const customChip = document.getElementById('custom-palette-chip');
      const matching = Array.from(document.querySelectorAll('.palette-chip:not(#custom-palette-chip)')).find(
        b => b.dataset.fondo === disenoActual.fondo && b.dataset.texto === disenoActual.texto
      );
      document.querySelectorAll('.palette-chip').forEach(b => b.classList.remove('active'));
      if (matching) {
        matching.classList.add('active');
        customChip.classList.add('hidden');
      } else {
        customChip.dataset.fondo = disenoActual.fondo;
        customChip.dataset.texto = disenoActual.texto;
        customChip.querySelector('span:first-child').style.background = disenoActual.fondo;
        customChip.querySelector('span:last-child').style.background = disenoActual.texto;
        customChip.classList.remove('hidden');
        customChip.classList.add('active');
      }
      if (disenoActual.logoDataURL) {
        const preview = document.getElementById('logo-preview');
        preview.classList.remove('hidden');
        preview.innerHTML = '';
        preview.style.position = 'relative';
        const img = document.createElement('img');
        img.src = disenoActual.logoDataURL;
        preview.appendChild(img);
        const rm = document.createElement('button');
        rm.innerHTML = '\u2715';
        rm.className = 'remove-logo';
        rm.onclick = function() { removerLogo(); };
        preview.appendChild(rm);
      }
    }
  } catch(e) {}
}

function exportarSVG() {
  const d = disenoActual;
  const w = 512, h = 200;
  const bg = d.fondo;
  const fg = d.texto;
  const nombre = d.nombre.toUpperCase();
  const slogan = d.slogan.toLowerCase();
  const tam = d.tamano;

  const darker = adjustBrightness(bg, -20).replace('#', '%23');
  const bgGrad = `url(#bgG)`;

  let logoTag = '';
  if (d.logoDataURL) {
    logoTag = `<g transform="translate(256,72)"><circle r="24" fill="${hexToRgba(fg,0.1).replace('#', '%23')}"/>
      <clipPath id="lc"><circle cx="0" cy="0" r="22"/></clipPath>
      <image href="${d.logoDataURL}" x="-22" y="-22" width="44" height="44" clip-path="url(#lc)"/></g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bgG" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${adjustBrightness(bg, 15).replace('#', '%23')}"/>
      <stop offset="50%" stop-color="${bg.replace('#', '%23')}"/>
      <stop offset="100%" stop-color="${darker}"/>
    </linearGradient>
    <filter id="s1"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.25)"/></filter>
    <filter id="s2"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="${hexToRgba(bg,0.3).replace('#', '%23')}"/></filter>
  </defs>
  <rect width="${w}" height="${h}" rx="14" fill="${bgGrad}"/>
  <rect x="9" y="9" width="${w-18}" height="${h-18}" rx="14" fill="none" stroke="${fg.replace('#', '%23')}" stroke-width="3.5" filter="url(#s1)" opacity="0.85"/>
  <rect x="14" y="14" width="${w-28}" height="${h-28}" rx="12" fill="${hexToRgba(fg,0.06).replace('#', '%23')}"/>
  <rect x="22" y="22" width="${w-44}" height="${h-44}" rx="10" fill="none" stroke="${hexToRgba(fg,0.2).replace('#', '%23')}" stroke-width="1" stroke-dasharray="5 4"/>
  ${logoTag}
  <text x="256" y="${d.logoDataURL ? 118 : 100}" text-anchor="middle" font-family="'Outfit','Helvetica Neue',sans-serif" font-weight="800" font-size="26" fill="${fg.replace('#', '%23')}" filter="url(#s2)" letter-spacing="2">${nombre}</text>
  <text x="256" y="${d.logoDataURL ? 148 : 126}" text-anchor="middle" font-family="'Outfit','Helvetica Neue',sans-serif" font-weight="300" font-size="14" fill="${hexToRgba(fg,0.85).replace('#', '%23')}" letter-spacing="1">${slogan}</text>
  <g opacity="0.25">
    <line x1="${w*0.25}" y1="${h-14}" x2="${w*0.35}" y2="${h-14}" stroke="${fg.replace('#', '%23')}" stroke-width="1"/>
    <line x1="${w-w*0.25}" y1="${h-14}" x2="${w-w*0.35}" y2="${h-14}" stroke="${fg.replace('#', '%23')}" stroke-width="1"/>
  </g>
  <text x="256" y="${h-14}" text-anchor="middle" font-family="'Outfit','Helvetica Neue',sans-serif" font-size="8" fill="${hexToRgba(fg,0.25).replace('#', '%23')}" letter-spacing="2">${tam}ml</text>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'etiqueta-parchita.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  const status = document.getElementById('diseno-status');
  if (status) {
    status.innerHTML = '<i class="fas fa-check-circle" style="color:var(--success)"></i> SVG exportado';
    setTimeout(() => { status.innerHTML = ''; }, 3000);
  }
}

function exportarPNG() {
  const canvas = document.getElementById('label-canvas-preview');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'etiqueta-parchita.png';
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  const status = document.getElementById('diseno-status');
  if (status) {
    status.innerHTML = '<i class="fas fa-check-circle" style="color:var(--success)"></i> PNG exportado';
    setTimeout(() => { status.innerHTML = ''; }, 3000);
  }
}

function usarEnProduccion() {
  window.productionLabelDesign = { ...disenoActual };
  document.getElementById('diseno-status').innerHTML = '<i class="fas fa-check-circle" style="color:var(--success)"></i> Etiqueta enviada a producci\u00f3n';
  setTimeout(() => {
    switchTab('produccion');
    if (typeof prodInit === 'function') prodInit(true);
  }, 800);
}

window.initDisenador = function() {
  if (bottleInitialized && bottleRenderer && bottleRenderer.domElement.parentElement) {
    return;
  }
  cargarDisenoGuardado();
  setTimeout(initBottle3D, 150);
};
