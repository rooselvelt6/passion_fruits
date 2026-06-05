/* ======================== LÍNEA DE PRODUCCIÓN 3D v3 ======================== */

const STATIONS = [
  { name: 'Recepción', icon: '\u{1F96D}', desc: 'Las parchitas llegan frescas desde el campo',
    detail: 'Seleccionadas a mano, listas para procesar', x: -24, color: 0x8BC34A },
  { name: 'Lavado', icon: '\u{1F6BF}', desc: 'Lavado y centrifugado',
    detail: 'La cáscara se valoriza como subproducto', x: -12, color: 0x42A5F5 },
  { name: 'Cocción', icon: '\u{1F372}', desc: 'Cocción lenta con azúcar y pectina',
    detail: 'El sirope adquiere textura y sabor', x: 0, color: 0xFF7043 },
  { name: 'Envasado', icon: '\u{1F9F4}', desc: 'Llenado y etiquetado',
    detail: 'Producto sellado al vacío', x: 12, color: 0xAB47BC },
  { name: 'Supermercado', icon: '\u{1F3EA}', desc: 'Producto listo para la venta',
    detail: 'Precio competitivo', x: 24, color: 0xEC407A }
];

let prodScene, prodCamera, prodRenderer, prodControls;
let stationGroups = [], clickables = [], allPickable = [];
let currentStation = 0, isPlaying = false, playSpeed = 1, playTimer = null;
let prodInitialized = false, prodAnimId = null;
let prodLoteCount = 0, stationData = {};
let prodBottleGroups = [];
let sandboxMode = false;

// Interaction
let grabbedObject = null, grabOffset = new THREE.Vector3();
let grabPlane = new THREE.Plane(), grabMouse = new THREE.Vector2();
let hoveredObject = null;
let grabWorldPos = new THREE.Vector3();

const stationState = {
  0: { quality: 80 },
  1: { speed: 50, temperature: 25 },
  2: { temperature: 75, viscosity: 60 },
  3: { fillSpeed: 50 },
  4: { price: 4.50 }
};

const OBJECT_DATA = {
  reception: {
    fruit: { name: 'Parchita', icon: '\u{1F965}', desc: 'Fruta tropical amarilla. Variedad Passiflora edulis flavicarpa.',
      props: { Peso: '70g', 'Variedad': 'Flavicarpa', Origen: 'Venezuela' } },
    basket: { name: 'Cesta', icon: '\u{1F9FA}', desc: 'Cesta artesanal para transporte de frutas.',
      props: { Capacidad: '5kg', Material: 'Mimbre' } },
    table: { name: 'Mesa de trabajo', icon: '\u{1F6A7}', desc: 'Superficie de acero inoxidable.',
      props: { Material: 'Acero inox.', 'Dimensiones': '1.2m x 0.6m' } }
  },
  washing: {
    drum: { name: 'Tambor lavador', icon: '\u{1F6BF}', desc: 'Tambor centrifugado de acero inoxidable.',
      props: { Velocidad: '300-1200 RPM', Capacidad: '15kg' } },
    water: { name: 'Agua de lavado', icon: '\u{1F4A7}', desc: 'Agua filtrada a temperatura controlada.',
      props: { Temperatura: '25\u00B0C', pH: '7.0' } },
    washFruit: { name: 'Parchita en lavado', icon: '\u{1F965}', desc: 'Parchitas girando dentro del tambor.',
      props: { Cantidad: '~12 unidades', Estado: 'En proceso' } }
  },
  cooking: {
    pot: { name: 'Olla de cocción', icon: '\u{1F373}', desc: 'Olla de acero inoxidable con fondo grueso.',
      props: { Capacidad: '30L', Material: 'Acero inox.' } },
    liquid: { name: 'Sirope de parchita', icon: '\u{1F9C4}', desc: 'Mezcla en proceso de cocción.',
      props: { Temperatura: '85\u00B0C', Viscosidad: 'Alta' } },
    fire: { name: 'Fuego', icon: '\u{1F525}', desc: 'Quemador de gas regulable.',
      props: { Intensidad: 'Media', Temperatura: '180\u00B0C' } }
  },
  packaging: {
    bottle: { name: 'Botella', icon: '\u{1F9F4}', desc: 'Botella de vidrio para sirope.',
      props: { Capacidad: '500ml', Material: 'Vidrio' } },
    nozzle: { name: 'Boquilla llenadora', icon: '\u{1F4A7}', desc: 'Boquilla de llenado preciso.',
      props: { Caudal: '100ml/s', Precisión: '\u00B11ml' } }
  },
  supermarket: {
    shelfBottle: { name: 'Botella en estante', icon: '\u{1F9F4}', desc: 'Producto final listo para la venta.',
      props: { Precio: '$4.50', Contenido: '500ml' } },
    shelf: { name: 'Estante', icon: '\u{1F6CD}', desc: 'Estante metálico de exhibición.',
      props: { Capacidad: '24 botellas', Material: 'Metal' } },
    priceSign: { name: 'Cartel de precio', icon: '\u{1F4B0}', desc: 'Precio y promociones.',
      props: { Precio: '$4.50' } }
  }
};

/* ======================== SCENE SETUP ======================== */

function getProdData() {
  let kg = 2, lotes = 1, costo = 12.50, rend = 2.5;
  if (typeof state !== 'undefined' && state) {
    kg = state.ingredientes?.parchita?.kg || kg;
    lotes = (state.historial?.length || 0) + 1;
    if (typeof getCalculos === 'function') {
      try { const c = getCalculos(); costo = c.totalCostosFijos || costo; rend = c.rendimientoBruto || rend; } catch(e) {}
    }
  }
  return { kg, lotes, costo, rend };
}

function initProduccion3D(forceRebuild) {
  if (prodInitialized && !forceRebuild) {
    if (prodRenderer && prodRenderer.domElement && prodRenderer.domElement.parentElement) {
      updateProdStats(); updateStationInfo(currentStation); return;
    }
  }
  if (typeof THREE === 'undefined') return;
  const container = document.getElementById('prod-3d-canvas');
  if (!container) return;

  const data = getProdData();
  prodLoteCount = data.lotes;
  stationData = data;
  const w = container.clientWidth || 700, h = container.clientHeight || 440;

  prodScene = new THREE.Scene();

  prodCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  prodCamera.position.set(STATIONS[0].x + 6, 3, 8);
  prodCamera.lookAt(STATIONS[0].x, 1.5, 0);

  prodRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  prodRenderer.setSize(w, h);
  prodRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  prodRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  prodRenderer.toneMappingExposure = 1.2;
  prodRenderer.shadowMap.enabled = true;
  prodRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(prodRenderer.domElement);

  prodControls = new THREE.OrbitControls(prodCamera, prodRenderer.domElement);
  prodControls.enableDamping = true;
  prodControls.dampingFactor = 0.08;
  prodControls.minDistance = 3;
  prodControls.maxDistance = 20;
  prodControls.target.set(0, 1.5, 0);

  const ambient = new THREE.AmbientLight(0x8899bb, 0.4);
  prodScene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffeedd, 1.5);
  dir.position.set(8, 15, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 1024;
  dir.shadow.mapSize.height = 1024;
  const d = 15;
  dir.shadow.camera.left = -d;
  dir.shadow.camera.right = d;
  dir.shadow.camera.top = d;
  dir.shadow.camera.bottom = -d;
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 30;
  prodScene.add(dir);

  const fill = new THREE.DirectionalLight(0xffcc99, 0.4);
  fill.position.set(-5, 3, -5);
  prodScene.add(fill);
  const rim = new THREE.DirectionalLight(0x88ccff, 0.3);
  rim.position.set(0, 2, -8);
  prodScene.add(rim);

  buildAllStations();
  buildFloor();
  updateTimeline(0);
  updateStationInfo(0);
  updateProdStats();
  prodInitialized = true;
  installProdMouseHandlers();
  animateProduction();
}

