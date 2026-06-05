/* ======================== LÍNEA DE PRODUCCIÓN 3D v2 ======================== */

const STATIONS = [
  { name: 'Recepción', icon: '\u{1F96D}', desc: 'Las parchitas llegan frescas desde el campo',
    detail: 'Seleccionadas a mano, listas para procesar', x: -24, color: 0x8BC34A },
  { name: 'Lavado', icon: '\u{1F6BF}', desc: 'Lavado y centrifugado para separar la pulpa',
    detail: 'La cáscara se valoriza como subproducto', x: -12, color: 0x42A5F5 },
  { name: 'Cocción', icon: '\u{1F372}', desc: 'Cocción lenta con azúcar y pectina',
    detail: 'El sirope adquiere textura y sabor', x: 0, color: 0xFF7043 },
  { name: 'Envasado', icon: '\u{1F9F4}', desc: 'Llenado y etiquetado de botellas',
    detail: 'Producto sellado al vacío', x: 12, color: 0xAB47BC },
  { name: 'Supermercado', icon: '\u{1F3EA}', desc: 'Producto listo para la venta',
    detail: 'Precio competitivo, listo para disfrutar', x: 24, color: 0xEC407A }
];

let prodScene = null, prodCamera = null, prodRenderer = null, prodControls = null;
let stationGroups = [], clickables = [], allPickable = [];
let currentStation = 0, isPlaying = false, playSpeed = 1, playTimer = null;
let prodInitialized = false, prodAnimId = null;
let prodLoteCount = 0, prodAnimTime = 0;
let stationData = {};
let prodBottleGroups = [];
let selectedObject = null;
let originalEmissive = null;
let sandboxMode = false;
let isDragging = false;
let dragObject = null;
let dragPlane = new THREE.Plane();
let dragOffset = new THREE.Vector3();
let dragMouse = new THREE.Vector2();
let dragStartPos = new THREE.Vector2();
let dragMoveThreshold = 5;
let dragTarget = null;
let objectCounter = {};

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
  }
};

window.toggleGameMode = function() {
  if (!window.JUEGO) return;
  if (JUEGO.activo) {
    salirDelJuego();
  } else {
    if (sandboxMode) prodSandboxToggle();
    closeProdObjectPanel();
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
    const container = document.getElementById('prod-3d-container');
    const w = container.clientWidth || 700;
    const h = container.clientHeight || 440;
    prodRenderer.setSize(w, h);
  }
}

const stationState = {
  0: { quality: 80 },
  1: { speed: 50, temperature: 25 },
  2: { temperature: 75, viscosity: 60 },
  3: { fillSpeed: 50 },
  4: { price: 4.50 }
};

const OBJECT_DATA = {
  reception: {
    fruit: { name: 'Parchita', icon: '\u{1F965}', desc: 'Fruta tropical amarilla, rica en vitamina C y antioxidantes. Variedad Passiflora edulis flavicarpa.',
      props: { Peso: '70g', 'Variedad': 'Flavicarpa', Origen: 'Venezuela', 'Vitamina C': '30mg/100g' } },
    basket: { name: 'Cesta', icon: '\u{1F9FA}', desc: 'Cesta de mimbre artesanal para transporte y almacenamiento de las frutas frescas.',
      props: { Capacidad: '5kg', Material: 'Mimbre', 'Uso': 'Almacenaje' } },
    table: { name: 'Mesa de trabajo', icon: '\u{1F6A7}', desc: 'Superficie de acero inoxidable para selección y clasificación de las parchitas.',
      props: { Material: 'Acero inox.', 'Dimensiones': '1.2m x 0.6m', 'Peso máx.': '50kg' } },
    leaf: { name: 'Hoja de parchita', icon: '\u{1F33F}', desc: 'Hoja verde brillante de la planta de parchita. La planta es trepadora y perenne.',
      props: { Color: 'Verde brillante', Forma: 'Lobulada', 'Tamaño': '8-12cm' } }
  },
  washing: {
    drum: { name: 'Tambor lavador', icon: '\u{1F6BF}', desc: 'Tambor centrifugado de acero inoxidable para lavado suave de las frutas.',
      props: { Velocidad: '300-1200 RPM', Capacidad: '15kg', Material: 'Acero inox.' } },
    water: { name: 'Agua de lavado', icon: '\u{1F4A7}', desc: 'Agua filtrada a temperatura controlada para eliminar impurezas de la cáscara.',
      props: { Temperatura: '25\u00B0C', pH: '7.0', Flujo: '8 L/min' } },
    washFruit: { name: 'Parchita en lavado', icon: '\u{1F965}', desc: 'Parchitas girando dentro del tambor durante el proceso de lavado y desinfección.',
      props: { Cantidad: '~12 unidades', Estado: 'En proceso', 'Tiempo': '3 min' } }
  },
  cooking: {
    pot: { name: 'Olla de cocción', icon: '\u{1F373}', desc: 'Olla de acero inoxidable con fondo grueso para cocción uniforme del sirope.',
      props: { Capacidad: '30L', Material: 'Acero inox.', 'Fondo': 'Triple capa' } },
    liquid: { name: 'Sirope de parchita', icon: '\u{1F9C4}', desc: 'Mezcla de jugo de parchita, azúcar y pectina en proceso de cocción. Adquiere textura y dulzor.',
      props: { Temperatura: '85\u00B0C', Viscosidad: 'Alta', Brix: '65\u00B0', pH: '3.2' } },
    fire: { name: 'Fuego', icon: '\u{1F525}', desc: 'Quemador de gas regulable para control preciso de la temperatura de cocción.',
      props: { Intensidad: 'Media', Temperatura: '180\u00B0C', Gas: 'Propano' } },
    bubble: { name: 'Burbujas', icon: '\u{26F0}', desc: 'Burbujas de vapor que indican la ebullición controlada del sirope.',
      props: { Actividad: 'Moderada', 'Tamaño': '2-5mm', 'Frecuencia': 'Constante' } },
    steam: { name: 'Vapor', icon: '\u{2601}', desc: 'Vapor de agua liberado durante la cocción. Señal de que el proceso está activo.',
      props: { Presión: 'Baja', 'Temperatura': '~100\u00B0C', Humedad: '80%' } }
  },
  packaging: {
    bottle: { name: 'Botella', icon: '\u{1F9F4}', desc: 'Botella de vidrio transparente lista para ser llenada con el sirope de parchita.',
      props: { Capacidad: '500ml', Material: 'Vidrio', 'Tipo': 'PET reciclable' } },
    nozzle: { name: 'Boquilla llenadora', icon: '\u{1F4A7}', desc: 'Boquilla de acero inoxidable para llenado preciso y sin derrames.',
      props: { Caudal: '100ml/s', Precisión: '\u00B11ml', Material: 'Acero inox.' } },
    tank: { name: 'Tanque de sirope', icon: '\u{1F4E6}', desc: 'Tanque de almacenamiento temporal del sirope listo para envasar.',
      props: { Volumen: '20L', Contenido: 'Sirope 65\u00B0Brix', 'Temperatura': '75\u00B0C' } },
    belt: { name: 'Banda transportadora', icon: '\u{1F6CE}', desc: 'Banda motorizada que transporta las botellas a través de la estación de envasado.',
      props: { Velocidad: '0.5 m/s', 'Ancho': '30cm', Material: 'PVC' } }
  },
  supermarket: {
    shelfBottle: { name: 'Botella en estante', icon: '\u{1F9F4}', desc: 'Producto final envasado, etiquetado y listo para la venta al consumidor.',
      props: { Precio: '$4.50', 'Contenido': '500ml', Lote: '#001', Caducidad: '12 meses' } },
    shelf: { name: 'Estante', icon: '\u{1F6CD}', desc: 'Estante metálico de exhibición para productos terminados en el punto de venta.',
      props: { Capacidad: '24 botellas', Material: 'Metal', 'Niveles': '2' } },
    priceSign: { name: 'Cartel de precio', icon: '\u{1F4B0}', desc: 'Cartel informativo con el precio y promociones del producto.',
      props: { Precio: '$4.50', 'Formato': '55x35cm', 'Promoción': '2x$8.00' } }
  }
};

