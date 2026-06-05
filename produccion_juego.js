/* ======================== MODO JUEGO — PARCHITA CRAFTING ======================== */

window.JUEGO = {
  activo: false,
  fase: 0,
  data: {},
  fasesCompletadas: [false, false, false, false, false],
  resultados: null
};

(function() {
  try {
    const gs = localStorage.getItem('parchita_juego');
    if (gs) Object.assign(window.JUEGO, JSON.parse(gs));
  } catch(e) {}
})();

const FASES = [
  { nombre: 'Selección', icono: '\u{1F965}', desc: 'Selecciona la cantidad y calidad de los ingredientes' },
  { nombre: 'Lavado', icono: '\u{1F6BF}', desc: 'Controla el lavado y desinfección de las parchitas' },
  { nombre: 'Cocción', icono: '\u{1F372}', desc: 'Cocción controlada del sirope en 4 pasos' },
  { nombre: 'Envasado', icono: '\u{1F9F4}', desc: 'Llena las botellas con precisión milimétrica' },
  { nombre: 'Venta', icono: '\u{1F3EA}', desc: 'Coloca el producto en el estante y fija el precio' }
];

const INGREDIENTES_BASE = {
  parchita: { kg: 2.0, min: 1.0, max: 5.0, paso: 0.1, label: 'Parchita', unidad: 'kg', icono: '\u{1F965}' },
  azucar: { kg: 1.5, min: 0.5, max: 4.0, paso: 0.1, label: 'Azúcar', unidad: 'kg', icono: '\u{1F9C8}' },
  agua: { L: 1.0, min: 0.5, max: 3.0, paso: 0.1, label: 'Agua', unidad: 'L', icono: '\u{1F4A7}' },
  pectina: { g: 15, min: 5, max: 50, paso: 1, label: 'Pectina', unidad: 'g', icono: '\u{1F9EA}' },
  acido_citrico: { g: 5, min: 0, max: 15, paso: 0.5, label: 'Ácido cítrico', unidad: 'g', icono: '\u{2697}' },
  sorbato_potasio: { g: 2, min: 0, max: 10, paso: 0.5, label: 'Sorbato de potasio', unidad: 'g', icono: '\u{2697}' }
};

/* ======================== INICIO DEL JUEGO ======================== */

function iniciarJuego() {
  JUEGO.activo = true;
  JUEGO.fase = 0;
  JUEGO.fasesCompletadas = [false, false, false, false, false];
  JUEGO.resultados = null;
  JUEGO.data = {
    ingredientes: JSON.parse(JSON.stringify(INGREDIENTES_BASE)),
    lavado: { tiempo: 3, temperatura: 25, velocidad: 50, limpieza: 70 },
    coccion: {
      precalentar: { hecho: false, temperatura: 60, tiempo: 0 },
      azucar: { hecho: false, tiempo: 0 },
      pectina: { hecho: false, tiempo: 0 },
      hervir: { hecho: false, temperatura: 85, tiempo: 15 }
    },
    envasado: { precision: 70, llenado: 80, botellas: 6 },
    venta: { precio: 4.50, estante: 'medio' }
  };
  actualizarHUD();
  renderizarFase(0);
  SFX.chime();
}

/* ======================== NAVEGACIÓN DE FASES ======================== */

function irAFase(idx) {
  if (idx < 0 || idx > 4) return;
  for (let i = 0; i < idx; i++) {
    if (!JUEGO.fasesCompletadas[i]) {
      mostrarToast('\u26A0\uFE0F Debes completar las fases anteriores primero', 'warning');
      return;
    }
  }
  if (idx > JUEGO.fase && !JUEGO.fasesCompletadas[JUEGO.fase]) {
    mostrarToast('\u26A0\uFE0F Confirma o completa la fase actual primero', 'warning');
    return;
  }
  JUEGO.fase = idx;
  renderizarFase(idx);
  actualizarHUD();
}

function confirmarFase() {
  const f = JUEGO.fase;
  switch (f) {
    case 0: return confirmarSeleccion();
    case 1: return confirmarLavado();
    case 2: return confirmarCoccion();
    case 3: return confirmarEnvasado();
    case 4: return confirmarVenta();
  }
}