/* ======================== STATION BUILDERS ======================== */

function buildAllStations() {
  clickables = []; allPickable = [];
  STATIONS.forEach((st, i) => {
    const group = new THREE.Group();
    group.position.x = st.x;
    buildStation(group, i);
    prodScene.add(group);
    stationGroups[i] = group;
    const zone = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 7),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    zone.position.set(st.x, 2, 0);
    zone.userData.stationIndex = i;
    zone.userData.pickable = true;
    zone.userData.objectKey = null;
    prodScene.add(zone);
    clickables.push(zone);
  });
}

function markPickable(obj, stationIdx, objectKey) {
  obj.userData.pickable = true;
  obj.userData.stationIndex = stationIdx;
  obj.userData.objectKey = objectKey;
  allPickable.push(obj);
}

function buildStation(group, index) {
  switch (index) {
    case 0: buildReception(group, index); break;
    case 1: buildWashing(group, index); break;
    case 2: buildCooking(group, index); break;
    case 3: buildPackaging(group, index); break;
    case 4: buildSupermarket(group, index); break;
  }
}

/* ======================== RECEPCIÓN ======================== */

function buildReception(group, idx) {
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xA67B5B, roughness: 0.85, metalness: 0 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x78909C, roughness: 0.3, metalness: 0.7 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 2.8), woodMat);
  top.position.y = 0.86;
  top.castShadow = true; top.receiveShadow = true;
  markPickable(top, idx, 'table');
  group.add(top);

  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.76, 8), metalMat);
    leg.position.set(-1.7 + (i % 2) * 3.4, 0.42, -1.1 + Math.floor(i / 2) * 2.2);
    leg.castShadow = true;
    group.add(leg);
  }

  const basketMat = new THREE.MeshStandardMaterial({ color: 0xBCAAA4, roughness: 0.9, metalness: 0 });
  const basketGroup = new THREE.Group();
  basketGroup.position.set(-0.6, 1.0, -0.4);
  for (let j = 0; j < 4; j++) {
    const r = 0.85 - j * 0.08;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 16), basketMat);
    ring.position.y = j * 0.18;
    ring.rotation.x = Math.PI / 2;
    basketGroup.add(ring);
  }
  const basketFloor = new THREE.Mesh(new THREE.CircleGeometry(0.65, 12), basketMat);
  basketFloor.rotation.x = -Math.PI / 2;
  basketFloor.position.y = 0.02;
  basketGroup.add(basketFloor);
  markPickable(basketGroup, idx, 'basket');
  group.add(basketGroup);

  for (let i = 0; i < 6; i++) {
    const f = buildParchitaFruit(0.17 + Math.random() * 0.03);
    const angle = Math.random() * Math.PI * 2;
    const rad = 0.2 + Math.random() * 0.5;
    f.position.set(-0.6 + Math.cos(angle) * rad, 1.2 + Math.random() * 0.3, -0.4 + Math.sin(angle) * rad);
    f.userData.idleAmp = 0.002 + Math.random() * 0.003;
    f.userData.idleSpeed = 0.8 + Math.random() * 0.6;
    f.userData.idleOffset = Math.random() * 100;
    markPickable(f, idx, 'fruit');
    group.add(f);
  }
  for (let i = 0; i < 3; i++) {
    const f = buildParchitaFruit(0.18);
    f.position.set(0.6 + Math.random() * 0.8, 0.95, -0.3 + Math.random() * 0.6);
    f.userData.idleAmp = 0.002 + Math.random() * 0.003;
    f.userData.idleSpeed = 0.8 + Math.random() * 0.6;
    f.userData.idleOffset = Math.random() * 100;
    markPickable(f, idx, 'fruit');
    group.add(f);
  }

  const signCanvas = makeTextCanvas('RECEPCIÓN', '#5D4037', '#FFF3E0');
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, transparent: true });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.35), signMat);
  sign.position.set(0, 2.0, 1.45);
  group.add(sign);
}

function buildParchitaFruit(scale) {
  const s = scale || 0.2;
  const g = new THREE.Group();

  const geo = new THREE.SphereGeometry(s, 10, 10);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xE8A137, roughness: 0.7, emissive: 0xF5B342, emissiveIntensity: 0.05
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(1, 0.85, 0.92);
  mesh.castShadow = true;
  g.add(mesh);

  const mat2 = new THREE.MeshStandardMaterial({ color: 0x7B3FAF, roughness: 0.6 });
  const spot = new THREE.Mesh(new THREE.SphereGeometry(s * 0.15, 6, 6), mat2);
  spot.position.set(0, s * 0.6, s * 0.5);
  g.add(spot);

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.9 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, s * 0.2, 4), stemMat);
  stem.position.set(0, s * 0.8, 0);
  g.add(stem);

  g.userData.isFruit = true;
  return g;
}

function makeTextCanvas(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 80;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg || '#333';
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 80, 12);
  ctx.fill();
  ctx.fillStyle = fg || '#FFF';
  ctx.font = 'bold 32px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 42);
  return c;
}

/* ======================== LAVADO ======================== */

function buildWashing(group, idx) {
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, roughness: 0.2, metalness: 0.8 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x78909C, roughness: 0.3, metalness: 0.6 });

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 1.8, 24), metalMat);
  drum.position.y = 1.3;
  drum.castShadow = true;
  drum.userData.isDrum = true;
  markPickable(drum, idx, 'drum');
  group.add(drum);

  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.03, 8, 24), darkMetal);
    ring.position.y = 0.6 + i * 0.6;
    ring.rotation.x = Math.PI / 2;
    ring.userData.isDrumRing = true;
    group.add(ring);
  }

  const innerDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.2, 1.6, 20),
    new THREE.MeshPhysicalMaterial({ color: 0x90A4AE, transparent: true, opacity: 0.15, roughness: 0.1, metalness: 0.5 })
  );
  innerDrum.position.y = 1.3;
  group.add(innerDrum);

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x4FC3F7, transparent: true, opacity: 0.3, roughness: 0, metalness: 0,
    envMapIntensity: 0.5
  });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 0.5, 20), waterMat);
  water.position.y = 1.0;
  water.userData.isWater = true;
  markPickable(water, idx, 'water');
  group.add(water);

  for (let i = 0; i < 5; i++) {
    const f = buildParchitaFruit(0.16);
    const a = (i / 5) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.5, 1.0 + Math.random() * 0.2, Math.sin(a) * 0.5);
    f.userData.isWashFruit = true;
    f.userData.orbitAngle = a;
    f.userData.orbitRadius = 0.5;
    f.userData.orbitSpeed = 0.3 + Math.random() * 0.2;
    f.userData.bobAmp = 0.03 + Math.random() * 0.03;
    markPickable(f, idx, 'washFruit');
    group.add(f);
  }

  const standMat = new THREE.MeshStandardMaterial({ color: 0x607D8B, roughness: 0.5, metalness: 0.3 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 2.6), standMat);
  stand.position.y = 0.4;
  stand.receiveShadow = true;
  group.add(stand);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x546E7A, roughness: 0.4, metalness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 6), legMat);
    l.position.set(-1.0 + (i % 2) * 2, 0.2, -1.0 + Math.floor(i / 2) * 2);
    group.add(l);
  }

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.3),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(makeTextCanvas('LAVADO', '#1565C0', '#E3F2FD')),
      side: THREE.DoubleSide, transparent: true
    }));
  sign.position.set(0, 2.6, 0);
  group.add(sign);
}