function getProdData() {
  let kg = 2, lotes = 1, costo = 12.50, rend = 2.5;
  if (typeof state !== 'undefined' && state) {
    kg = state.ingredientes?.parchita?.kg || kg;
    lotes = (state.historial?.length || 0) + 1;
    if (typeof getCalculos === 'function') {
      try {
        const calc = getCalculos();
        costo = calc.totalCostosFijos || costo;
        rend = calc.rendimientoBruto || rend;
      } catch(e) {}
    }
  }
  return { kg, lotes, costo, rend };
}

function initProduccion3D(forceRebuild) {
  if (prodInitialized && !forceRebuild) {
    if (prodRenderer && prodRenderer.domElement && prodRenderer.domElement.parentElement) {
      updateProdStats();
      updateStationInfo(currentStation);
      return;
    }
  }
  if (typeof THREE === 'undefined') return;

  const container = document.getElementById('prod-3d-canvas');
  if (!container) return;

  const data = getProdData();
  prodLoteCount = data.lotes;
  stationData = data;

  const w = container.clientWidth || 700;
  const h = container.clientHeight || 440;

  prodScene = new THREE.Scene();
  prodCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  prodCamera.position.set(STATIONS[0].x + 6, 3, 8);
  prodCamera.lookAt(STATIONS[0].x, 1.5, 0);

  prodRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  prodRenderer.setSize(w, h);
  prodRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  prodRenderer.toneMapping = 1;
  prodRenderer.toneMappingExposure = 1.0;
  container.appendChild(prodRenderer.domElement);

  prodControls = new THREE.OrbitControls(prodCamera, prodRenderer.domElement);
  prodControls.enableDamping = true;
  prodControls.dampingFactor = 0.08;
  prodControls.minDistance = 3;
  prodControls.maxDistance = 20;

  const ambient = new THREE.AmbientLight(0x404060, 0.5);
  prodScene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 10, 8);
  prodScene.add(dir);
  const fill = new THREE.DirectionalLight(0xffdd99, 0.5);
  fill.position.set(-4, 3, -5);
  prodScene.add(fill);

  buildAllStations();
  buildFloor();
  updateTimeline(0);
  updateStationInfo(0);
  updateProdStats();

  prodInitialized = true;
  installProdMouseHandlers();
  animateProduction();
}

function buildAllStations() {
  clickables = [];
  allPickable = [];
  STATIONS.forEach((st, i) => {
    const group = new THREE.Group();
    group.position.x = st.x;
    buildStation(group, i);
    prodScene.add(group);
    stationGroups[i] = group;

    const zoneGeo = new THREE.BoxGeometry(7, 4, 7);
    const zoneMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const zone = new THREE.Mesh(zoneGeo, zoneMat);
    zone.position.set(st.x, 2, 0);
    zone.userData.stationIndex = i;
    zone.userData.pickable = true;
    zone.userData.objectKey = null;
    prodScene.add(zone);
    clickables.push(zone);
  });
}