function siguienteFase() {
  if (JUEGO.fase < 4) {
    JUEGO.fase++;
    renderizarFase(JUEGO.fase);
    actualizarHUD();
  } else {
    calcularResultados();
    mostrarResultados();
  }
}

/* ======================== FASE 0: SELECCIÓN ======================== */

function confirmarSeleccion() {
  JUEGO.fasesCompletadas[0] = true;
  SFX.success();
  siguienteFase();
}

/* ======================== FASE 1: LAVADO ======================== */

function actualizarLavado() {
  const d = JUEGO.data.lavado;
  const temp = d.temperatura;
  const tiempo = d.tiempo;
  const vel = d.velocidad;
  const limpieza = Math.min(100, Math.round(
    50 + (temp >= 20 && temp <= 40 ? 20 : -15) +
    (tiempo >= 2 && tiempo <= 5 ? 15 : -10) +
    (vel >= 40 && vel <= 80 ? 10 : -10) +
    Math.random() * 5
  ));
  d.limpieza = Math.max(10, Math.min(100, limpieza));
  document.getElementById('juego-lavado-limpieza').textContent = d.limpieza + '%';
}

function confirmarLavado() {
  JUEGO.fasesCompletadas[1] = true;
  SFX.success();
  siguienteFase();
}

/* ======================== FASE 2: COCCIÓN ======================== */

function renderizarCoccion() {
  const c = JUEGO.data.coccion;
  const cont = document.getElementById('juego-fase-contenido');
  if (!cont) return;

  const pasos = [
    { 
      key: 'precalentar', 
      label: 'Precalentar', 
      desc: 'Lleva la olla a 60\u00B0C',
      icono: '\u{1F525}',
      hecho: c.precalentar.hecho,
      control: c.precalentar.hecho ? '' : `
        <input type="range" min="30" max="90" value="${c.precalentar.temperatura}" 
          oninput="JUEGO.data.coccion.precalentar.temperatura=+this.value;document.getElementById('pre-temp').textContent=this.value+'\\u00B0C'">
        <span class="text-sm font-medium" id="pre-temp">${c.precalentar.temperatura}\u00B0C</span>
        <button class="juego-btn" onclick="ejecutarPaso('precalentar')">Ejecutar</button>`
    },
    { 
      key: 'azucar', 
      label: 'Añadir azúcar', 
      desc: 'Agrega el azúcar y disuelve',
      icono: '\u{1F9C8}',
      hecho: c.azucar.hecho,
      control: c.azucar.hecho ? '' : `
        <div class="text-xs text-secondary mb-1">Tiempo de mezcla: <span id="azu-tiempo">${c.azucar.tiempo}</span>s</div>
        <input type="range" min="5" max="60" value="${c.azucar.tiempo}"
          oninput="JUEGO.data.coccion.azucar.tiempo=+this.value;document.getElementById('azu-tiempo').textContent=this.value">
        <button class="juego-btn" onclick="ejecutarPaso('azucar')">Ejecutar</button>`
    },
    { 
      key: 'pectina', 
      label: 'Añadir pectina', 
      desc: 'Incorpora la pectina gradualmente',
      icono: '\u{1F9EA}',
      hecho: c.pectina.hecho,
      control: c.pectina.hecho ? '' : `
        <div class="text-xs text-secondary mb-1">Tiempo de mezcla: <span id="pec-tiempo">${c.pectina.tiempo}</span>s</div>
        <input type="range" min="5" max="60" value="${c.pectina.tiempo}"
          oninput="JUEGO.data.coccion.pectina.tiempo=+this.value;document.getElementById('pec-tiempo').textContent=this.value">
        <button class="juego-btn" onclick="ejecutarPaso('pectina')">Ejecutar</button>`
    },
    { 
      key: 'hervir', 
      label: 'Hervir', 
      desc: 'Cocción final del sirope',
      icono: '\u{26F0}',
      hecho: c.hervir.hecho,
      control: c.hervir.hecho ? '' : `
        <div class="text-xs text-secondary mb-1">Temperatura: <span id="her-temp">${c.hervir.temperatura}</span>\u00B0C</div>
        <input type="range" min="70" max="110" value="${c.hervir.temperatura}"
          oninput="JUEGO.data.coccion.hervir.temperatura=+this.value;document.getElementById('her-temp').textContent=this.value">
        <div class="text-xs text-secondary mb-1 mt-1">Tiempo: <span id="her-tiempo">${c.hervir.tiempo}</span> min</div>
        <input type="range" min="5" max="45" value="${c.hervir.tiempo}"
          oninput="JUEGO.data.coccion.hervir.tiempo=+this.value;document.getElementById('her-tiempo').textContent=this.value">
        <button class="juego-btn" onclick="ejecutarPaso('hervir')">Ejecutar</button>`
    }
  ];

  const todosHechos = pasos.every(p => p.hecho);
  let html = `<div class="juego-coccion-pasos">`;
  pasos.forEach((p, i) => {
    html += `<div class="juego-paso ${p.hecho ? 'hecho' : ''}">
      <div class="juego-paso-header">
        <span class="juego-paso-icon">${p.hecho ? '\u2705' : p.icono}</span>
        <div class="juego-paso-info">
          <strong>${p.label}</strong>
          <span class="text-xs text-secondary">${p.desc}</span>
        </div>
      </div>
      <div class="juego-paso-control">${p.control}</div>
    </div>`;
  });
  html += `</div>`;
  if (todosHechos) {
    html += `<button class="juego-btn juego-btn-primary" onclick="confirmarCoccion()">Finalizar cocción</button>`;
  }
  cont.innerHTML = html;
}