/* ======================== COCCIÓN ======================== */

function buildCooking(group, idx) {
  const potMat = new THREE.MeshStandardMaterial({ color: 0x455A64, roughness: 0.3, metalness: 0.7 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.35, 1.6, 24), potMat);
  pot.position.y = 1.1;
  pot.castShadow = true;
  markPickable(pot, idx, 'pot');
  group.add(pot);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0x37474F, roughness: 0.2, metalness: 0.8 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.05, 8, 24), rimMat);
  rim.position.y = 1.92;
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  for (let side = -1; side <= 1; side += 2) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.8 }));
    handle.position.set(side * 1.55, 1.3, 0);
    handle.rotation.y = Math.PI / 2;
    group.add(handle);
  }

  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: 0xFF8A65, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0,
    envMapIntensity: 0.3
  });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.25, 0.45, 20), liquidMat);
  liquid.position.y = 0.35;
  liquid.userData.isLiquid = true;
  markPickable(liquid, idx, 'liquid');
  group.add(liquid);

  const fireGroup = new THREE.Group();
  fireGroup.position.y = 0.05;
  fireGroup.userData.isFireGroup = true;
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.15 + Math.random() * 0.1, 0.2 + Math.random() * 0.15, 6),
      new THREE.MeshBasicMaterial({ color: 0xFF6F00, transparent: true, opacity: 0.5 }));
    f.position.set((Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4);
    f.userData.isFire = true;
    f.userData.speed = 2 + Math.random() * 2;
    f.userData.phase = Math.random() * 100;
    f.userData.baseScale = 0.8 + Math.random() * 0.4;
    fireGroup.add(f);
  }
  markPickable(fireGroup, idx, 'fire');
  group.add(fireGroup);

  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.25 });
  for (let i = 0; i < 15; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.05, 6, 6), bubbleMat);
    b.position.set((Math.random() - 0.5) * 1.1, Math.random() * 0.4 + 0.3, (Math.random() - 0.5) * 1.1);
    b.userData.isBubble = true;
    b.userData.speed = 0.2 + Math.random() * 0.4;
    b.userData.wobble = Math.random() * 0.002;
    b.userData.offset = Math.random() * 200;
    group.add(b);
  }

  const steamMat = new THREE.MeshBasicMaterial({ color: 0xE0E0E0, transparent: true, opacity: 0.1 });
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.08, 6, 6), steamMat);
    s.position.set((Math.random() - 0.5) * 0.9, 1.6 + Math.random() * 0.5, (Math.random() - 0.5) * 0.9);
    s.userData.isSteam = true;
    s.userData.speed = 0.15 + Math.random() * 0.3;
    s.userData.drift = (Math.random() - 0.5) * 0.001;
    s.userData.offset = Math.random() * 300;
    group.add(s);
  }

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x37474F, roughness: 0.7 }));
  base.position.y = 0.1;
  base.receiveShadow = true;
  group.add(base);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.3),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(makeTextCanvas('COCCIÓN', '#BF360C', '#FBE9E7')),
      side: THREE.DoubleSide, transparent: true
    }));
  sign.position.set(0, 2.4, 0);
  group.add(sign);
}

/* ======================== ENVASADO ======================== */

function buildPackaging(group, idx) {
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x546E7A, roughness: 0.7 });
  const belt = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.1, 1.2), beltMat);
  belt.position.set(0, 0.25, 0);
  belt.receiveShadow = true;
  markPickable(belt, idx, 'belt');
  group.add(belt);

  const rollerMat = new THREE.MeshStandardMaterial({ color: 0x78909C, roughness: 0.3, metalness: 0.5 });
  for (let i = -2; i <= 2; i++) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), rollerMat);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(i * 1.1, 0.3, 0);
    roller.userData.isRoller = true;
    group.add(roller);
  }

  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x78909C, metalness: 0.8, roughness: 0.2 });
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.4, 8), nozzleMat);
  nozzle.position.set(-0.6, 1.2, 0);
  nozzle.userData.isNozzle = true;
  markPickable(nozzle, idx, 'nozzle');
  group.add(nozzle);

  const nozzleTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), nozzleMat);
  nozzleTip.position.set(-0.6, 1.0, 0);
  nozzleTip.userData.isNozzleTip = true;
  group.add(nozzleTip);

  const tankMat = new THREE.MeshStandardMaterial({ color: 0x78909C, metalness: 0.6, roughness: 0.3 });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.7, 12), tankMat);
  tank.position.set(-1.4, 1.5, 0);
  markPickable(tank, idx, 'tank');
  group.add(tank);

  const liquidTank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.5, 12),
    new THREE.MeshPhysicalMaterial({ color: 0xFF8A65, transparent: true, opacity: 0.5, roughness: 0.1 }));
  liquidTank.position.set(-1.4, 1.35, 0);
  liquidTank.userData.isTankLiquid = true;
  group.add(liquidTank);

  buildPackagingBottles(group, idx);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.3),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(makeTextCanvas('ENVASADO', '#6A1B9A', '#F3E5F5')),
      side: THREE.DoubleSide, transparent: true
    }));
  sign.position.set(0, 2.2, 0.7);
  group.add(sign);
}

function buildPackagingBottles(group, idx) {
  const toRemove = [];
  group.children.forEach(c => { if (c.userData.stationType === 'packaging') toRemove.push(c); });
  toRemove.forEach(c => group.remove(c));
  for (let i = 0; i < 3; i++) {
    const bg = buildBottleForProd(0.3);
    bg.position.set(-1.2 + i * 1.2, 0.3, 0);
    bg.userData.isBottle = true;
    bg.userData.bottleIndex = i;
    bg.userData.stationType = 'packaging';
    bg.userData.stationIndex = idx;
    bg.userData.objectKey = 'bottle';
    bg.userData.pickable = true;
    allPickable.push(bg);
    group.add(bg);
    prodBottleGroups.push(bg);
  }
}

/* ======================== SUPERMERCADO ======================== */