function markPickable(obj, stationIndex, objectKey) {
  obj.userData.pickable = true;
  obj.userData.stationIndex = stationIndex;
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

function buildReception(group, idx) {
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x8D6E63, roughness: 0.8 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 2.5), tableMat);
  table.position.y = 0.8;
  markPickable(table, idx, 'table');
  group.add(table);

  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8), tableMat);
    leg.position.set(-1.6 + i * 1.07, 0.4, -0.9 + (i % 2) * 1.8);
    group.add(leg);
  }

  const basketMat = new THREE.MeshStandardMaterial({ color: 0xA1887F, roughness: 0.9 });
  const basketBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.8, 12), basketMat);
  basketBase.position.set(-0.5, 1.4, -0.3);
  markPickable(basketBase, idx, 'basket');
  group.add(basketBase);
  const basketRim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 8, 16), basketMat);
  basketRim.position.set(-0.5, 1.8, -0.3);
  basketRim.rotation.x = Math.PI / 2;
  group.add(basketRim);

  const fruitMat = new THREE.MeshStandardMaterial({ color: 0xE8A137, roughness: 0.6 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4CAF50 });
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.2 + Math.random() * 0.08, 8, 8), fruitMat);
    const angle = Math.random() * Math.PI * 2;
    const rad = 0.3 + Math.random() * 0.5;
    f.position.set(-0.5 + Math.cos(angle) * rad, 1.2 + Math.random() * 0.5, -0.3 + Math.sin(angle) * rad);
    f.userData.isFruit = true;
    markPickable(f, idx, 'fruit');
    group.add(f);
    if (Math.random() > 0.5) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), leafMat);
      leaf.scale.set(1, 0.3, 0.5);
      leaf.position.copy(f.position);
      leaf.position.y += 0.15 + Math.random() * 0.05;
      markPickable(leaf, idx, 'leaf');
      group.add(leaf);
    }
  }

  const looseFruitMat = new THREE.MeshStandardMaterial({ color: 0xF5A623, roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), looseFruitMat);
    f.position.set(0.6 + Math.random() * 0.6, 1.0, -0.5 + Math.random() * 0.8);
    f.userData.isFruit = true;
    markPickable(f, idx, 'fruit');
    group.add(f);
  }

  const signMat = new THREE.MeshStandardMaterial({ color: 0x5D4037 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 0.1), signMat);
  sign.position.set(0, 2.3, 0.8);
  group.add(sign);
}

function buildWashing(group, idx) {
  const drumMat = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, roughness: 0.3, metalness: 0.7 });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1.6, 20), drumMat);
  drum.position.y = 1.2;
  drum.userData.isDrum = true;
  markPickable(drum, idx, 'drum');
  group.add(drum);

  const drumInner = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.1, 1.5, 20),
    new THREE.MeshPhysicalMaterial({ color: 0x90A4AE, transparent: true, opacity: 0.2, roughness: 0.1, metalness: 0.5 })
  );
  drumInner.position.y = 1.2;
  group.add(drumInner);

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x4FC3F7, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0
  });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.6, 16), waterMat);
  water.position.y = 0.9;
  water.userData.isWater = true;
  markPickable(water, idx, 'water');
  group.add(water);

  const washFruitMat = new THREE.MeshStandardMaterial({ color: 0xE8A137, roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), washFruitMat);
    const a = (i / 5) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.4, 0.9 + Math.random() * 0.2, Math.sin(a) * 0.4);
    f.userData.isWashFruit = true;
    f.userData.angle = a;
    f.userData.radius = 0.4;
    markPickable(f, idx, 'washFruit');
    group.add(f);
  }

  const standMat = new THREE.MeshStandardMaterial({ color: 0x78909C, roughness: 0.5 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 2.2), standMat);
  stand.position.y = 0.4;
  group.add(stand);
}

function buildCooking(group, idx) {
  const potMat = new THREE.MeshStandardMaterial({ color: 0x546E7A, roughness: 0.4, metalness: 0.6 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.3, 1.8, 20), potMat);
  pot.position.y = 1.2;
  markPickable(pot, idx, 'pot');
  group.add(pot);

  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: 0xFF8A65, transparent: true, opacity: 0.6, roughness: 0.2, metalness: 0
  });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.25, 0.55, 16), liquidMat);
  liquid.position.y = 0.5;
  liquid.userData.isLiquid = true;
  markPickable(liquid, idx, 'liquid');
  group.add(liquid);

  const fireMat = new THREE.MeshBasicMaterial({ color: 0xFF6F00, transparent: true, opacity: 0.4 });
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 8), fireMat);
  fire.position.y = 0.1;
  fire.userData.isFire = true;
  markPickable(fire, idx, 'fire');
  group.add(fire);

  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.3 });
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.06, 6, 6), bubbleMat);
    b.position.set(
      (Math.random() - 0.5) * 1.0,
      Math.random() * 0.5 + 0.4,
      (Math.random() - 0.5) * 1.0
    );
    b.userData.isBubble = true;
    b.userData.speed = 0.3 + Math.random() * 0.4;
    b.userData.offset = Math.random() * 100;
    group.add(b);
  }

  const steamMat = new THREE.MeshBasicMaterial({ color: 0xEEEEEE, transparent: true, opacity: 0.15 });
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.1, 6, 6), steamMat);
    s.position.set(
      (Math.random() - 0.5) * 0.8,
      1.8 + Math.random() * 0.4,
      (Math.random() - 0.5) * 0.8
    );
    s.userData.isSteam = true;
    s.userData.speed = 0.2 + Math.random() * 0.3;
    s.userData.offset = Math.random() * 200;
    group.add(s);
  }

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x37474F, roughness: 0.7 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.3, 12), baseMat);
  base.position.y = 0.15;
  group.add(base);
}