function ejecutarPaso(key) {
  const c = JUEGO.data.coccion;
  switch (key) {
    case 'precalentar':
      c.precalentar.hecho = true;
      break;
    case 'azucar':
      c.azucar.hecho = true;
      break;
    case 'pectina':
      c.pectina.hecho = true;
      break;
    case 'hervir':
      c.hervir.hecho = true;
      break;
  }
  SFX.pop();
  renderizarCoccion();
}

function confirmarCoccion() {
  JUEGO.fasesCompletadas[2] = true;
  SFX.success();
  siguienteFase();
}

/* ======================== FASE 3: ENVASADO ======================== */

function confirmarEnvasado() {
  JUEGO.fasesCompletadas[3] = true;
  SFX.success();
  siguienteFase();
}

/* ======================== FASE 4: VENTA ======================== */

function confirmarVenta() {
  JUEGO.fasesCompletadas[4] = true;
  SFX.success();
  siguienteFase();
}

/* ======================== CÁLCULO DE CALIDAD ======================== */

function calcularResultados() {
  const ing = JUEGO.data.ingredientes;
  const lav = JUEGO.data.lavado;
  const coc = JUEGO.data.coccion;

  const parchitaKg = ing.parchita.kg;
  const azucarKg = ing.azucar.kg;
  const aguaL = ing.agua.L;
  const pectinaG = ing.pectina.g;
  const acidoG = ing.acido_citrico.g;

  const ratioAzucar = parchitaKg > 0 ? azucarKg / parchitaKg : 0;
  const tempCoccion = coc.hervir.temperatura;
  const tiempoCoccionS = coc.hervir.tiempo * 60;

  const dulzor = Math.round(Math.min(100, Math.max(0, 100 - Math.abs(ratioAzucar - 0.75) * 120)));
  const viscosidad = Math.round(Math.min(100, Math.max(0, (pectinaG / parchitaKg) * 5 + (tiempoCoccionS / 60) * 10)));
  const acidez = Math.round(Math.min(100, Math.max(0, 100 - Math.abs(tempCoccion - 85) * 4 - Math.abs(acidoG - 5) * 5)));
  const claridad = Math.round(Math.min(100, Math.max(0, lav.limpieza * (1 - Math.abs(lav.temperatura - 30) / 50))));
  const rendimiento = parchitaKg * 0.35 + aguaL * 0.9 - parchitaKg * 0.15;

  let colorHex;
  if (tempCoccion <= 85) colorHex = '#E8A137';
  else if (tempCoccion <= 95) colorHex = '#C67A2E';
  else colorHex = '#8B4513';

  const promedio = Math.round((dulzor + viscosidad + acidez + claridad) / 4);

  let rango, letra;
  if (promedio >= 90) { rango = 'S'; letra = 'S'; }
  else if (promedio >= 75) { rango = 'A'; letra = 'A'; }
  else if (promedio >= 55) { rango = 'B'; letra = 'B'; }
  else { rango = 'C'; letra = 'C'; }

  JUEGO.resultados = {
    dulzor, viscosidad, acidez, claridad,
    color: colorHex,
    rendimiento: Math.round(rendimiento * 100) / 100,
    promedio, rango, letra
  };
}