function buildSupermarket(group, idx) {
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x78909C, roughness: 0.4, metalness: 0.3 });
  const shelfBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.8), shelfMat);
  shelfBase.position.set(0, 0.3, 0);
  shelfBase.receiveShadow = true;
  markPickable(shelfBase, idx, 'shelf');
  group.add(shelfBase);

  const boardMat = new THREE.MeshStandardMaterial({ color: 0x90A4AE, roughness: 0.3, metalness: 0.2 });
  for (let level = 0; level < 2; level++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.05, 1.7), boardMat);
    board.position.set(0, 0.7 + level * 0.9, 0);
    group.add(board);
  }

  const uprightMat = new THREE.MeshStandardMaterial({ color: 0x607D8B, roughness: 0.4, metalness: 0.5 });
  for (let side = -1; side <= 1; side += 2) {
    for (let d = -1; d <= 1; d += 2) {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.06), uprightMat);
      upright.position.set(side * 2.05, 1.2, d * 0.85);
      group.add(upright);
    }
  }

  buildSupermarketBottles(group, idx);

  const priceMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
  const priceSign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.04), priceMat);
  priceSign.position.set(0, 2.2, 0.95);
  markPickable(priceSign, idx, 'priceSign');
  group.add(priceSign);

  const priceCanvas = document.createElement('canvas');
  priceCanvas.width = 280; priceCanvas.height = 100;
  const ctx = priceCanvas.getContext('2d');
  ctx.fillStyle = '#FFF8E1';
  ctx.beginPath(); ctx.roundRect(0, 0, 280, 100, 8); ctx.fill();
  ctx.fillStyle = '#E8A137'; ctx.font = 'bold 18px Outfit'; ctx.textAlign = 'center';
  ctx.fillText('SIROPE DE PARCHITA', 140, 32);
  ctx.fillStyle = '#333'; ctx.font = 'bold 28px Outfit';
  ctx.fillText('$4.50', 140, 75);
  const priceTex = new THREE.CanvasTexture(priceCanvas);
  const psMat = new THREE.MeshBasicMaterial({ map: priceTex, side: THREE.DoubleSide });
  const psMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.48), psMat);
  psMesh.position.copy(priceSign.position);
  psMesh.position.z += 0.03;
  group.add(psMesh);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(makeTextCanvas('SUPERMERCADO', '#AD1457', '#FCE4EC')),
      side: THREE.DoubleSide, transparent: true
    }));
  sign.position.set(0, 2.8, 0);
  group.add(sign);
}

function buildSupermarketBottles(group, idx) {
  const toRemove = [];
  group.children.forEach(c => { if (c.userData.stationType === 'supermarket') toRemove.push(c); });
  toRemove.forEach(c => group.remove(c));
  for (let i = 0; i < 6; i++) {
    const bg = buildBottleForProd(0.3);
    const col = (i % 3) - 1;
    const row = Math.floor(i / 3);
    bg.position.set(col * 1.0, 0.5 + row * 0.9, 0.3 * (i % 2 === 0 ? 1 : -1));
    bg.userData.isShelfBottle = true;
    bg.userData.stationType = 'supermarket';
    bg.userData.stationIndex = idx;
    bg.userData.objectKey = 'shelfBottle';
    bg.userData.pickable = true;
    allPickable.push(bg);
    group.add(bg);
    prodBottleGroups.push(bg);
  }
}

/* ======================== BOTELLA ======================== */

function buildBottleForProd(scale) {
  const g = new THREE.Group();
  const s = scale || 0.3, h = 2.5 * s, r = 0.4 * s;
  const profile = [
    new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.9, 0),
    new THREE.Vector2(r, 0.02), new THREE.Vector2(r, h * 0.65),
    new THREE.Vector2(r * 0.8, h * 0.72), new THREE.Vector2(r * 0.5, h * 0.8),
    new THREE.Vector2(r * 0.28, h * 0.87), new THREE.Vector2(r * 0.2, h * 0.93),
    new THREE.Vector2(r * 0.18, h), new THREE.Vector2(r * 0.14, h),
    new THREE.Vector2(r * 0.14, h * 0.94), new THREE.Vector2(0, h * 0.94)
  ];
  const geo = new THREE.LatheGeometry(profile, 14);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xd0e8d8, transparent: true, opacity: 0.25,
    roughness: 0.1, metalness: 0.05, clearcoat: 0.3, envMapIntensity: 0.5
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  g.add(mesh);

  const capMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.6 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.24, h * 0.05, 10), capMat);
  cap.position.y = h;
  g.add(cap);

  const liquidFill = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, h * 0.35, 12),
    new THREE.MeshPhysicalMaterial({ color: 0xFF8A65, transparent: true, opacity: 0.4, roughness: 0.1 }));
  liquidFill.position.y = h * 0.25;
  liquidFill.userData.isBottleLiquid = true;
  liquidFill.userData.targetHeight = h * 0.35;
  g.add(liquidFill);

  const design = window.productionLabelDesign;
  if (design) {
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = design.fondo || '#E8A137';
    ctx.beginPath(); ctx.roundRect(0, 0, 200, 80, 6); ctx.fill();
    ctx.fillStyle = design.texto || '#FFFFFF';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((design.nombre || 'SIROPE').substring(0, 14), 100, 35);
    ctx.font = '10px Outfit, sans-serif';
    ctx.fillStyle = (design.texto || '#FFFFFF') + 'CC';
    ctx.fillText((design.slogan || '').substring(0, 18), 100, 58);
    const tex = new THREE.CanvasTexture(canvas);
    const labelH = h * 0.5, labelY = h * 0.25, labelR = r + 0.01;
    const labelGeo = new THREE.CylinderGeometry(labelR, labelR, labelH, 14, 1, true, -Math.PI * 0.3, Math.PI * 0.6);
    labelGeo.translate(0, labelY, 0);
    g.add(new THREE.Mesh(labelGeo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, depthWrite: false })));
  }
  return g;
}

/* ======================== PISO ======================== */

function buildFloor() {
  const fMat = new THREE.MeshStandardMaterial({ color: 0xCFD8DC, roughness: 0.9, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 18), fMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  prodScene.add(floor);

  STATIONS.forEach((st, i) => {
    const spot = new THREE.Mesh(new THREE.CircleGeometry(2.8, 20),
      new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.06 }));
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(st.x, 0, 0);
    prodScene.add(spot);
  });
}

/* ======================== ANIMATION LOOP ======================== */