function buildPackaging(group, idx) {
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x455A64, roughness: 0.7 });
  const belt = new THREE.Mesh(new THREE.BoxGeometry(5, 0.15, 1.0), beltMat);
  belt.position.set(0, 0.3, 0);
  markPickable(belt, idx, 'belt');
  group.add(belt);

  const rollerMat = new THREE.MeshStandardMaterial({ color: 0x607D8B, roughness: 0.5, metalness: 0.3 });
  for (let i = -2; i <= 2; i += 1) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), rollerMat);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(i * 1.0, 0.37, 0);
    group.add(roller);
  }

  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x78909C, metalness: 0.8, roughness: 0.2 });
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 0.5, 8), nozzleMat);
  nozzle.position.set(-0.8, 1.0, 0);
  nozzle.userData.isNozzle = true;
  markPickable(nozzle, idx, 'nozzle');
  group.add(nozzle);

  const tankMat = new THREE.MeshStandardMaterial({ color: 0x78909C, metalness: 0.6, roughness: 0.3 });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.8, 12), tankMat);
  tank.position.set(-0.8, 1.6, 0);
  markPickable(tank, idx, 'tank');
  group.add(tank);

  buildPackagingBottles(group, idx);
}

function buildPackagingBottles(group, idx) {
  const toRemove = [];
  group.children.forEach(c => { if (c.userData.stationType === 'packaging') toRemove.push(c); });
  toRemove.forEach(c => group.remove(c));

  for (let i = 0; i < 3; i++) {
    const bottleGroup = buildBottleForProd(0.3);
    bottleGroup.position.set(-1.2 + i * 1.2, 0.4, 0);
    bottleGroup.userData.isBottle = true;
    bottleGroup.userData.bottleIndex = i;
    bottleGroup.userData.stationType = 'packaging';
    bottleGroup.userData.stationIndex = idx;
    bottleGroup.userData.objectKey = 'bottle';
    bottleGroup.userData.pickable = true;
    allPickable.push(bottleGroup);
    group.add(bottleGroup);
    prodBottleGroups.push(bottleGroup);
  }
}

function buildSupermarketBottles(group, idx) {
  const toRemove = [];
  group.children.forEach(c => { if (c.userData.stationType === 'supermarket') toRemove.push(c); });
  toRemove.forEach(c => group.remove(c));

  for (let i = 0; i < 6; i++) {
    const bg = buildBottleForProd(0.3);
    const col = (i % 3) - 1;
    const row = Math.floor(i / 3);
    bg.position.set(col * 0.9, 0.6 + row * 0.9, 0.4 * (i % 2 === 0 ? 1 : -1));
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

function buildSupermarket(group, idx) {
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x78909C, roughness: 0.5, metalness: 0.3 });
  const shelfBase = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1.6), shelfMat);
  shelfBase.position.set(0, 0.3, 0);
  markPickable(shelfBase, idx, 'shelf');
  group.add(shelfBase);

  const shelfColor = new THREE.MeshStandardMaterial({ color: 0x90A4AE, roughness: 0.4, metalness: 0.2 });
  for (let level = 0; level < 2; level++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.06, 1.5), shelfColor);
    board.position.set(0, 0.6 + level * 0.9, 0);
    group.add(board);
  }
  for (let side = -1; side <= 1; side += 2) {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 0.06), shelfMat);
    upright.position.set(side * 1.9, 0.9, 0.75);
    group.add(upright);
    const upright2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 0.06), shelfMat);
    upright2.position.set(side * 1.9, 0.9, -0.75);
    group.add(upright2);
  }

  buildSupermarketBottles(group, idx);

  const priceMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
  const priceSign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.05), priceMat);
  priceSign.position.set(0, 2.0, 0.9);
  markPickable(priceSign, idx, 'priceSign');
  group.add(priceSign);
}

function buildBottleForProd(scale) {
  const g = new THREE.Group();
  const s = scale || 0.3;
  const h = 2.5 * s;
  const r = 0.4 * s;

  const profile = [
    new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.9, 0),
    new THREE.Vector2(r, 0.02), new THREE.Vector2(r, h * 0.65),
    new THREE.Vector2(r * 0.8, h * 0.72), new THREE.Vector2(r * 0.5, h * 0.8),
    new THREE.Vector2(r * 0.28, h * 0.87), new THREE.Vector2(r * 0.2, h * 0.93),
    new THREE.Vector2(r * 0.18, h), new THREE.Vector2(r * 0.14, h),
    new THREE.Vector2(r * 0.14, h * 0.94), new THREE.Vector2(0, h * 0.94)
  ];

  const geo = new THREE.LatheGeometry(profile, 12);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xc8e8d0, transparent: true, opacity: 0.3,
    roughness: 0.2, metalness: 0.05, clearcoat: 0.2
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.pickable = true;
  g.add(mesh);

  const capMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.6 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.24, h * 0.05, 8), capMat);
  cap.position.y = h;
  cap.userData.pickable = true;
  g.add(cap);

  const design = window.productionLabelDesign;
  if (design) {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = design.fondo || '#E8A137';
    ctx.fillRect(0, 0, 200, 80);
    ctx.fillStyle = design.texto || '#FFFFFF';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((design.nombre || 'SIROPE').substring(0, 14), 100, 35);
    ctx.font = '10px Outfit, sans-serif';
    ctx.fillStyle = (design.texto || '#FFFFFF') + 'CC';
    ctx.fillText((design.slogan || '').substring(0, 18), 100, 58);

    const tex = new THREE.CanvasTexture(canvas);
    const labelH = h * 0.5;
    const labelY = h * 0.25;
    const labelR = r + 0.01;
    const labelGeo = new THREE.CylinderGeometry(labelR, labelR, labelH, 12, 1, true, -Math.PI * 0.3, Math.PI * 0.6);
    labelGeo.translate(0, labelY, 0);
    const labelMat2 = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, depthWrite: false });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat2);
    g.add(labelMesh);
  }

  return g;
}