/* ======================== RENDERIZADO DE FASES ======================== */

function renderizarFase(idx) {
  const cont = document.getElementById('juego-fase-contenido');
  if (!cont) return;
  switch (idx) {
    case 0: return renderizarSeleccion();
    case 1: return renderizarLavado();
    case 2: return renderizarCoccion();
    case 3: return renderizarEnvasado();
    case 4: return renderizarVenta();
  }
}

function renderizarSeleccion() {
  const cont = document.getElementById('juego-fase-contenido');
  if (!cont) return;
  const ing = JUEGO.data.ingredientes;
  let html = `<div class="juego-grid-ingredientes">`;
  Object.entries(ing).forEach(([key, val]) => {
    const info = INGREDIENTES_BASE[key];
    const v = Object.values(val)[0];
    const k = Object.keys(val)[0];
    const u = info.unidad;
    html += `<div class="juego-ingrediente-card">
      <div class="juego-ing-header">
        <span>${info.icono}</span>
        <strong>${info.label}</strong>
        <span class="text-xs text-secondary">${v}${u}</span>
      </div>
      <input type="range" min="${info.min}" max="${info.max}" step="${info.paso}" value="${v}"
        oninput="ajustarIngrediente('${key}', this.value)">
      <div class="juego-ing-controls">
        <button class="juego-btn-ing" onclick="ajustarIngrediente('${key}', Math.max(${info.min}, ${v} - ${info.paso}))">−</button>
        <span class="juego-ing-valor">${v}${u}</span>
        <button class="juego-btn-ing" onclick="ajustarIngrediente('${key}', Math.min(${info.max}, ${v} + ${info.paso}))">+</button>
      </div>
    </div>`;
  });
  html += `</div>`;
  html += `<div class="mt-3 flex justify-center">
    <button class="juego-btn juego-btn-primary" onclick="confirmarSeleccion()">Confirmar selección</button>
  </div>`;
  cont.innerHTML = html;
}

function ajustarIngrediente(key, val) {
  const ing = JUEGO.data.ingredientes[key];
  const k = Object.keys(ing)[0];
  const clamped = Math.round(parseFloat(val) * 10) / 10 || parseFloat(val);
  ing[k] = clamped;
  renderizarSeleccion();
  SFX.tick();
}

function renderizarLavado() {
  const cont = document.getElementById('juego-fase-contenido');
  if (!cont) return;
  const d = JUEGO.data.lavado;
  cont.innerHTML = `
    <div class="juego-lavado-panel">
      <div class="juego-lavado-grid">
        <div class="juego-lavado-item">
          <label>Tiempo <span id="juego-lav-tiempo">${d.tiempo}</span> min</label>
          <input type="range" min="1" max="10" step="0.5" value="${d.tiempo}"
            oninput="JUEGO.data.lavado.tiempo=+this.value;document.getElementById('juego-lav-tiempo').textContent=this.value;actualizarLavado()">
        </div>
        <div class="juego-lavado-item">
          <label>Temperatura <span id="juego-lav-temp">${d.temperatura}</span>\u00B0C</label>
          <input type="range" min="5" max="60" value="${d.temperatura}"
            oninput="JUEGO.data.lavado.temperatura=+this.value;document.getElementById('juego-lav-temp').textContent=this.value;actualizarLavado()">
        </div>
        <div class="juego-lavado-item">
          <label>Velocidad <span id="juego-lav-vel">${d.velocidad}</span>%</label>
          <input type="range" min="10" max="100" step="5" value="${d.velocidad}"
            oninput="JUEGO.data.lavado.velocidad=+this.value;document.getElementById('juego-lav-vel').textContent=this.value;actualizarLavado()">
        </div>
      </div>
      <div class="juego-stat-bar mt-3">
        <span>Eficacia de limpieza:</span>
        <div class="stat-track"><div class="stat-fill" style="width:${d.limpieza}%"></div></div>
        <span class="stat-val" id="juego-lavado-limpieza">${d.limpieza}%</span>
      </div>
      <div class="flex justify-center mt-3">
        <button class="juego-btn juego-btn-primary" onclick="confirmarLavado()">Confirmar lavado</button>
      </div>
    </div>`;
}