function animateProduction() {
  if (!prodRenderer || !prodScene || !prodCamera) return;
  prodAnimId = requestAnimationFrame(animateProduction);
  if (prodControls) prodControls.update();

  const time = Date.now() / 1000;
  const st = stationState;

  stationGroups.forEach((group, i) => {
    if (!group) return;
    group.children.forEach(child => {
      if (child.userData?.isFruit) {
        const amp = child.userData.idleAmp || 0.002;
        const spd = child.userData.idleSpeed || 1;
        const off = child.userData.idleOffset || 0;
        child.position.y += Math.sin(time * spd + off) * amp;
        child.rotation.y += 0.002;
      }
      if (child.userData?.isWashFruit) {
        const spd = (st[1]?.speed || 50) / 100;
        const a = child.userData.orbitAngle + time * 0.4 * spd;
        const rad = child.userData.orbitRadius;
        child.position.x = Math.cos(a) * rad;
        child.position.z = Math.sin(a) * rad;
        child.position.y = 1.0 + Math.sin(time * 1.5 + child.userData.orbitAngle) * (child.userData.bobAmp || 0.03);
        child.rotation.x += 0.01;
        child.rotation.z += 0.005;
      }
      if (child.userData?.isWater) {
        const t = (st[1]?.temperature || 25) / 50;
        child.scale.x = 1 + Math.sin(time * 1.8) * 0.015 * t;
        child.scale.z = 1 + Math.cos(time * 2.1) * 0.015 * t;
        child.material.opacity = 0.2 + 0.15 * t;
      }
      if (child.userData?.isDrum) {
        const spd = (st[1]?.speed || 50) / 100;
        child.rotation.y += 0.008 * spd;
      }
      if (child.userData?.isDrumRing) {
        const spd = (st[1]?.speed || 50) / 100;
        child.rotation.z += 0.003 * spd;
      }
      if (child.userData?.isBubble) {
        const cookTemp = (st[2]?.temperature || 75) / 100;
        const b = child;
        b.position.y += 0.004 * b.userData.speed * cookTemp;
        b.position.x += Math.sin(time * b.userData.speed + b.userData.offset) * b.userData.wobble;
        if (b.position.y > 1.6) b.position.y = 0.3;
        b.material.opacity = 0.1 + 0.25 * cookTemp + Math.sin(time + b.userData.offset) * 0.05;
      }
      if (child.userData?.isSteam) {
        const cookTemp = (st[2]?.temperature || 75) / 100;
        const s = child;
        s.position.y += 0.003 * s.userData.speed * cookTemp;
        s.position.x += Math.sin(time * s.userData.speed * 0.5 + s.userData.offset) * 0.002;
        s.position.z += Math.cos(time * s.userData.speed * 0.3 + s.userData.offset) * 0.001;
        s.scale.setScalar(1 + Math.sin(time + s.userData.offset) * 0.2);
        s.material.opacity = (0.08 + 0.12 * cookTemp) + Math.sin(time * 0.5 + s.userData.offset) * 0.04;
        if (s.position.y > 2.5) s.position.y = 1.6;
      }
      if (child.userData?.isFire) {
        const cookTemp = (st[2]?.temperature || 75) / 100;
        const fs = child.userData.baseScale || 1;
        child.scale.x = fs + Math.sin(time * child.userData.speed + child.userData.phase) * 0.15 * cookTemp;
        child.scale.y = fs + Math.cos(time * child.userData.speed * 0.8 + child.userData.phase) * 0.1 * cookTemp;
        child.material.opacity = 0.2 + 0.5 * cookTemp + Math.sin(time * 3 + child.userData.phase) * 0.15;
        child.position.x += Math.sin(time * 2 + child.userData.phase) * 0.001;
      }
      if (child.userData?.isFireGroup) {
        const cookTemp = (st[2]?.temperature || 75) / 100;
        child.position.y = 0.05 + Math.sin(time * 2) * 0.02 * cookTemp;
      }
      if (child.userData?.isNozzle) {
        const fillSpd = (st[3]?.fillSpeed || 50) / 100;
        child.position.y = 1.2 + Math.sin(time * 1.2 * fillSpd) * 0.06;
      }
      if (child.userData?.isNozzleTip) {
        const fillSpd = (st[3]?.fillSpeed || 50) / 100;
        child.position.y = 1.0 + Math.sin(time * 1.2 * fillSpd + 0.3) * 0.06;
      }
      if (child.userData?.isRoller) {
        child.rotation.x += 0.01;
      }
      if (child.userData?.isBottle && child.userData.bottleIndex !== undefined) {
        child.position.x += Math.sin(time * 0.3 + child.userData.bottleIndex) * 0.0003;
      }
      if (child.userData?.isShelfBottle) {
        child.position.y += Math.sin(time * 0.5 + child.position.x) * 0.0002;
      }
      if (child.userData?.isBottleLiquid) {
        const wave = Math.sin(time * 0.5 + child.parent.position.x) * 0.002;
        child.position.y += wave;
      }
      if (child.userData?.isTankLiquid) {
        child.material.opacity = 0.4 + Math.sin(time * 0.5) * 0.05;
      }
    });
  });

  if (grabbedObject && sandboxMode) {
    const gp = new THREE.Vector3();
    grabbedObject.getWorldPosition(gp);
    const glow = new THREE.Vector3(0.2, 0.2, 0.2);
    grabbedObject.children.forEach(c => {
      if (c.isMesh && c.material && c.material.emissive) {
        c.material.emissive.lerp(new THREE.Color(0x4488ff), 0.05);
        c.material.emissiveIntensity = 0.4;
      }
    });
  }

  prodRenderer.render(prodScene, prodCamera);
}

/* ======================== CAMERA ======================== */

function moveCameraToStation(index) {
  if (index < 0 || index >= STATIONS.length) return;
  currentStation = index;
  const st = STATIONS[index];
  animateCamera(new THREE.Vector3(st.x + 5, 2.5, 6), new THREE.Vector3(st.x, 1.5, 0));
  updateTimeline(index);
  updateStationInfo(index);
}

function animateCamera(targetPos, targetLook) {
  const startPos = prodCamera.position.clone();
  const startTarget = prodControls ? prodControls.target.clone() : new THREE.Vector3(0, 1.5, 0);
  const duration = 600, startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    prodCamera.position.lerpVectors(startPos, targetPos, ease);
    if (prodControls) {
      prodControls.target.lerpVectors(startTarget, targetLook, ease);
      prodControls.update();
    }
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function updateTimeline(index) {
  document.querySelectorAll('.timeline-dot').forEach((dot, i) => dot.classList.toggle('active', i === index));
}

function updateStationInfo(index) {
  const st = STATIONS[index];
  const title = document.getElementById('prod-station-title');
  const desc = document.getElementById('prod-station-desc');
  const data = document.getElementById('prod-station-data');
  if (title) title.textContent = `${st.icon} ${st.name}`;
  if (desc) desc.textContent = st.detail;
  if (data) { const d = getProdData(); data.innerHTML = `\u{1F9EE} ${d.kg}kg parchita · $${d.costo.toFixed(2)} · Lote #${d.lotes}`; }
  const info = document.getElementById('prod-station-info');
  if (info) info.style.display = 'block';
}

function updateProdStats() {
  const d = getProdData();
  document.getElementById('prod-lote-num').textContent = d.lotes;
  document.getElementById('prod-costo').textContent = d.costo.toFixed(2);
  document.getElementById('prod-rendimiento').textContent = d.rend;
}

/* ======================== INTERACTION ======================== */

let highlightTimeout = null;

function highlightObject(obj) {
  clearHighlight();
  if (!obj || !obj.isObject3D) return;
  obj.traverse(c => {
    if (c.isMesh && c.material && !c.material._origEmissive) {
      c.material._origEmissive = c.material.emissive ? c.material.emissive.clone() : new THREE.Color(0);
      c.material._origEmissiveIntensity = c.material.emissiveIntensity || 0;
      if (c.material.emissive) {
        c.material.emissive.setHex(0x66BBFF);
        c.material.emissiveIntensity = 0.5;
      }
    }
  });
}

function clearHighlight() {
  const clear = function(m) {
    if (m._origEmissive) {
      if (m.emissive) m.emissive.copy(m._origEmissive);
      if (m.emissiveIntensity !== undefined) m.emissiveIntensity = m._origEmissiveIntensity;
      delete m._origEmissive; delete m._origEmissiveIntensity;
    }
  };
  if (hoveredObject && hoveredObject !== grabbedObject) {
    hoveredObject.traverse(c => { if (c.isMesh && c.material) clear(c.material); });
  }
  hoveredObject = null;
}

function getObjectKeyFromMesh(obj) {
  if (!obj) return null;
  if (obj.userData?.objectKey) return obj.userData.objectKey;
  if (obj.parent?.userData?.objectKey) return obj.parent.userData.objectKey;
  if (obj.parent?.parent?.userData?.objectKey) return obj.parent.parent.userData.objectKey;
  return null;
}

function getStationIndexFromObj(obj) {
  if (obj.userData?.stationIndex !== undefined) return obj.userData.stationIndex;
  if (obj.parent?.userData?.stationIndex !== undefined) return obj.parent.userData.stationIndex;
  if (obj.parent?.parent?.userData?.stationIndex !== undefined) return obj.parent.parent.userData.stationIndex;
  return null;
}

function getPickableParent(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData?.pickable && cur.userData?.objectKey) return cur;
    if (cur.userData?.stationType) return cur;
    cur = cur.parent;
  }
  return obj;
}