function buildFloor() {
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xCFD8DC, roughness: 0.9, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 20), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  prodScene.add(floor);

  for (let i = 0; i < STATIONS.length; i++) {
    const spotMat = new THREE.MeshBasicMaterial({ color: STATIONS[i].color, transparent: true, opacity: 0.08 });
    const spot = new THREE.Mesh(new THREE.CircleGeometry(2.5, 16), spotMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(STATIONS[i].x, 0, 0);
    prodScene.add(spot);
  }
}

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
        const q = st[0]?.quality || 80;
        child.position.y += Math.sin(time * 1.5 + child.position.x) * 0.0005 * (q / 50);
      }
      if (child.userData?.isWashFruit) {
        const spd = (st[1]?.speed || 50) / 100;
        const a = child.userData.angle + time * 0.5 * spd;
        const rad = child.userData.radius;
        child.position.x = Math.cos(a) * rad;
        child.position.z = Math.sin(a) * rad;
        child.position.y = 0.9 + Math.sin(time * 2 + child.userData.angle) * 0.05;
      }
      if (child.userData?.isWater) {
        const washTemp = (st[1]?.temperature || 25) / 50;
        child.scale.x = 1 + Math.sin(time * 2) * 0.02 * washTemp;
        child.scale.z = 1 + Math.cos(time * 2.3) * 0.02 * washTemp;
      }
      if (child.userData?.isDrum) {
        const spd = (st[1]?.speed || 50) / 100;
        child.rotation.y += 0.005 * spd;
      }
      if (child.userData?.isBubble) {
        const cookTemp = (st[2]?.temperature || 75) / 100;
        const b = child;
        b.position.y += 0.003 * b.userData.speed * cookTemp;
        b.position.x += Math.sin(time * b.userData.speed + b.userData.offset) * 0.002;
        if (b.position.y > 1.4) b.position.y = 0.4;
        b.material.opacity = 0.1 + 0.2 * cookTemp + Math.sin(time + b.userData.offset) * 0.05;
      }
      if (child.userData?.isSteam) {
        const cookTemp = (st[2]?.temperature || 75) / 100;
        const s = child;
        s.position.y += 0.002 * s.userData.speed * cookTemp;
        s.position.x += Math.sin(time * s.userData.speed * 0.5 + s.userData.offset) * 0.001;
        s.material.opacity = (0.1 + 0.1 * cookTemp) + Math.sin(time * 0.5 + s.userData.offset) * 0.05;
        if (s.position.y > 2.5) s.position.y = 1.8;
      }
      if (child.userData?.isFire) {
        const cookTemp = (st[2]?.temperature || 75) / 100;
        child.scale.x = 1 + Math.sin(time * 3) * 0.1 * cookTemp;
        child.scale.z = 1 + Math.cos(time * 3.5) * 0.1 * cookTemp;
        child.material.opacity = 0.2 + 0.3 * cookTemp + Math.sin(time * 4) * 0.15;
      }
      if (child.userData?.isNozzle) {
        const fillSpd = (st[3]?.fillSpeed || 50) / 100;
        child.position.y = 1.0 + Math.sin(time * 1.5 * fillSpd) * 0.05;
      }
      if (child.userData?.isBottle && child.userData.bottleIndex !== undefined) {
        child.position.x += Math.sin(time * 0.5 + child.userData.bottleIndex) * 0.0003;
      }
    });
  });

  prodRenderer.render(prodScene, prodCamera);
}

function moveCameraToStation(index) {
  if (index < 0 || index >= STATIONS.length) return;
  currentStation = index;
  const st = STATIONS[index];
  const targetPos = new THREE.Vector3(st.x + 5, 2.5, 6);
  const targetLook = new THREE.Vector3(st.x, 1.5, 0);
  animateCamera(targetPos, targetLook);
  updateTimeline(index);
  updateStationInfo(index);
}