function renderizarEnvasado() {
  const cont = document.getElementById('juego-fase-contenido');
  if (!cont) return;
  const d = JUEGO.data.envasado;
  cont.innerHTML = `
    <div class="juego-envasado-panel">
      <p class="text-xs text-secondary mb-3">Ajusta la boquilla y llena las botellas con precisión. Un llenado perfecto minimiza pérdidas.</p>
      <div class="juego-lavado-grid">
        <div class="juego-lavado-item">
          <label>Precisión <span id="env-precision">${d.precision}</span>%</label>
          <input type="range" min="20" max="100" step="1" value="${d.precision}"
            oninput="JUEGO.data.envasado.precision=+this.value;document.getElementById('env-precision').textContent=this.value">
        </div>
        <div class="juego-lavado-item">
          <label>Nivel de llenado <span id="env-llenado">${d.llenado}</span>%</label>
          <input type="range" min="50" max="100" step="1" value="${d.llenado}"
            oninput="JUEGO.data.envasado.llenado=+this.value;document.getElementById('env-llenado').textContent=this.value">
        </div>
        <div class="juego-lavado-item">
          <label>Botellas <span id="env-botellas">${d.botellas}</span></label>
          <input type="range" min="1" max="24" step="1" value="${d.botellas}"
            oninput="JUEGO.data.envasado.botellas=+this.value;document.getElementById('env-botellas').textContent=this.value">
        </div>
      </div>
      <div class="juego-stat-bar mt-2">
        <span>Eficiencia:</span>
        <div class="stat-track"><div class="stat-fill" style="width:${Math.round(d.precision * d.llenado / 100)}%"></div></div>
        <span class="stat-val">${Math.round(d.precision * d.llenado / 100)}%</span>
      </div>
      <div class="flex justify-center mt-3">
        <button class="juego-btn juego-btn-primary" onclick="confirmarEnvasado()">Confirmar envasado</button>
      </div>
    </div>`;
}

function renderizarVenta() {
  const cont = document.getElementById('juego-fase-contenido');
  if (!cont) return;
  const d = JUEGO.data.venta;
  const niveles = [
    { key: 'bajo', label: 'Estante bajo', desc: 'Fácil alcance, menos visibilidad' },
    { key: 'medio', label: 'Estante medio', desc: 'Visibilidad óptima, precio justo' },
    { key: 'alto', label: 'Estante alto', desc: 'Mayor exposición, más competencia' }
  ];
  let nivelesHtml = niveles.map(n => `
    <label class="juego-estante-opcion ${d.estante === n.key ? 'seleccionado' : ''}"
      onclick="JUEGO.data.venta.estante='${n.key}';renderizarVenta();SFX.tick()">
      <input type="radio" name="estante" value="${n.key}" ${d.estante === n.key ? 'checked' : ''} class="hidden">
      <span class="juego-estante-icono">${n.key === 'alto' ? '\u{1F4F6}' : n.key === 'medio' ? '\u{1F4CB}' : '\u{1F6CD}'}</span>
      <span class="font-medium">${n.label}</span>
      <span class="text-xs text-secondary">${n.desc}</span>
    </label>
  `).join('');

  const ajusteEstante = d.estante === 'alto' ? 1.3 : d.estante === 'medio' ? 1.0 : 0.8;
  const precioEfectivo = (d.precio * ajusteEstante);

  cont.innerHTML = `
    <div class="juego-venta-panel">
      <div class="juego-estante-selector">
        ${nivelesHtml}
      </div>
      <div class="juego-lavado-item mt-3">
        <label>Precio por botella: $<span id="venta-precio">${d.precio.toFixed(2)}</span></label>
        <input type="range" min="2" max="15" step="0.25" value="${d.precio}"
          oninput="JUEGO.data.venta.precio=+this.value;document.getElementById('venta-precio').textContent=this.value.toFixed(2)">
      </div>
      <div class="juego-stat-bar mt-2">
        <span>Precio efectivo:</span>
        <span class="font-bold text-primary">$${precioEfectivo.toFixed(2)}</span>
      </div>
      <div class="flex justify-center mt-3">
        <button class="juego-btn juego-btn-primary" onclick="confirmarVenta()">Confirmar venta</button>
      </div>
    </div>`;
}