function castProdMouse(e) {
  const canvas = prodRenderer.domElement;
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  return { mouse, rect };
}

function hitTestObjects(mouse) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, prodCamera);
  const meshes = [];
  allPickable.forEach(p => {
    if (p.type === 'Group') p.traverse(c => { if (c.isMesh) meshes.push(c); });
    else if (p.isMesh) meshes.push(p);
  });
  return raycaster.intersectObjects(meshes, false);
}

function getTarget(intersects) {
  for (const hit of intersects) {
    let obj = hit.object;
    let si = getStationIndexFromObj(obj);
    let ok = getObjectKeyFromMesh(obj);
    if (!ok) { const p = obj.parent; if (p?.userData?.objectKey) { ok = p.userData.objectKey; obj = p; } }
    if (si === null && obj.parent?.userData?.stationIndex !== undefined) { si = obj.parent.userData.stationIndex; obj = obj.parent; }
    if (ok && si !== null) return { object: getPickableParent(obj), stationIdx: si, objectKey: ok };
  }
  return null;
}

// ---- GRAB SYSTEM ----

function startGrab(e) {
  if (!sandboxMode || isPlaying || !prodRenderer) return;
  const { mouse } = castProdMouse(e);
  const intersects = hitTestObjects(mouse);
  if (intersects.length === 0) return;
  const target = getTarget(intersects);
  if (!target) return;
  if (!target.object.userData.isFruit && !target.object.userData.isWashFruit &&
      !target.object.userData.isBottle && !target.object.userData.isShelfBottle) return;

  if (grabbedObject) {
    releaseGrab();
    return;
  }

  grabbedObject = target.object;
  if (prodControls) prodControls.enabled = false;
  document.getElementById('prod-3d-container').style.cursor = 'grabbing';

  const wp = new THREE.Vector3();
  grabbedObject.getWorldPosition(wp);
  grabWorldPos.copy(wp);

  const camDir = new THREE.Vector3();
  prodCamera.getWorldDirection(camDir);
  grabPlane.setFromNormalAndCoplanarPoint(camDir, wp);

  const pi = new THREE.Vector3();
  const ray = new THREE.Raycaster().setFromCamera(mouse, prodCamera);
  ray.ray.intersectPlane(grabPlane, pi);
  if (pi) grabOffset.copy(wp).sub(pi);

  clearHighlight();
  document.getElementById('prod-object-panel').style.display = 'none';
}

function moveGrab(e) {
  if (!grabbedObject || !sandboxMode) return;
  const { mouse } = castProdMouse(e);
  const pi = new THREE.Vector3();
  const ray = new THREE.Raycaster().setFromCamera(mouse, prodCamera);
  if (!ray.ray.intersectPlane(grabPlane, pi)) return;

  const targetPos = pi.clone().add(grabOffset);
  targetPos.y = Math.max(0.2, targetPos.y);

  grabbedObject.position.lerp(targetPos, 0.3);

  grabbedObject.rotation.x += (e.movementY || 0) * 0.003;
  grabbedObject.rotation.z += (e.movementX || 0) * 0.003;
}

function releaseGrab() {
  if (!grabbedObject) return;
  grabbedObject.position.y = Math.max(grabbedObject.position.y, 0.3);
  if (prodControls) prodControls.enabled = true;
  document.getElementById('prod-3d-container').style.cursor = sandboxMode ? 'grab' : 'default';
  grabbedObject = null;
}

// ---- HOVER ----
function handleProdMove(e) {
  if (!prodRenderer) return;
  if (grabbedObject) { moveGrab(e); return; }
  if (!sandboxMode || isPlaying) return;
  const { mouse } = castProdMouse(e);
  const intersects = hitTestObjects(mouse);
  const target = intersects.length > 0 ? getTarget(intersects) : null;
  if (target && target.object !== hoveredObject) {
    clearHighlight();
    hoveredObject = target.object;
    highlightObject(hoveredObject);
    document.getElementById('prod-3d-container').style.cursor = 'pointer';
  } else if (!target) {
    clearHighlight();
    document.getElementById('prod-3d-container').style.cursor = 'grab';
  }
}

// ---- CLICK (info panel, only when not grabbing) ----
function handleProdClick(e) {
  if (grabbedObject) { releaseGrab(); return; }
  if (isPlaying || !prodRenderer) return;
  const { mouse } = castProdMouse(e);
  const intersects = hitTestObjects(mouse);
  if (intersects.length === 0) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, prodCamera);
    const zh = raycaster.intersectObjects(clickables);
    if (zh.length > 0) {
      const idx = zh[0].object.userData.stationIndex;
      if (idx !== undefined) { closeProdObjectPanel(); moveCameraToStation(idx); }
    }
    return;
  }
  const target = getTarget(intersects);
  if (target && !isPlaying) {
    highlightObject(target.object);
    showObjectPanel(target.object, target.stationIdx, target.objectKey);
  }
}

function installProdMouseHandlers() {
  const canvas = prodRenderer ? prodRenderer.domElement : null;
  if (!canvas) return;
  canvas.removeEventListener('mousedown', startGrab);
  document.removeEventListener('mousemove', moveGrab);
  document.removeEventListener('mouseup', releaseGrab);
  canvas.removeEventListener('mousemove', handleProdMove);
  canvas.removeEventListener('click', handleProdClick);
  canvas.addEventListener('mousedown', startGrab);
  document.addEventListener('mousemove', moveGrab);
  document.addEventListener('mouseup', releaseGrab);
  canvas.addEventListener('mousemove', handleProdMove);
  canvas.addEventListener('click', handleProdClick);
}

/* ======================== OBJECT PANEL ======================== */