function animateCamera(targetPos, targetLook) {
  const startPos = prodCamera.position.clone();
  const startTarget = prodControls ? prodControls.target.clone() : new THREE.Vector3(0, 1.5, 0);
  const duration = 600;
  const startTime = performance.now();

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
  document.querySelectorAll('.timeline-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

function updateStationInfo(index) {
  const st = STATIONS[index];
  const info = document.getElementById('prod-station-info');
  const title = document.getElementById('prod-station-title');
  const desc = document.getElementById('prod-station-desc');
  const data = document.getElementById('prod-station-data');
  if (title) title.textContent = `${st.icon} ${st.name}`;
  if (desc) desc.textContent = st.detail;
  if (data) {
    const d = getProdData();
    data.innerHTML = `\u{1F9EE} ${d.kg}kg parchita · $${d.costo.toFixed(2)} · Lote #${d.lotes}`;
  }
  if (info) info.style.display = 'block';
}

function updateProdStats() {
  const d = getProdData();
  document.getElementById('prod-lote-num').textContent = d.lotes;
  document.getElementById('prod-costo').textContent = d.costo.toFixed(2);
  document.getElementById('prod-rendimiento').textContent = d.rend;
}

/* ---- Object interaction ---- */

function highlightObject(obj) {
  clearHighlight();
  if (!obj || !obj.isObject3D) return;
  selectedObject = obj;
  if (obj.type === 'Group') {
    obj.traverse(c => {
      if (c.isMesh && c.material && !c.material._origEmissive) {
        c.material._origEmissive = c.material.emissive ? c.material.emissive.clone() : new THREE.Color(0x000000);
        c.material._origEmissiveIntensity = c.material.emissiveIntensity || 0;
        if (c.material.emissive) {
          c.material.emissive.setHex(0x4488ff);
          c.material.emissiveIntensity = 0.3;
        }
      }
    });
  } else if (obj.isMesh && obj.material) {
    if (!obj.material._origEmissive) {
      obj.material._origEmissive = obj.material.emissive ? obj.material.emissive.clone() : new THREE.Color(0x000000);
      obj.material._origEmissiveIntensity = obj.material.emissiveIntensity || 0;
    }
    if (obj.material.emissive) {
      obj.material.emissive.setHex(0x4488ff);
      obj.material.emissiveIntensity = 0.3;
    }
  }
}

function clearHighlight() {
  if (selectedObject) {
    const clearMat = function(m) {
      if (m._origEmissive) {
        if (m.emissive) m.emissive.copy(m._origEmissive);
        if (m.emissiveIntensity !== undefined) m.emissiveIntensity = m._origEmissiveIntensity;
        delete m._origEmissive;
        delete m._origEmissiveIntensity;
      }
    };
    if (selectedObject.type === 'Group') {
      selectedObject.traverse(c => { if (c.isMesh && c.material) clearMat(c.material); });
    } else if (selectedObject.isMesh && selectedObject.material) {
      clearMat(selectedObject.material);
    }
    selectedObject = null;
  }
}

function showObjectPanel(obj, stationIdx, objectKey) {
  const stationName = ['reception', 'washing', 'cooking', 'packaging', 'supermarket'][stationIdx];
  const data = OBJECT_DATA[stationName]?.[objectKey];
  if (!data) return;

  const panel = document.getElementById('prod-object-panel');
  document.getElementById('prod-obj-icon').textContent = data.icon;
  document.getElementById('prod-obj-title').textContent = data.name;
  document.getElementById('prod-obj-station').textContent = STATIONS[stationIdx]?.name || '';
  document.getElementById('prod-obj-desc').textContent = data.desc;

  const propsContainer = document.getElementById('prod-obj-props');
  propsContainer.innerHTML = '';
  Object.entries(data.props).forEach(([k, v]) => {
    const div = document.createElement('div');
    div.className = 'prop-card';
    div.innerHTML = `<span class="prop-label">${k}</span><span class="prop-value">${v}</span>`;
    propsContainer.appendChild(div);
  });

  // Controls depend on object type
  const controlContainer = document.getElementById('prod-obj-control');
  controlContainer.innerHTML = '';
  addObjectControls(controlContainer, stationIdx, objectKey);

  // Action buttons for sandbox
  const actionContainer = document.getElementById('prod-obj-actions');
  actionContainer.innerHTML = '';
  if (sandboxMode) {
    const spawnKey = getSpawnableKey(stationIdx, objectKey);
    if (spawnKey) {
      const addBtn = document.createElement('button');
      addBtn.className = 'btn-glass text-xs flex items-center gap-1';
      addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Añadir';
      addBtn.onclick = function() { window.spawnObject(stationIdx, spawnKey); };
      actionContainer.appendChild(addBtn);
    }
    if (getRemovable(obj)) {
      const rmBtn = document.createElement('button');
      rmBtn.className = 'btn-glass text-xs flex items-center gap-1 text-red-500';
      rmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Eliminar';
      rmBtn.onclick = function() { window.removeSelectedObject(); };
      actionContainer.appendChild(rmBtn);
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

/* ---- Mouse handlers (click + drag) ---- */

function getObjectKeyFromMesh(obj) {
  if (!obj) return null;
  if (obj.userData && obj.userData.objectKey) return obj.userData.objectKey;
  if (obj.parent && obj.parent.userData && obj.parent.userData.objectKey) return obj.parent.userData.objectKey;
  if (obj.parent && obj.parent.parent && obj.parent.parent.userData && obj.parent.parent.userData.objectKey) return obj.parent.parent.userData.objectKey;
  return null;
}

function getStationIndexFromObj(obj) {
  if (obj.userData && obj.userData.stationIndex !== undefined) return obj.userData.stationIndex;
  if (obj.parent && obj.parent.userData && obj.parent.userData.stationIndex !== undefined) return obj.parent.userData.stationIndex;
  if (obj.parent && obj.parent.parent && obj.parent.parent.userData && obj.parent.parent.userData.stationIndex !== undefined) return obj.parent.parent.userData.stationIndex;
  return null;
}

function getPickableParent(obj) {
  let current = obj;
  while (current) {
    if (current.userData && current.userData.pickable && current.userData.objectKey) return current;
    if (current.userData && current.userData.stationType) return current;
    current = current.parent;
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
    if (p.type === 'Group') {
      p.traverse(c => { if (c.isMesh) meshes.push(c); });
    } else if (p.isMesh) {
      meshes.push(p);
    }
  });
  return raycaster.intersectObjects(meshes, false);
}

function getDragTarget(intersects) {
  for (const hit of intersects) {
    let obj = hit.object;
    let stationIdx = getStationIndexFromObj(obj);
    let objectKey = getObjectKeyFromMesh(obj);
    if (!objectKey) {
      const parent = obj.parent;
      if (parent && parent.userData && parent.userData.objectKey) {
        objectKey = parent.userData.objectKey;
        obj = parent;
      }
    }
    if (stationIdx === null && obj.parent && obj.parent.userData && obj.parent.userData.stationIndex !== undefined) {
      stationIdx = obj.parent.userData.stationIndex;
      obj = obj.parent;
    }
    if (objectKey && stationIdx !== null) {
      return { object: getPickableParent(obj), stationIdx, objectKey };
    }
  }
  return null;
}

// --- Drag logic ---
function startDrag(e) {
  if (!sandboxMode || isPlaying || !prodRenderer) return;
  const { mouse } = castProdMouse(e);
  const intersects = hitTestObjects(mouse);
  if (intersects.length === 0) return;
  const target = getDragTarget(intersects);
  if (!target) return;

  dragTarget = target;
  dragObject = target.object;

  if (!dragObject) return;

  // Disable controls during drag
  if (prodControls) prodControls.enabled = false;
  isDragging = false;
  dragStartPos.set(e.clientX, e.clientY);

  // Build drag plane perpendicular to camera view through object position
  const worldPos = new THREE.Vector3();
  if (dragObject.type === 'Group') {
    dragObject.getWorldPosition(worldPos);
  } else {
    dragObject.getWorldPosition(worldPos);
  }
  const camDir = new THREE.Vector3();
  prodCamera.getWorldDirection(camDir);
  dragPlane.setFromNormalAndCoplanarPoint(camDir, worldPos);

  // Calculate offset
  const planeIntersect = new THREE.Vector3();
  const ray = new THREE.Raycaster().setFromCamera(mouse, prodCamera);
  ray.ray.intersectPlane(dragPlane, planeIntersect);
  if (planeIntersect) {
    if (dragObject.type === 'Group') {
      dragOffset.copy(dragObject.position).sub(planeIntersect);
    } else {
      dragOffset.copy(dragObject.position).sub(planeIntersect);
    }
  }

  document.getElementById('prod-3d-container').style.cursor = 'grabbing';
}

function moveDrag(e) {
  if (!dragObject || !sandboxMode) return;

  const dx = e.clientX - dragStartPos.x;
  const dy = e.clientY - dragStartPos.y;

  if (!isDragging && (Math.abs(dx) > dragMoveThreshold || Math.abs(dy) > dragMoveThreshold)) {
    isDragging = true;
    closeProdObjectPanel();
    clearHighlight();
  }

  if (!isDragging) return;

  const { mouse } = castProdMouse(e);
  const planeIntersect = new THREE.Vector3();
  const ray = new THREE.Raycaster().setFromCamera(mouse, prodCamera);
  if (!ray.ray.intersectPlane(dragPlane, planeIntersect)) return;

  const newPos = planeIntersect.clone().add(dragOffset);
  if (dragObject.type === 'Group') {
    dragObject.position.copy(newPos);
  } else {
    dragObject.position.copy(newPos);
  }
}

function endDrag(e) {
  if (dragObject && sandboxMode) {
    document.getElementById('prod-3d-container').style.cursor = 'grab';
    if (prodControls) prodControls.enabled = true;
  }
  dragObject = null;
  dragTarget = null;
  isDragging = false;
}

// --- Click handler (both modes) ---
function handleProdClick(e) {
  if (isDragging || isPlaying || !prodRenderer) return;
  const { mouse } = castProdMouse(e);
  const intersects = hitTestObjects(mouse);
  if (intersects.length === 0) {
    // Fallback: station zone click
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, prodCamera);
    const zoneHit = raycaster.intersectObjects(clickables);
    if (zoneHit.length > 0) {
      const idx = zoneHit[0].object.userData.stationIndex;
      if (idx !== undefined) { closeProdObjectPanel(); moveCameraToStation(idx); }
    }
    return;
  }
  const target = getDragTarget(intersects);
  if (target && !isPlaying) {
    highlightObject(target.object);
    showObjectPanel(target.object, target.stationIdx, target.objectKey);
  }
}

// Install drag handlers on canvas
function installProdMouseHandlers() {
  const canvas = prodRenderer ? prodRenderer.domElement : null;
  if (!canvas) return;
  canvas.removeEventListener('mousedown', startDrag);
  canvas.removeEventListener('mousemove', moveDrag);
  canvas.removeEventListener('mouseup', endDrag);
  canvas.removeEventListener('click', handleProdClick);
  canvas.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', moveDrag);
  document.addEventListener('mouseup', endDrag);
  canvas.addEventListener('click', handleProdClick);
}

/* ---- Spawn / Remove ---- */

function getStationGroup(stationIdx) {
  return stationGroups[stationIdx];
}

function removeFromPickable(obj) {
  const idx = allPickable.indexOf(obj);
  if (idx !== -1) allPickable.splice(idx, 1);
}

function spawnFruit(stationIdx) {
  const group = getStationGroup(stationIdx);
  if (!group) return;
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.2 + Math.random() * 0.08, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xE8A137, roughness: 0.6 }));
  f.position.set((Math.random() - 0.5) * 2, 1.0 + Math.random() * 0.8, (Math.random() - 0.5) * 1.5);
  f.userData.isFruit = true;
  markPickable(f, stationIdx, 'fruit');
  group.add(f);

  if (Math.random() > 0.4) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4),
      new THREE.MeshStandardMaterial({ color: 0x4CAF50 }));
    leaf.scale.set(1, 0.3, 0.5);
    leaf.position.copy(f.position);
    leaf.position.y += 0.15 + Math.random() * 0.05;
    markPickable(leaf, stationIdx, 'leaf');
    group.add(leaf);
  }
}