/* ======================== RESULTADOS ======================== */

function mostrarResultados() {
  const r = JUEGO.resultados;
  if (!r) return;
  const cont = document.getElementById('juego-fase-contenido');
  const overlay = document.getElementById('juego-resultados');
  if (cont) cont.innerHTML = '';

  const badgeClass = r.rango === 'S' ? 'rango-s' : r.rango === 'A' ? 'rango-a' : r.rango === 'B' ? 'rango-b' : 'rango-c';

  if (overlay) {
    overlay.innerHTML = `
      <div class="juego-resultados-inner">
        <div class="juego-rango-badge ${badgeClass}">${r.letra}</div>
        <h2 class="text-xl font-bold mt-2">Puntuación: ${r.promedio}/100</h2>
        <div class="juego-resultados-grid mt-4">
          <div class="juego-resultado-item">
            <span class="juego-stat-label">Dulzor</span>
            <div class="stat-track"><div class="stat-fill" style="width:${r.dulzor}%"></div></div>
            <span class="juego-stat-valor">${r.dulzor}</span>
          </div>
          <div class="juego-resultado-item">
            <span class="juego-stat-label">Viscosidad</span>
            <div class="stat-track"><div class="stat-fill" style="width:${r.viscosidad}%"></div></div>
            <span class="juego-stat-valor">${r.viscosidad}</span>
          </div>
          <div class="juego-resultado-item">
            <span class="juego-stat-label">Acidez</span>
            <div class="stat-track"><div class="stat-fill" style="width:${r.acidez}%"></div></div>
            <span class="juego-stat-valor">${r.acidez}</span>
          </div>
          <div class="juego-resultado-item">
            <span class="juego-stat-label">Claridad</span>
            <div class="stat-track"><div class="stat-fill" style="width:${r.claridad}%"></div></div>
            <span class="juego-stat-valor">${r.claridad}</span>
          </div>
        </div>
        <div class="juego-resultados-info mt-3">
          <span>Color: <span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:${r.color};vertical-align:middle"></span></span>
          <span>Rendimiento: ${r.rendimiento}L</span>
        </div>
        <div class="flex gap-2 mt-4 justify-center">
          <button class="juego-btn juego-btn-primary" onclick="iniciarJuego()">Jugar de nuevo</button>
          <button class="juego-btn" onclick="salirDelJuego()">Volver al modo libre</button>
        </div>
      </div>`;
    overlay.style.display = 'flex';
    SFX.fanfare();
  }
}

/* ======================== HUD ======================== */

function actualizarHUD() {
  const dots = document.querySelectorAll('.juego-dot');
  dots.forEach((d, i) => {
    d.classList.toggle('active', i === JUEGO.fase);
    d.classList.toggle('completado', JUEGO.fasesCompletadas[i]);
  });
  document.getElementById('juego-fase-titulo').textContent = FASES[JUEGO.fase].nombre;
  document.getElementById('juego-fase-icono').textContent = FASES[JUEGO.fase].icono;
  document.getElementById('juego-fase-desc').textContent = FASES[JUEGO.fase].desc;
}

/* ======================== SALIR ======================== */

function salirDelJuego() {
  JUEGO.activo = false;
  const overlay = document.getElementById('juego-resultados');
  if (overlay) overlay.style.display = 'none';
  if (typeof mostrarVista3D === 'function') mostrarVista3D();
  SFX.chime();
}

/* ======================== TOAST ======================== */

function mostrarToast(msg, tipo) {
  const t = document.createElement('div');
  t.className = 'juego-toast ' + (tipo || 'info');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
}