function showObjectPanel(obj, stationIdx, objectKey) {
  const stationName = ['reception', 'washing', 'cooking', 'packaging', 'supermarket'][stationIdx];
  const data = OBJECT_DATA[stationName]?.[objectKey];
  if (!data) return;
  const panel = document.getElementById('prod-object-panel');
  document.getElementById('prod-obj-icon').textContent = data.icon;
  document.getElementById('prod-obj-title').textContent = data.name;
  document.getElementById('prod-obj-station').textContent = STATIONS[stationIdx]?.name || '';
  document.getElementById('prod-obj-desc').textContent = data.desc;
  const pc = document.getElementById('prod-obj-props');
  pc.innerHTML = '';
  Object.entries(data.props).forEach(([k, v]) => {
    const d = document.createElement('div');
    d.className = 'prop-card';
    d.innerHTML = `<span class="prop-label">${k}</span><span class="prop-value">${v}</span>`;
    pc.appendChild(d);
  });
  const cc = document.getElementById('prod-obj-control');
  cc.innerHTML = '';
  addObjectControls(cc, stationIdx, objectKey);
  const ac = document.getElementById('prod-obj-actions');
  ac.innerHTML = '';
  if (sandboxMode) {
    const sk = getSpawnableKey(stationIdx, objectKey);
    if (sk) {
      const btn = document.createElement('button');
      btn.className = 'btn-glass text-xs flex items-center gap-1';
      btn.innerHTML = '<i class="fas fa-plus-circle"></i> Añadir';
      btn.onclick = function() { window.spawnObject(stationIdx, sk); };
      ac.appendChild(btn);
    }
    if (getRemovable(obj)) {
      const btn = document.createElement('button');
      btn.className = 'btn-glass text-xs flex items-center gap-1 text-red-500';
      btn.innerHTML = '<i class="fas fa-trash-alt"></i> Eliminar';
      btn.onclick = function() { window.removeSelectedObject(); };
      ac.appendChild(btn);
    }
  }
  panel.style.display = 'block';
}

function addObjectControls(container, stationIdx, objectKey) {
  const st = stationState[stationIdx];
  if (!st) return;
  switch (stationIdx) {
    case 0:
      if (objectKey === 'fruit') {
        container.innerHTML = `<label class="text-xs text-secondary">Calidad <span id="val-quality">${st.quality}</span>%</label>
          <input type="range" min="10" max="100" value="${st.quality}" oninput="stationState[0].quality=+this.value;document.getElementById('val-quality').textContent=this.value">`;
      }
      break;
    case 1:
      if (objectKey === 'drum' || objectKey === 'washFruit') {
        container.innerHTML = `<label class="text-xs text-secondary">Velocidad <span id="val-wash-speed">${st.speed}</span>%</label>
          <input type="range" min="5" max="100" value="${st.speed}" oninput="stationState[1].speed=+this.value;document.getElementById('val-wash-speed').textContent=this.value">`;
      } else if (objectKey === 'water') {
        container.innerHTML = `<label class="text-xs text-secondary">Temperatura <span id="val-wash-temp">${st.temperature}</span>\u00B0C</label>
          <input type="range" min="5" max="60" value="${st.temperature}" oninput="stationState[1].temperature=+this.value;document.getElementById('val-wash-temp').textContent=this.value">`;
      }
      break;
    case 2:
      if (objectKey === 'fire' || objectKey === 'pot') {
        container.innerHTML = `<label class="text-xs text-secondary">Temperatura <span id="val-cook-temp">${st.temperature}</span>\u00B0C</label>
          <input type="range" min="20" max="120" value="${st.temperature}" oninput="stationState[2].temperature=+this.value;document.getElementById('val-cook-temp').textContent=this.value">`;
      } else if (objectKey === 'liquid') {
        container.innerHTML = `<label class="text-xs text-secondary">Viscosidad <span id="val-viscosity">${st.viscosity}</span>%</label>
          <input type="range" min="10" max="100" value="${st.viscosity}" oninput="stationState[2].viscosity=+this.value;document.getElementById('val-viscosity').textContent=this.value">`;
      }
      break;
    case 3:
      if (objectKey === 'nozzle' || objectKey === 'bottle') {
        container.innerHTML = `<label class="text-xs text-secondary">Velocidad de llenado <span id="val-fill-speed">${st.fillSpeed}</span>%</label>
          <input type="range" min="5" max="100" value="${st.fillSpeed}" oninput="stationState[3].fillSpeed=+this.value;document.getElementById('val-fill-speed').textContent=this.value">`;
      }
      break;
    case 4:
      if (objectKey === 'shelfBottle' || objectKey === 'priceSign') {
        container.innerHTML = `<label class="text-xs text-secondary">Precio $<span id="val-price">${st.price.toFixed(2)}</span></label>
          <input type="range" min="2" max="10" step="0.25" value="${st.price}" oninput="stationState[4].price=+this.value;document.getElementById('val-price').textContent=this.value.toFixed(2)">`;
      }
      break;
  }
}

window.closeProdObjectPanel = function() {
  document.getElementById('prod-object-panel').style.display = 'none';
  clearHighlight();
};

/* ======================== SANDBOX / GAME TOGGLES ======================== */

window.prodSandboxToggle = function() {
  if (window.JUEGO && JUEGO.activo) return;
  sandboxMode = !sandboxMode;
  const btn = document.getElementById('prod-sandbox-btn');
  if (sandboxMode) {
    btn.innerHTML = '<i class="fas fa-hand-paper"></i> Manipular';
    btn.className = 'btn-glass bg-primary text-white font-medium';
    if (prodControls) prodControls.enabled = false;
    document.getElementById('prod-3d-container').style.cursor = 'grab';
  } else {
    btn.innerHTML = '<i class="fas fa-eye"></i> Explorar';
    btn.className = 'btn-glass';
    if (prodControls) prodControls.enabled = true;
    document.getElementById('prod-3d-container').style.cursor = 'default';
    closeProdObjectPanel();
    if (grabbedObject) releaseGrab();
  }
};

window.toggleGameMode = function() {
  if (!window.JUEGO) return;
  if (JUEGO.activo) { salirDelJuego(); }
  else {
    if (sandboxMode) prodSandboxToggle();
    closeProdObjectPanel();
    if (grabbedObject) releaseGrab();
    ocultarVista3D();
    iniciarJuego();
  }
};

function ocultarVista3D() {
  document.getElementById('prod-3d-container').style.display = 'none';
  document.getElementById('prod-object-panel').style.display = 'none';
  document.getElementById('prod-timeline').style.display = 'none';
  document.getElementById('prod-prev-btn').style.display = 'none';
  document.getElementById('prod-next-btn').style.display = 'none';
  document.getElementById('prod-play-btn').style.display = 'none';
  document.getElementById('prod-sandbox-btn').style.display = 'none';
  document.getElementById('prod-speed').style.display = 'none';
  document.getElementById('prod-game-btn').innerHTML = '<i class="fas fa-stop"></i> Terminar juego';
  document.getElementById('game-hud').style.display = 'block';
}

function mostrarVista3D() {
  document.getElementById('prod-3d-container').style.display = '';
  document.getElementById('prod-timeline').style.display = '';
  document.getElementById('prod-prev-btn').style.display = '';
  document.getElementById('prod-next-btn').style.display = '';
  document.getElementById('prod-play-btn').style.display = '';
  document.getElementById('prod-sandbox-btn').style.display = '';
  document.getElementById('prod-speed').style.display = '';
  document.getElementById('game-hud').style.display = 'none';
  document.getElementById('prod-game-btn').innerHTML = '<i class="fas fa-gamepad"></i> Jugar';
  if (prodRenderer) {
    const c = document.getElementById('prod-3d-container');
    prodRenderer.setSize(c.clientWidth || 700, c.clientHeight || 440);
  }
}