function spawnWashFruit(stationIdx) {
  const group = getStationGroup(stationIdx);
  if (!group) return;
  const count = group.children.filter(c => c.userData.isWashFruit).length;
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xE8A137, roughness: 0.6 }));
  const a = (count / 8) * Math.PI * 2;
  f.position.set(Math.cos(a) * 0.4, 0.9 + Math.random() * 0.2, Math.sin(a) * 0.4);
  f.userData.isWashFruit = true;
  f.userData.angle = a;
  f.userData.radius = 0.4;
  markPickable(f, stationIdx, 'washFruit');
  group.add(f);
}

function spawnBottle(stationIdx, type) {
  const group = getStationGroup(stationIdx);
  if (!group) return;
  const bg = buildBottleForProd(0.3);
  const count = group.children.filter(c => c.userData.isBottle || c.userData.isShelfBottle).length;
  bg.position.set((Math.random() - 0.5) * 2.5, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 1.2);
  if (type === 'supermarket') {
    bg.userData.isShelfBottle = true;
    bg.userData.stationType = 'supermarket';
    bg.userData.objectKey = 'shelfBottle';
  } else {
    bg.userData.isBottle = true;
    bg.userData.bottleIndex = count;
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
  const map = {
    0: { fruit: 'fruit', washFruit: 'washFruit' },
    1: { washFruit: 'washFruit', fruit: 'fruit' },
    2: {},
    3: { bottle: 'bottle' },
    4: { shelfBottle: 'shelfBottle' }
  };
  const keys = Object.keys(map[stationIdx] || {});
  if (keys.includes(objectKey)) return objectKey;
  if (keys.length > 0) return keys[0];
  return null;
}

function getRemovable(obj) {
  if (!obj) return false;
  const key = obj.userData.objectKey;
  const removable = ['fruit', 'leaf', 'washFruit', 'bottle', 'shelfBottle'];
  return removable.includes(key) || obj.userData.isShelfBottle || obj.userData.isBottle;
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

window.removeSelectedObject = function() {
  if (!selectedObject || isPlaying) return;
  const stationIdx = selectedObject.userData.stationIndex;
  if (stationIdx === undefined || stationIdx === null) return;
  const group = getStationGroup(stationIdx);
  if (!group) return;
  if (!getRemovable(selectedObject)) return;
  group.remove(selectedObject);
  removeFromPickable(selectedObject);
  closeProdObjectPanel();
};

/* ---- Exports ---- */

function rebuildBottles() {
  if (!prodInitialized || !stationGroups[3] || !stationGroups[4]) return;
  prodBottleGroups = [];
  buildPackagingBottles(stationGroups[3], 3);
  buildSupermarketBottles(stationGroups[4], 4);
}

window.prodSiguiente = function() {
  if (isPlaying) return;
  closeProdObjectPanel();
  const next = (currentStation + 1) % STATIONS.length;
  moveCameraToStation(next);
};

window.prodAnterior = function() {
  if (isPlaying) return;
  closeProdObjectPanel();
  const prev = (currentStation - 1 + STATIONS.length) % STATIONS.length;
  moveCameraToStation(prev);
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
  const delay = 3000 / playSpeed;
  playTimer = setTimeout(() => {
    currentStation = (currentStation + 1) % STATIONS.length;
    if (currentStation === 0) {
      isPlaying = false;
      const btn = document.getElementById('prod-play-btn');
      if (btn) {
        btn.innerHTML = '<i class="fas fa-play"></i> Reproducir';
        btn.className = 'btn-glass bg-secondary text-white font-medium';
      }
      return;
    }
    prodPlayStep();
  }, delay);
}

window.prodSetSpeed = function(speed) {
  playSpeed = parseFloat(speed);
};

window.prodInit = function(forceRebuild) {
  const data = getProdData();
  prodLoteCount = data.lotes;
  stationData = data;
  setTimeout(() => {
    if (prodInitialized && forceRebuild) {
      rebuildBottles();
      updateProdStats();
      updateStationInfo(currentStation);
      return;
    }
    initProduccion3D(forceRebuild);
    updateProdStats();
  }, 150);
  if (window.JUEGO && JUEGO.activo) {
    ocultarVista3D();
    document.getElementById('game-hud').style.display = 'block';
    if (JUEGO.resultados) {
      document.getElementById('juego-resultados').style.display = 'flex';
    } else {
      actualizarHUD();
      renderizarFase(JUEGO.fase);
    }
  }
};

window.updateProdData = function() {
  const d = getProdData();
  document.getElementById('prod-lote-num').textContent = d.lotes;
  document.getElementById('prod-costo').textContent = d.costo.toFixed(2);
  document.getElementById('prod-rendimiento').textContent = d.rend;
};