/* ======================== SPAWN / REMOVE ======================== */

function getStationGroup(si) { return stationGroups[si]; }

function removeFromPickable(obj) {
  const idx = allPickable.indexOf(obj);
  if (idx !== -1) allPickable.splice(idx, 1);
}

window.spawnObject = function(stationIdx, objectKey) {
  if (isPlaying) return;
  const key = getSpawnableKey(stationIdx, objectKey);
  if (!key) return;
  switch (key) {
    case 'fruit': spawnFruit(stationIdx); break;
    case 'washFruit': spawnWashFruit(stationIdx); break;
    case 'bottle': spawnBottle(stationIdx, 'packaging'); break;
    case 'shelfBottle': spawnBottle(stationIdx, 'supermarket'); break;
  }
};

function spawnFruit(stationIdx) {
  const group = getStationGroup(stationIdx);
  if (!group) return;
  const f = buildParchitaFruit(0.17 + Math.random() * 0.03);
  f.position.set((Math.random() - 0.5) * 2, 1.0 + Math.random() * 0.5, (Math.random() - 0.5) * 1.2);
  f.userData.idleAmp = 0.002 + Math.random() * 0.003;
  f.userData.idleSpeed = 0.8 + Math.random() * 0.6;
  f.userData.idleOffset = Math.random() * 100;
  markPickable(f, stationIdx, 'fruit');
  group.add(f);
}

function spawnWashFruit(stationIdx) {
  const group = getStationGroup(stationIdx);
  if (!group) return;
  const f = buildParchitaFruit(0.15);
  const count = group.children.filter(c => c.userData.isWashFruit).length;
  const a = (count / 8) * Math.PI * 2;
  f.position.set(Math.cos(a) * 0.5, 1.0, Math.sin(a) * 0.5);
  f.userData.isWashFruit = true;
  f.userData.orbitAngle = a;
  f.userData.orbitRadius = 0.5;
  f.userData.orbitSpeed = 0.3 + Math.random() * 0.2;
  f.userData.bobAmp = 0.03;
  markPickable(f, stationIdx, 'washFruit');
  group.add(f);
}

function spawnBottle(stationIdx, type) {
  const group = getStationGroup(stationIdx);
  if (!group) return;
  const bg = buildBottleForProd(0.3);
  bg.position.set((Math.random() - 0.5) * 2.5, 0.4 + Math.random() * 0.3, (Math.random() - 0.5) * 1.0);
  if (type === 'supermarket') {
    bg.userData.isShelfBottle = true;
    bg.userData.stationType = 'supermarket';
    bg.userData.objectKey = 'shelfBottle';
  } else {
    bg.userData.isBottle = true;
    bg.userData.bottleIndex = group.children.filter(c => c.userData.isBottle).length;
    bg.userData.stationType = 'packaging';
    bg.userData.objectKey = 'bottle';
  }
  bg.userData.stationIndex = stationIdx;
  bg.userData.pickable = true;
  allPickable.push(bg);
  group.add(bg);
  prodBottleGroups.push(bg);
}

function getSpawnableKey(stationIdx, objectKey) {
  const map = { 0: { fruit: 'fruit' }, 1: { washFruit: 'washFruit' }, 2: {}, 3: { bottle: 'bottle' }, 4: { shelfBottle: 'shelfBottle' } };
  const keys = Object.keys(map[stationIdx] || {});
  if (keys.includes(objectKey)) return objectKey;
  if (keys.length > 0) return keys[0];
  return null;
}

function getRemovable(obj) {
  if (!obj) return false;
  const key = obj.userData.objectKey;
  return ['fruit', 'leaf', 'washFruit', 'bottle', 'shelfBottle'].includes(key) || obj.userData.isShelfBottle || obj.userData.isBottle;
}

window.removeSelectedObject = function() {
  if (!selectedObject || isPlaying) return;
  const si = selectedObject.userData.stationIndex;
  if (si === undefined || si === null) return;
  const group = getStationGroup(si);
  if (!group || !getRemovable(selectedObject)) return;
  group.remove(selectedObject);
  removeFromPickable(selectedObject);
  closeProdObjectPanel();
};

/* ======================== EXPORTS ======================== */

function rebuildBottles() {
  if (!prodInitialized || !stationGroups[3] || !stationGroups[4]) return;
  prodBottleGroups = [];
  buildPackagingBottles(stationGroups[3], 3);
  buildSupermarketBottles(stationGroups[4], 4);
}

window.prodSiguiente = function() {
  if (isPlaying) return;
  closeProdObjectPanel();
  if (grabbedObject) releaseGrab();
  moveCameraToStation((currentStation + 1) % STATIONS.length);
};

window.prodAnterior = function() {
  if (isPlaying) return;
  closeProdObjectPanel();
  if (grabbedObject) releaseGrab();
  moveCameraToStation((currentStation - 1 + STATIONS.length) % STATIONS.length);
};

window.prodPlayPause = function() {
  const btn = document.getElementById('prod-play-btn');
  if (isPlaying) {
    isPlaying = false;
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    btn.innerHTML = '<i class="fas fa-play"></i> Reproducir';
    btn.className = 'btn-glass bg-secondary text-white font-medium';
    return;
  }
  isPlaying = true;
  btn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
  btn.className = 'btn-glass bg-primary text-white font-medium';
  closeProdObjectPanel();
  prodPlayStep();
};

function prodPlayStep() {
  if (!isPlaying) return;
  moveCameraToStation(currentStation);
  playTimer = setTimeout(() => {
    currentStation = (currentStation + 1) % STATIONS.length;
    if (currentStation === 0) {
      isPlaying = false;
      const btn = document.getElementById('prod-play-btn');
      if (btn) { btn.innerHTML = '<i class="fas fa-play"></i> Reproducir'; btn.className = 'btn-glass bg-secondary text-white font-medium'; }
      return;
    }
    prodPlayStep();
  }, 3000 / playSpeed);
}

window.prodSetSpeed = function(speed) { playSpeed = parseFloat(speed); };

window.prodInit = function(forceRebuild) {
  const data = getProdData();
  prodLoteCount = data.lotes;
  stationData = data;
  setTimeout(() => {
    if (prodInitialized && forceRebuild) { rebuildBottles(); updateProdStats(); updateStationInfo(currentStation); return; }
    initProduccion3D(forceRebuild);
    updateProdStats();
  }, 150);
  if (window.JUEGO && JUEGO.activo) {
    ocultarVista3D();
    document.getElementById('game-hud').style.display = 'block';
    if (JUEGO.resultados) { document.getElementById('juego-resultados').style.display = 'flex'; }
    else { actualizarHUD(); renderizarFase(JUEGO.fase); }
  }
};

window.updateProdData = function() {
  const d = getProdData();
  document.getElementById('prod-lote-num').textContent = d.lotes;
  document.getElementById('prod-costo').textContent = d.costo.toFixed(2);
  document.getElementById('prod-rendimiento').textContent = d.rend;
};
