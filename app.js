/* ======================== STATE ======================== */
const DEFAULT_STATE = {
  ingredientes: {
    parchita: { kg: 2, precio: 4.50 },
    azucar: { kg: 2, precio: 1.20 },
    agua: { L: 3, precio: 0.30 },
    pectina: { g: 80, precio_g: 0.04 },
    acido_citrico: { g: 10, precio_g: 0.03 },
    sorbato_potasio: { g: 5, precio_g: 0.05 }
  },
  costos: {
    merma_pct: 15,
    mano_obra: 5,
    servicios: 2,
    transporte: 1.50,
    etiqueta_unidad: 0.15,
    envases: [
      { ml: 250, precio_compra: 0.45, precio_venta: 1.50 },
      { ml: 500, precio_compra: 0.55, precio_venta: 3.00 },
      { ml: 1000, precio_compra: 0.75, precio_venta: 6.50 },
      { ml: 2000, precio_compra: 1.20, precio_venta: 12.00 }
    ]
  },
  parchita: {
    peso_promedio_g: 70,
    pct_jugo: 35,
    pct_cascara: 45,
    pct_semillas: 20,
    precio_cascara_kg: 1.00,
    precio_semillas_kg: 5.00
  },
  ui: { tab: 'calculadora', editando_id: null, compare: [], filtros: { busqueda: '', fecha_desde: '', fecha_hasta: '', roi_min: '', orden: 'desc' } },
  productos: [],
  historial: [],
  proveedores: [
    { id: 'prov_default', nombre: 'Proveedor por defecto', contacto: '', items: [
      { ingrediente: 'parchita', precio: 4.50 },
      { ingrediente: 'azucar', precio: 1.20 },
      { ingrediente: 'agua', precio: 0.30 },
      { ingrediente: 'pectina', precio_g: 0.04 },
      { ingrediente: 'acido_citrico', precio_g: 0.03 },
      { ingrediente: 'sorbato_potasio', precio_g: 0.05 }
    ]}
  ],
  planificacion: []
};

let state = {};
let costChart = null;
let breakevenChart = null;
let historyChart = null;
let radarChart = null;

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function loadState() {
  try {
    const saved = localStorage.getItem('parchita_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      state = stripDangerousKeys(parsed);
      for (const key in DEFAULT_STATE) {
        if (!(key in state)) state[key] = deepClone(DEFAULT_STATE[key]);
        else if (typeof DEFAULT_STATE[key] === 'object' && !Array.isArray(DEFAULT_STATE[key])) {
          for (const sub in DEFAULT_STATE[key]) {
            if (!(sub in state[key])) state[key][sub] = deepClone(DEFAULT_STATE[key][sub]);
          }
        }
      }
    } else {
      state = deepClone(DEFAULT_STATE);
    }
  } catch(e) { state = deepClone(DEFAULT_STATE); }
}

function saveState() {
  try { localStorage.setItem('parchita_state', JSON.stringify(state)); } catch(e) {}
}

// ======================== UI HELPERS ========================
const $ = id => document.getElementById(id);

function esc(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]
  );
}

function safeNumber(v, min, max, fallback) {
  const n = parseFloat(v);
  if (isNaN(n) || !isFinite(n)) return fallback !== undefined ? fallback : 0;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

function stripDangerousKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  delete obj.__proto__;
  delete obj.constructor;
  delete obj.prototype;
  for (const key of Object.keys(obj)) stripDangerousKeys(obj[key]);
  return obj;
}

function setVal(id, val, suffix='') {
  const el = $(id);
  if (el) el.textContent = typeof val === 'number' ? val.toFixed(val < 10 ? 2 : 1) + suffix : val + suffix;
}

function showToast(msg, type) {
  const c = $('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (type || 'info');
  t.innerHTML = msg;
  c.appendChild(t);
  setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
}

// ======================== PURE CALCULATION FUNCTIONS ========================
function calcCostosIngredientes(i) {
  return {
    parchita: i.parchita.kg * i.parchita.precio,
    azucar: i.azucar.kg * i.azucar.precio,
    agua: i.agua.L * i.agua.precio,
    pectina: i.pectina.g * i.pectina.precio_g,
    acido: i.acido_citrico.g * i.acido_citrico.precio_g,
    sorbato: i.sorbato_potasio.g * i.sorbato_potasio.precio_g
  };
}

function calcRendimiento(pesoTotal, mermaPct) {
  return pesoTotal * (1 - mermaPct / 100);
}

function calcResiduos(parchitaKg, p) {
  const pesoFrutoKg = p.peso_promedio_g / 1000;
  const numFrutas = Math.round(parchitaKg / pesoFrutoKg);
  const cascaraKg = parchitaKg * (p.pct_cascara / 100);
  const semillasKg = parchitaKg * (p.pct_semillas / 100);
  const jugoL = parchitaKg * (p.pct_jugo / 100);
  return { numFrutas, cascaraKg, semillasKg, jugoL, totalResiduo: cascaraKg + semillasKg };
}

function calcEnvases(rendimientoBruto, totalCostosFijos, envases, etiquetaUnidad, totalIngredientes, costosOperativos, valorTotalResiduos) {
  return envases.map(e => {
    const capL = e.ml / 1000;
    const unidades = Math.floor(rendimientoBruto / capL);
    const totalEnvase = unidades > 0 ? unidades * (e.precio_compra + etiquetaUnidad) : 0;
    const costoTotalLote = totalCostosFijos + totalEnvase;
    const ingresoTotal = unidades * e.precio_venta;
    const roi = costoTotalLote > 0 ? ((ingresoTotal - costoTotalLote) / costoTotalLote) * 100 : 0;
    const costNeto = Math.max(0.01, costoTotalLote - valorTotalResiduos);
    const roiAjustado = ((ingresoTotal - costNeto) / costNeto) * 100;
    const costUnitario = unidades > 0 ? (totalCostosFijos / unidades) + e.precio_compra + etiquetaUnidad : 0;
    const gananciaUnidad = e.precio_venta - costUnitario;
    const viable = ingresoTotal > costoTotalLote;
    return { ...e, capL, unidades, costUnitario, gananciaUnidad, totalEnvase, ingresoTotal, costoTotalLote, roi, roiAjustado, viable };
  });
}

function calcCO2(totalResiduo) {
  const co2Ahorrado = totalResiduo * 0.5;
  return {
    co2Ahorrado,
    co2Km: co2Ahorrado / 0.12,
    co2Arboles: co2Ahorrado / 21.8
  };
}

function getCalculos() {
  const i = state.ingredientes;
  const c = state.costos;
  const p = state.parchita;

  const costIngredientes = calcCostosIngredientes(i);
  const totalIngredientes = Object.values(costIngredientes).reduce((a,b) => a+b, 0);
  const pesoTotal = i.parchita.kg + i.azucar.kg + i.agua.L;
  const rendimientoBruto = calcRendimiento(pesoTotal, c.merma_pct);

  const residuos = calcResiduos(i.parchita.kg, p);
  const valorCascara = residuos.cascaraKg * p.precio_cascara_kg;
  const valorSemillas = residuos.semillasKg * p.precio_semillas_kg;
  const valorTotalResiduos = valorCascara + valorSemillas;

  const costosOperativosFijos = c.mano_obra + c.servicios + c.transporte;
  const totalCostosFijos = totalIngredientes + costosOperativosFijos;

  const envasesDetalle = calcEnvases(rendimientoBruto, totalCostosFijos, c.envases, c.etiqueta_unidad, totalIngredientes, costosOperativosFijos, valorTotalResiduos);
  const refEnvase = envasesDetalle.find(e => e.ml === 1000) || envasesDetalle[0];
  const co2 = calcCO2(residuos.totalResiduo);

  return {
    costIngredientes, totalIngredientes,
    rendimientoBruto, pesoTotal,
    ...residuos,
    valorCascara, valorSemillas, valorTotalResiduos,
    costosOperativosFijos, totalCostosFijos,
    envasesDetalle, refEnvase,
    ...co2
  };
}

// ======================== INPUT VALIDATION ========================
function validateInput(el) {
  if (!el || !el.tagName) return true;
  const type = el.type || '';
  if (type === 'number') {
    const val = parseFloat(el.value);
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || Infinity;
    const valid = !isNaN(val) && val >= min && val <= max;
    el.classList.toggle('error', !valid);
    return valid;
  }
  return true;
}

function validateAll() {
  let allValid = true;
  document.querySelectorAll('input[type="number"]').forEach(el => {
    if (!validateInput(el)) allValid = false;
  });
  return allValid;
}

// ======================== UPDATES ========================
function updateSimple(path, value) {
  const keys = path.split('.');
  let obj = state;
  for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
  obj[keys[keys.length - 1]] = safeNumber(value, 0);
  saveState();
  renderAll();
}

function updateIngrediente(name, field, value) {
  state.ingredientes[name][field] = safeNumber(value, 0);
  saveState();
  renderAll();
}

function updateEnvase(idx, field, value) {
  state.costos.envases[idx][field] = safeNumber(value, 0);
  saveState();
  renderAll();
}

// ======================== TAB SYSTEM ========================
function switchTab(tab) {
  state.ui.tab = tab;
  saveState();
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const content = $(`tab-${tab}`);
  if (content) content.classList.add('active');
  const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  const navItem = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (navItem) navItem.classList.add('active');
  renderAll();
  if (window.innerWidth <= 768) toggleSidebar(false);
}

function toggleSidebar(force) {
  const sb = $('sidebar');
  const ov = $('sidebar-overlay');
  if (!sb) return;
  const opening = force === undefined ? !sb.classList.contains('open') : force;
  sb.classList.toggle('open', opening);
  ov.classList.toggle('open', opening);
  document.body.style.overflow = opening ? 'hidden' : '';
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next = isDark ? '' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('parchita_theme', next);
  const btn = $('theme-btn');
  if (btn) btn.innerHTML = next === 'dark' ? '<i class="fas fa-sun"></i> <span>Claro</span>' : '<i class="fas fa-moon"></i> <span>Oscuro</span>';
  const mobileBtn = $('theme-btn-mobile');
  if (mobileBtn) mobileBtn.innerHTML = next === 'dark' ? '<i class="fas fa-sun"></i> <span>Claro</span>' : '<i class="fas fa-moon"></i> <span>Oscuro</span>';
}

// ======================== PHASE 4: PROVEEDORES ========================
function renderProveedores() {
  const cont = $('proveedores-container');
  if (!cont) return;
  const provs = state.proveedores || [];
  const ingredLabels = { parchita: 'Parchita', azucar: 'Azúcar', agua: 'Agua', pectina: 'Pectina', acido_citrico: 'Ác.cítrico', sorbato_potasio: 'Sorbato K' };
  const ingredKeys = ['parchita', 'azucar', 'agua', 'pectina', 'acido_citrico', 'sorbato_potasio'];

  if (!provs.length) {
    cont.innerHTML = '<p class="text-secondary text-sm">Sin proveedores registrados</p>';
    return;
  }

  let html = '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-secondary border-b border-subtle"><th class="text-left py-1">Proveedor</th>';
  ingredKeys.forEach(k => { html += `<th class="text-right py-1 px-1">${ingredLabels[k].split(' ')[1]}</th>`; });
  html += '<th class="text-right py-1"></th></tr></thead><tbody>';

  provs.forEach((p, idx) => {
    html += `<tr class="border-b border-subtle/50 hover:bg-amber-50/50">
      <td class="py-1 font-medium">${esc(p.nombre)}</td>`;
    ingredKeys.forEach(k => {
      const item = p.items.find(i => i.ingrediente === k);
      const precio = item ? (k === 'pectina' || k === 'acido_citrico' || k === 'sorbato_potasio' ? item.precio_g : item.precio) : 0;
      html += `<td class="text-right py-1 px-1">$${Number(precio).toFixed(2)}</td>`;
    });
    html += `<td class="text-right py-1">
      <button class="load-supplier-btn text-blue-500 hover:text-blue-700 text-xs px-1" data-supplier-idx="${idx}" title="Usar precios"><i class="fas fa-check-circle"></i></button>
      <button class="delete-supplier-btn text-red-400 hover:text-red-600 text-xs px-1" data-supplier-idx="${idx}" title="Eliminar"><i class="fas fa-trash"></i></button>
    </td></tr>`;
  });
  html += '</tbody></table></div>';
  cont.innerHTML = html;
}

function cargarPreciosProveedor(idx) {
  const prov = state.proveedores[idx];
  if (!prov) return;
  prov.items.forEach(item => {
    const key = `ingredientes.${item.ingrediente}.${item.ingrediente === 'pectina' || item.ingrediente === 'acido_citrico' || item.ingrediente === 'sorbato_potasio' ? 'precio_g' : 'precio'}`;
    const keys = key.split('.');
    let obj = state;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = item.precio_g !== undefined ? item.precio_g : item.precio;
  });
  saveState();
  renderAll();
  showToast(`Precios de ${prov.nombre} cargados`, 'success');
}

function agregarProveedor() {
  const nombre = prompt('Nombre del proveedor:');
  if (!nombre || !nombre.trim()) return;
  const id = 'prov_' + Date.now().toString(36);
  const items = ['parchita', 'azucar', 'agua', 'pectina', 'acido_citrico', 'sorbato_potasio'].map(ing => {
    def = { ingrediente: ing };
    if (ing === 'pectina' || ing === 'acido_citrico' || ing === 'sorbato_potasio') def.precio_g = 0.01;
    else def.precio = 0.01;
    return def;
  });
  state.proveedores.push({ id, nombre: nombre.trim(), contacto: '', items });
  saveState();
  renderProveedores();
  showToast('Proveedor agregado', 'success');
}

// ======================== PHASE 4: PLANIFICACIÓN ========================
function renderPlanificacion() {
  const cont = $('planificacion-container');
  if (!cont) return;
  const planes = state.planificacion || [];

  if (!planes.length) {
    cont.innerHTML = '<p class="text-secondary text-sm">Sin producción planificada.</p>';
    return;
  }

  cont.innerHTML = planes.map((p, idx) => `
    <div class="flex items-center justify-between p-3 bg-primary-light rounded-xl border border-subtle ${p.estado === 'completado' ? 'opacity-60' : ''}">
      <div class="flex items-center gap-3">
        <span class="text-lg">${p.estado === 'completado' ? '✅' : p.estado === 'cancelado' ? '❌' : '⏳'}</span>
        <div>
          <div class="font-medium text-sm">${esc(p.fecha || '')}${p.notas ? ' — ' + esc(p.notas) : ''}</div>
          <div class="text-xs text-secondary">${p.estado === 'completado' ? 'Completado' : p.estado === 'cancelado' ? 'Cancelado' : 'Pendiente'}</div>
        </div>
      </div>
      <div class="flex gap-1">
        ${p.estado === 'pendiente' ? `<button class="complete-plan-btn text-green-500 hover:text-green-700 text-xs px-2 py-1" data-plan-idx="${idx}"><i class="fas fa-check"></i></button>` : ''}
        ${p.estado === 'pendiente' ? `<button class="cancel-plan-btn text-amber-500 hover:text-amber-700 text-xs px-2 py-1" data-plan-idx="${idx}"><i class="fas fa-ban"></i></button>` : ''}
        <button class="delete-plan-btn text-red-400 hover:text-red-600 text-xs px-2 py-1" data-plan-idx="${idx}"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function agregarPlanificacion() {
  const fecha = $('input-plan-fecha')?.value || new Date().toISOString().slice(0, 10);
  const notas = $('input-plan-notas')?.value.trim() || '';
  if (!notas) { showToast('Describe la producción planificada', 'error'); return; }
  state.planificacion.unshift({
    id: Date.now().toString(36),
    fecha,
    notas,
    estado: 'pendiente'
  });
  saveState();
  renderPlanificacion();
  $('input-plan-notas').value = '';
  showToast('Producción planificada', 'success');
}

function completarPlan(idx) {
  if (state.planificacion[idx]) state.planificacion[idx].estado = 'completado';
  saveState();
  renderPlanificacion();
}

function cancelarPlan(idx) {
  if (state.planificacion[idx]) state.planificacion[idx].estado = 'cancelado';
  saveState();
  renderPlanificacion();
}

function eliminarPlan(idx) {
  if (!confirm('¿Eliminar esta planificación?')) return;
  state.planificacion.splice(idx, 1);
  saveState();
  renderPlanificacion();
}

// ======================== PHASE 4: FILTROS HISTORIAL ========================
function aplicarFiltros() {
  state.ui.filtros.busqueda = ($('filtro-busqueda')?.value || '').toLowerCase();
  state.ui.filtros.fecha_desde = $('filtro-fecha-desde')?.value || '';
  state.ui.filtros.fecha_hasta = $('filtro-fecha-hasta')?.value || '';
  state.ui.filtros.roi_min = $('filtro-roi-min')?.value || '';
  saveState();
  renderHistorial();
}

function filtrarHistorial(lista) {
  const f = state.ui.filtros;
  let result = [...lista];
  if (f.busqueda) result = result.filter(r => (r.receta || '').toLowerCase().includes(f.busqueda) || (r.lote || '').toLowerCase().includes(f.busqueda));
  if (f.fecha_desde) result = result.filter(r => r.fecha >= f.fecha_desde);
  if (f.fecha_hasta) result = result.filter(r => r.fecha <= f.fecha_hasta);
  if (f.roi_min) result = result.filter(r => (r.roi || 0) >= Number(f.roi_min));
  if (f.orden === 'asc') result.reverse();
  return result;
}

// ======================== RENDER ========================
let renderTimeout = null;
function renderAll() {
  if (renderTimeout) cancelAnimationFrame(renderTimeout);
  renderTimeout = requestAnimationFrame(() => {
    const tab = state.ui.tab;
    if (tab === 'calculadora') renderCalculadora();
    else if (tab === 'residuos') renderResiduos();
    else if (tab === 'productos') renderProductos();
    else if (tab === 'historial') renderHistorial();
    else if (tab === 'dashboard') renderDashboard();
    renderShared();
    renderProveedores();
    renderPlanificacion();
    // Refresh validation
    document.querySelectorAll('input.error').forEach(el => validateInput(el));
  });
}

function renderShared() {
  document.querySelectorAll('.slider-group').forEach(el => {
    const key = el.dataset.key;
    if (!key) return;
    const keys = key.split('.');
    let obj = state;
    for (let k of keys) obj = obj[k];
    if (obj === undefined) return;
    const slider = el.querySelector('input[type="range"]');
    const numInput = el.querySelector('.slider-num');
    if (slider) { slider.value = obj; }
    if (numInput) { numInput.value = obj; }
  });

  document.querySelectorAll('.precio-input').forEach(el => {
    const key = el.dataset.key;
    if (!key) return;
    const keys = key.split('.');
    let obj = state;
    for (let k of keys) obj = obj[k];
    if (obj !== undefined) el.value = obj;
  });

  const slMerma = $('slider-merma');
  if (slMerma) { slMerma.value = state.costos.merma_pct; $('val-merma').textContent = state.costos.merma_pct; }

  const inpMO = $('input-mano-obra');
  if (inpMO) inpMO.value = state.costos.mano_obra;
  const inpServ = $('input-servicios');
  if (inpServ) inpServ.value = state.costos.servicios;
  const inpTrans = $('input-transporte');
  if (inpTrans) inpTrans.value = state.costos.transporte;
  const inpEt = $('input-etiqueta');
  if (inpEt) inpEt.value = state.costos.etiqueta_unidad;

  renderEnvasePriceInputs();

  const inpPF = $('input-peso-fruto');
  if (inpPF) inpPF.value = state.parchita.peso_promedio_g;
  const inpPJ = $('input-pct-jugo');
  if (inpPJ) inpPJ.value = state.parchita.pct_jugo;
  const inpPC = $('input-pct-cascara');
  if (inpPC) inpPC.value = state.parchita.pct_cascara;
  const inpPS = $('input-pct-semillas');
  if (inpPS) inpPS.value = state.parchita.pct_semillas;

  // Sidebar summary
  const calc = getCalculos();
  const ref = calc.envasesDetalle.find(e => e.ml === 1000) || calc.envasesDetalle[0];
  const totalCost = calc.totalIngredientes + calc.costosOperativosFijos;
  const totalConEnvase = ref ? ref.costoTotalLote : totalCost;
  const roiFinal = ref ? ref.roiAjustado : 0;
  const viable = roiFinal > 0;
  const sbCosto = $('sb-costo');
  if (sbCosto) sbCosto.textContent = `$${totalConEnvase.toFixed(2)}`;
  const sbRend = $('sb-rendimiento');
  if (sbRend) sbRend.textContent = `${calc.rendimientoBruto.toFixed(1)} L`;
  const sbRoi = $('sb-roi');
  if (sbRoi) { sbRoi.textContent = `${roiFinal.toFixed(1)}%`; sbRoi.className = `value ${viable ? 'success' : ''}`; }
  const sbEst = $('sb-estado');
  if (sbEst) { sbEst.textContent = viable ? '✅ VIABLE' : '❌ NO VIABLE'; sbEst.className = `value ${viable ? 'success' : ''}`; }
  const sbCo2 = $('sb-co2');
  if (sbCo2) sbCo2.textContent = `${calc.co2Ahorrado.toFixed(1)} kg`;
  const sbIng = $('sb-ingreso');
  if (sbIng) sbIng.textContent = ref ? `$${ref.ingresoTotal.toFixed(2)}` : '$0.00';
}

function renderCalculadora() {
  const calc = getCalculos();
  const c = state.costos;

  const bd = $('cost-breakdown');
  const icn = (fa, style) => `<i class="fas fa-${fa}" style="width:16px;text-align:center;${style||''}"></i>`;
  bd.innerHTML = `
    <div class="flex justify-between"><span>${icn('apple-alt','color:#E8A137')} Parchita (${state.ingredientes.parchita.kg}kg)</span><span>$${calc.costIngredientes.parchita.toFixed(2)}</span></div>
    <div class="flex justify-between"><span>${icn('cube','color:#D4A853')} Azúcar (${state.ingredientes.azucar.kg}kg)</span><span>$${calc.costIngredientes.azucar.toFixed(2)}</span></div>
    <div class="flex justify-between"><span>${icn('tint','color:#4A90D9')} Agua (${state.ingredientes.agua.L}L)</span><span>$${calc.costIngredientes.agua.toFixed(2)}</span></div>
    <div class="flex justify-between"><span>${icn('flask','color:#8B5CF6')} Pectina (${state.ingredientes.pectina.g}g)</span><span>$${calc.costIngredientes.pectina.toFixed(2)}</span></div>
    <div class="flex justify-between"><span>${icn('vial','color:#F59E0B')} Ácido cítrico (${state.ingredientes.acido_citrico.g}g)</span><span>$${calc.costIngredientes.acido.toFixed(2)}</span></div>
    <div class="flex justify-between"><span>${icn('prescription-bottle','color:#EC4899')} Sorbato K (${state.ingredientes.sorbato_potasio.g}g)</span><span>$${calc.costIngredientes.sorbato.toFixed(2)}</span></div>
    <div class="flex justify-between pt-1 border-t border-subtle font-medium"><span>${icn('shopping-basket')} Total ingredientes</span><span>$${calc.totalIngredientes.toFixed(2)}</span></div>
    <div class="flex justify-between"><span>${icn('hard-hat','color:#E8751A')} Mano de obra</span><span>$${c.mano_obra.toFixed(2)}</span></div>
    <div class="flex justify-between"><span>${icn('bolt','color:#F59E0B')} Servicios</span><span>$${c.servicios.toFixed(2)}</span></div>
    <div class="flex justify-between"><span>${icn('truck','color:#6B7280')} Transporte</span><span>$${c.transporte.toFixed(2)}</span></div>
  `;

  const totalConOp = calc.totalIngredientes + c.mano_obra + c.servicios + c.transporte;
  $('cost-total').innerHTML = `<span>Costo total lote</span><span class="text-primary">$${totalConOp.toFixed(2)}</span>`;

  $('display-rendimiento').textContent = calc.rendimientoBruto.toFixed(2);

  const tb = $('envases-table');
  tb.innerHTML = calc.envasesDetalle.map(e => {
    const isViable = e.roi > 0;
    return `<tr class="border-b border-subtle/50">
      <td class="py-2" data-label="Envase">${e.ml >= 1000 ? e.ml/1000+'L' : e.ml+'ml'}</td>
      <td class="text-right py-2 font-medium" data-label="Unids">${e.unidades}</td>
      <td class="text-right py-2" data-label="$/ud">$${e.costUnitario.toFixed(2)}</td>
      <td class="text-right py-2 font-medium" data-label="Precio">$${e.precio_venta.toFixed(2)}</td>
      <td class="text-right py-2 font-semibold ${isViable ? 'text-success' : 'text-red-500'}" data-label="Ganancia">${isViable ? '+' : ''}$${e.gananciaUnidad.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const ref = calc.envasesDetalle.find(e => e.ml === 1000) || calc.envasesDetalle[0];
  const roi = ref ? ref.roi : 0;
  const viable = roi > 0;
  $('roi-display').innerHTML = `
    <div class="${viable ? 'viable' : 'not-viable'}">
      <i class="fas fa-${viable ? 'check-circle' : 'times-circle'} mr-1"></i>
      ROI: ${roi.toFixed(1)}% — ${viable ? '✅ VIABLE' : '❌ NO VIABLE'}
    </div>
    <div class="text-xs text-secondary mt-1">Basado en envase de 1L · Ingreso total: $${ref ? ref.ingresoTotal.toFixed(2) : '0.00'}</div>
  `;

  renderEnvasePriceInputs();
}

function renderEnvasePriceInputs() {
  const grid = $('envase-prices-grid');
  if (!grid) return;
  grid.innerHTML = state.costos.envases.map((e, idx) => `
    <div class="bg-primary-light rounded-lg border border-subtle p-2">
      <div class="font-semibold text-default mb-1">${e.ml >= 1000 ? e.ml/1000+'L' : e.ml+'ml'}</div>
      <label class="text-secondary">Compra $</label>
      <input type="number" class="envase-compra-${idx} w-full mt-0.5 text-xs" step="0.05" value="${e.precio_compra}" data-envase-compra="${idx}">
      <label class="text-secondary mt-1 block">Venta $</label>
      <input type="number" class="envase-venta-${idx} w-full mt-0.5 text-xs" step="0.05" value="${e.precio_venta}" data-envase-venta="${idx}">
    </div>
  `).join('');
}

function renderResiduos() {
  const calc = getCalculos();

  $('disp-peso-fruto').textContent = state.parchita.peso_promedio_g;
  $('disp-frutos').textContent = calc.numFrutas;
  $('disp-cascara').textContent = calc.cascaraKg.toFixed(3);
  $('disp-semillas').textContent = calc.semillasKg.toFixed(3);
  $('disp-jugo').textContent = calc.jugoL.toFixed(3);
  $('disp-total-residuo').textContent = calc.totalResiduo.toFixed(3);

  $('disp-valor-cascara').textContent = `$${calc.valorCascara.toFixed(2)}`;
  $('disp-valor-semillas').textContent = `$${calc.valorSemillas.toFixed(2)}`;
  $('disp-valor-total-residuos').textContent = `$${calc.valorTotalResiduos.toFixed(2)}`;

  $('disp-co2').textContent = calc.co2Ahorrado.toFixed(1);
  $('disp-co2-km').textContent = calc.co2Km.toFixed(0);
  $('disp-co2-arboles').textContent = calc.co2Arboles.toFixed(2);

  const ref = calc.envasesDetalle.find(e => e.ml === 1000) || calc.envasesDetalle[0];
  $('disp-roi-base').textContent = ref ? `${ref.roi.toFixed(1)}%` : '0%';
  $('disp-roi-ajustado').textContent = ref ? `${ref.roiAjustado.toFixed(1)}%` : '0%';
}

function renderProductos() {
  const list = $('productos-list');
  const prods = state.productos;
  const compare = state.ui.compare || [];

  if (!prods || prods.length === 0) {
    list.innerHTML = `<p class="text-secondary text-sm col-span-full text-center py-8"><i class="fas fa-inbox mr-2"></i>No hay productos guardados. Calcula una receta y guárdala.</p>`;
    return;
  }

  list.innerHTML = prods.map((p, idx) => {
    const isSelected = compare.includes(p.id);
    return `
    <div class="card p-4 hover:shadow-md transition ${isSelected ? 'ring-2 ring-primary' : ''}">
      <div class="flex items-start justify-between">
        <h3 class="font-semibold text-sm flex-1 min-w-0 truncate" title="${esc(p.nombre || 'Producto')}">${esc(p.nombre || 'Producto')}</h3>
        <div class="flex gap-1 flex-shrink-0">
          <button class="compare-btn text-xs px-2 py-1 rounded-lg ${isSelected ? 'bg-primary text-white' : 'border border-subtle hover:bg-amber-50'}" data-compare-id="${p.id}" title="Comparar">${isSelected ? '<i class="fas fa-check"></i>' : '<i class="fas fa-balance-scale"></i>'}</button>
          <button class="delete-product-btn text-red-400 hover:text-red-600 text-xs px-2 py-1" data-prod-idx="${idx}"><i class="fas fa-times"></i></button>
        </div>
      </div>
      <div class="text-xs text-secondary mt-2 space-y-0.5">
        <div><i class="fas fa-apple-alt" style="color:#E8A137;width:14px"></i> ${safeNumber(p.parchita,0)}kg · <i class="fas fa-cube" style="color:#D4A853;width:14px"></i> ${safeNumber(p.azucar,0)}kg · <i class="fas fa-tint" style="color:#4A90D9;width:14px"></i> ${safeNumber(p.agua,0)}L</div>
        <div><i class="fas fa-flask" style="color:#8B5CF6;width:14px"></i> ${safeNumber(p.pectina,0)}g · <i class="fas fa-vial" style="color:#F59E0B;width:14px"></i> ${safeNumber(p.acido_citrico,0)}g ácido</div>
      </div>
      <div class="mt-2 flex gap-1">
        <span class="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">${esc(p.fecha || '')}</span>
        <button class="load-product-btn text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full hover:bg-green-200" data-prod-idx="${idx}"><i class="fas fa-check"></i> Cargar</button>
      </div>
    </div>`;
  }).join('');
}

function toggleCompare(id) {
  const compare = state.ui.compare || [];
  const idx = compare.indexOf(id);
  if (idx >= 0) { compare.splice(idx, 1); }
  else if (compare.length < 2) { compare.push(id); }
  else { compare.shift(); compare.push(id); }
  state.ui.compare = compare;
  saveState();
  renderAll();
}

function renderHistorial() {
  const body = $('historial-body');
  const empty = $('historial-empty');
  const h = state.historial || [];

  // Sync filter inputs with state
  ['filtro-busqueda', 'filtro-fecha-desde', 'filtro-fecha-hasta', 'filtro-roi-min'].forEach(id => {
    const el = $(id);
    if (el) el.value = state.ui.filtros[id.replace('filtro-', '')] || '';
  });
  const sortBtn = $('filtro-sort');
  if (sortBtn) sortBtn.innerHTML = state.ui.filtros.orden === 'asc' ? '<i class="fas fa-arrow-up"></i> Asc' : '<i class="fas fa-arrow-down"></i> Desc';

  const filtrada = filtrarHistorial(h);

  if (!filtrada.length) {
    body.innerHTML = h.length ? '<tr><td colspan="7" class="text-center text-secondary py-4">Sin resultados con los filtros actuales</td></tr>' : '';
    empty.classList.toggle('hidden', h.length > 0);
    return;
  }
  empty.classList.add('hidden');

  body.innerHTML = filtrada.map((r, idx) => {
    const realIdx = h.indexOf(r);
    return `<tr class="border-b border-subtle/50 hover:bg-amber-50/50">
      <td class="py-2" data-label="Fecha">${esc(r.fecha || '')}</td>
      <td class="py-2" data-label="Receta">${esc(r.receta || '')}</td>
      <td class="text-right py-2" data-label="Costo total">$${(safeNumber(r.costo_total,0) || 0).toFixed(2)}</td>
      <td class="text-right py-2" data-label="Rendimiento">${(safeNumber(r.rendimiento,0) || 0).toFixed(2)}L</td>
      <td class="text-right py-2 font-semibold ${(safeNumber(r.roi,0) || 0) > 0 ? 'text-success' : 'text-red-500'}" data-label="ROI">${(safeNumber(r.roi,0) || 0).toFixed(1)}%</td>
      <td class="text-right py-2" data-label="CO₂">${(safeNumber(r.co2,0) || 0).toFixed(1)}kg</td>
      <td class="text-right py-2" data-label=""><button class="delete-historial-btn text-red-400 hover:text-red-600 text-xs" data-hist-idx="${realIdx}"><i class="fas fa-trash"></i></button></td>
    </tr>`;
  }).join('');
}

function renderDashboard() {
  const calc = getCalculos();
  const ref = calc.envasesDetalle.find(e => e.ml === 1000) || calc.envasesDetalle[0];

  const totalCost = calc.totalIngredientes + calc.costosOperativosFijos;
  const totalConEnvase = ref ? ref.costoTotalLote : totalCost + calc.costosOperativosFijos;

  $('dash-costo-ingredientes').textContent = `$${calc.totalIngredientes.toFixed(2)}`;
  $('dash-costo-operativo').textContent = `$${calc.costosOperativosFijos.toFixed(2)}`;
  $('dash-valor-residuos').textContent = `$${calc.valorTotalResiduos.toFixed(2)}`;
  $('dash-ingreso').textContent = ref ? `$${ref.ingresoTotal.toFixed(2)}` : '$0.00';
  $('dash-inversion').textContent = `$${totalConEnvase.toFixed(2)}`;
  $('dash-ingreso-total').textContent = ref ? `$${ref.ingresoTotal.toFixed(2)}` : '$0.00';

  const roiFinal = ref ? ref.roiAjustado : 0;
  const viable = roiFinal > 0;
  $('dash-roi-final').innerHTML = `<span class="${viable ? 'text-success' : 'text-red-500'}">${roiFinal.toFixed(1)}%</span>`;

  $('dashboard-viabilidad').innerHTML = `
    <div class="text-6xl mb-2">${viable ? '✅' : '❌'}</div>
    <div class="text-2xl font-bold ${viable ? 'text-success' : 'text-red-500'}">${viable ? 'PROYECTO VIABLE' : 'NO VIABLE'}</div>
    <div class="text-sm text-secondary mt-1">ROI: ${roiFinal.toFixed(1)}% ${viable ? '— Ganancia positiva' : '— Pérdida proyectada'}</div>
  `;

  renderDashboardKPIs();
  renderRadarChart();
  renderMonthlyProjection();
  renderCostChart(calc, ref);
  renderBreakevenChart(ref, totalConEnvase);
  renderHistoryChart();
}

function renderDashboardKPIs() {
  const hist = state.historial || [];
  const prods = state.productos || [];
  const calc = getCalculos();
  const ref = calc.envasesDetalle.find(e => e.ml === 1000) || calc.envasesDetalle[0];
  const all = [...hist.map(h => ({ t: 'lote', ...h })), ...prods.map(p => ({ t: 'prod', ...p }))];

  const totalLotes = hist.length;
  const totalProductos = prods.length;
  const totalCo2 = hist.reduce((s, h) => s + (safeNumber(h.co2, 0) || 0), 0);
  const mejorROI = all.length ? Math.max(...all.map(a => safeNumber(a.roi, 0) || 0)) : 0;
  const roiProm = all.length ? all.reduce((s, a) => s + (safeNumber(a.roi, 0) || 0), 0) / all.length : 0;
  const roiActual = ref ? ref.roiAjustado : 0;

  const cards = [
    { icon: 'flask', label: 'Lotes', val: totalLotes, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    { icon: 'box', label: 'Productos', val: totalProductos, cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    { icon: 'leaf', label: 'CO₂ ahorrado', val: totalCo2.toFixed(1) + ' kg', cls: 'bg-green-50 text-green-700 border-green-200' },
    { icon: 'trophy', label: 'Mejor ROI', val: mejorROI.toFixed(1) + '%', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    { icon: 'chart-line', label: 'ROI prom.', val: roiProm.toFixed(1) + '%', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { icon: 'gauge-high', label: 'ROI actual', val: roiActual.toFixed(1) + '%', cls: (roiActual > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200') }
  ];

  $('dash-kpis').innerHTML = cards.map(c => `
    <div class="card p-3 ${c.cls} text-center">
      <i class="fas fa-${c.icon} text-lg mb-1"></i>
      <div class="text-xs opacity-70">${c.label}</div>
      <div class="text-base font-bold">${c.val}</div>
    </div>
  `).join('');
}

function renderRadarChart() {
  const ctx = document.getElementById('radarChart');
  if (!ctx) return;
  if (radarChart) { radarChart.destroy(); radarChart = null; }

  const calc = getCalculos();
  const ref = calc.envasesDetalle.find(e => e.ml === 1000) || calc.envasesDetalle[0];
  const roi = ref ? ref.roiAjustado : 0;

  const maxCostoReferencia = 50;
  const puntajeCosto = Math.min(100, Math.max(0, (1 - calc.totalIngredientes / maxCostoReferencia) * 100));
  const puntajeSostenibilidad = Math.min(100, calc.co2Ahorrado * 20);
  const puntajeRentabilidad = Math.min(100, Math.max(0, roi));
  const pctValorResiduos = calc.totalIngredientes > 0 ? (calc.valorTotalResiduos / calc.totalIngredientes) * 100 : 0;
  const puntajeResiduos = Math.min(100, pctValorResiduos * 3);
  const eficienciaProd = calc.rendimientoBruto > 0 ? Math.min(100, (calc.rendimientoBruto / calc.envasesDetalle.reduce((s, e) => s + e.unidades, 1)) * 20) : 0;

  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Eficiencia de costos', 'Sostenibilidad', 'Rentabilidad (ROI)', 'Valorización residuos', 'Eficiencia producción'],
      datasets: [{
        label: 'Lote actual',
        data: [puntajeCosto, puntajeSostenibilidad, puntajeRentabilidad, puntajeResiduos, eficienciaProd],
        backgroundColor: 'rgba(232, 161, 55, 0.2)',
        borderColor: '#E8A137',
        borderWidth: 2,
        pointBackgroundColor: '#E8A137',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20, font: { size: 10, family: 'Outfit' } },
          pointLabels: { font: { size: 10, family: 'Outfit' } },
          grid: { color: 'rgba(0,0,0,0.08)' },
          angleLines: { color: 'rgba(0,0,0,0.08)' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderMonthlyProjection() {
  const body = $('proy-table-body');
  if (!body) return;
  const calc = getCalculos();
  const ref = calc.envasesDetalle.find(e => e.ml === 1000) || calc.envasesDetalle[0];
  if (!ref) { body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Calcula una receta primero</td></tr>'; return; }

  const lotesMes = parseInt($('input-proy-lotes')?.value) || 4;
  const precioVenta = parseFloat($('input-proy-precio')?.value) || ref.precio_venta;
  if ($('input-proy-precio') && !$('input-proy-precio').value) $('input-proy-precio').value = precioVenta;

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
  const costoPorLote = ref.costoTotalLote;
  const ingresoPorLote = ref.ingresoTotal;

  body.innerHTML = meses.map((m, i) => {
    const lotes = lotesMes * (1 + i * 0.05);
    const inversion = costoPorLote * lotes;
    const ingreso = ingresoPorLote * lotes * (precioVenta / ref.precio_venta);
    const ganancia = ingreso - inversion;
    const roiMes = inversion > 0 ? (ganancia / inversion) * 100 : 0;
    return `<tr class="border-b border-subtle/50 ${i === 0 ? 'font-semibold' : ''}">
      <td class="py-2">${m}</td>
      <td class="text-right py-2">${Math.round(lotes)}</td>
      <td class="text-right py-2">$${inversion.toFixed(2)}</td>
      <td class="text-right py-2">$${ingreso.toFixed(2)}</td>
      <td class="text-right py-2 ${ganancia > 0 ? 'text-success' : 'text-red-500'}">${ganancia > 0 ? '+' : ''}$${ganancia.toFixed(2)}</td>
      <td class="text-right py-2 font-semibold ${roiMes > 0 ? 'text-success' : 'text-red-500'}">${roiMes.toFixed(1)}%</td>
    </tr>`;
  }).join('');
}

function renderCostChart(calc, ref) {
  const ctx = document.getElementById('costChart');
  if (!ctx) return;

  const data = {
    labels: ['Ingredientes', 'Mano de obra', 'Servicios', 'Transporte', 'Empaque'],
    values: [
      calc.totalIngredientes,
      state.costos.mano_obra,
      state.costos.servicios,
      state.costos.transporte,
      ref ? ref.totalEnvase : 0
    ],
    colors: ['#E8A137', '#D4902F', '#2D9F8E', '#C4956A', '#8B6F5A']
  };

  if (costChart) { costChart.destroy(); }

  costChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values.map(v => Math.max(0.01, v)),
        backgroundColor: data.colors,
        borderWidth: 3,
        borderColor: '#F0EDEA',
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Outfit', size: 11 }, padding: 12, usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: $${ctx.raw.toFixed(2)}`
          }
        }
      },
      cutout: '65%'
    }
  });
}

function renderBreakevenChart(ref, totalConEnvase) {
  const beCtx = document.getElementById('breakevenChart');
  if (!beCtx || !ref) return;

  if (breakevenChart) breakevenChart.destroy();

  const fixCost = totalConEnvase - ref.totalEnvase;
  const varCostPerUnit = ref.costUnitario;
  const price = ref.precio_venta;
  const maxU = Math.max(ref.unidades * 2, 20);
  const labels = [];
  const costs = [];
  const revs = [];
  for (let u = 0; u <= maxU; u += Math.max(1, Math.floor(maxU / 20))) {
    labels.push(u);
    costs.push(fixCost + varCostPerUnit * u);
    revs.push(price * u);
  }
  const beUnits = price > varCostPerUnit ? Math.ceil(fixCost / (price - varCostPerUnit)) : 0;

  breakevenChart = new Chart(beCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Costos totales', data: costs, borderColor: '#C44545', backgroundColor: 'rgba(196,69,69,0.06)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true },
        { label: 'Ingresos', data: revs, borderColor: '#2D9F8E', backgroundColor: 'rgba(45,159,142,0.06)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Outfit', size: 11 }, padding: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: $${ctx.raw.toFixed(2)}` } }
      },
      scales: {
        x: { title: { display: true, text: 'Unidades vendidas', font: { family: 'Outfit', size: 11 } } },
        y: { title: { display: true, text: 'USD', font: { family: 'Outfit', size: 11 } } }
      }
    }
  });
  $('breakeven-info').textContent = beUnits > 0 ? `📊 Punto de equilibrio: ${beUnits} unidades de 1L ($${(beUnits * price).toFixed(2)})` : 'Precio por unidad es menor al costo variable. Revisa tu estructura de costos.';
}

function renderHistoryChart() {
  const histCtx = document.getElementById('historyChart');
  if (!histCtx) return;

  const h = state.historial || [];
  if (h.length < 2) {
    document.getElementById('history-chart-empty').classList.remove('hidden');
    if (historyChart) { historyChart.destroy(); historyChart = null; }
    return;
  }
  document.getElementById('history-chart-empty').classList.add('hidden');
  if (historyChart) historyChart.destroy();

  const recent = h.slice(0).reverse();
  const hLabels = recent.map(r => { try { return new Date(r.fecha).toLocaleDateString('es-ES', {month:'short',day:'numeric'}); } catch(e) { return r.fecha || ''; } });

  historyChart = new Chart(histCtx, {
    type: 'line',
    data: {
      labels: hLabels,
      datasets: [
        { label: 'Costo total ($)', data: recent.map(r => safeNumber(r.costo_total,0) || 0), borderColor: '#E8A137', backgroundColor: 'rgba(232, 161, 55, 0.08)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
        { label: 'ROI (%)', data: recent.map(r => safeNumber(r.roi,0) || 0), borderColor: '#2D9F8E', backgroundColor: 'rgba(45, 159, 142, 0.08)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Outfit', size: 11 }, padding: 12, usePointStyle: true } }
      },
      scales: {
        y: { position: 'left', title: { display: true, text: 'USD', font: { family: 'Outfit', size: 10 } } },
        y1: { position: 'right', title: { display: true, text: '%', font: { family: 'Outfit', size: 10 } }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

// ======================== PRICE TARGET + SCALING ========================
function calcularPrecioObjetivo() {
  const targetROI = safeNumber($('input-roi-target').value, 0) || 30;
  const calc = getCalculos();
  const ref = calc.envasesDetalle.find(e => e.ml === 1000) || calc.envasesDetalle[0];
  if (!ref) { $('precio-objetivo-result').innerHTML = '<span class="text-danger">Calcula primero una receta.</span>'; return; }
  const costPerUnit = ref.costUnitario;
  const requiredPrice = costPerUnit * (1 + targetROI / 100);
  const profitPerUnit = requiredPrice - costPerUnit;
  const result = $('precio-objetivo-result');
  result.innerHTML = `
    <div class="mt-2 space-y-1 p-3 bg-amber-50 rounded-xl border border-subtle">
      <div class="flex justify-between"><span>💰 Precio venta necesario (1L)</span><span class="font-bold text-lg text-primary">$${requiredPrice.toFixed(2)}</span></div>
      <div class="flex justify-between"><span>📈 Ganancia por unidad</span><span class="font-semibold text-success">$${profitPerUnit.toFixed(2)}</span></div>
      <div class="flex justify-between text-xs"><span>🎯 ROI objetivo</span><span>${targetROI}%</span></div>
    </div>
  `;
}

function calcularEscalado() {
  const targetL = safeNumber($('input-escalado-litros').value, 0) || 10;
  const calc = getCalculos();
  const currentYield = calc.rendimientoBruto;
  if (currentYield <= 0) { $('escalado-result').innerHTML = '<span class="text-danger">La receta actual no produce rendimiento.</span>'; return; }
  const factor = targetL / currentYield;
  const i = state.ingredientes;
  const scaled = {
    parchita: i.parchita.kg * factor,
    azucar: i.azucar.kg * factor,
    agua: i.agua.L * factor,
    pectina: i.pectina.g * factor,
    acido: i.acido_citrico.g * factor,
    sorbato: i.sorbato_potasio.g * factor
  };
  const result = $('escalado-result');
  result.innerHTML = `
    <div class="mt-2 space-y-1 p-3 bg-amber-50 rounded-xl border border-subtle">
      <div class="text-xs text-secondary mb-1">Para obtener <strong>${targetL.toFixed(1)}L</strong> (factor: ${factor.toFixed(3)}x):</div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
        <span><i class="fas fa-apple-alt" style="color:#E8A137;width:16px"></i> Parchita</span><span class="font-semibold text-right">${scaled.parchita.toFixed(1)} kg</span>
        <span><i class="fas fa-cube" style="color:#D4A853;width:16px"></i> Azúcar</span><span class="font-semibold text-right">${scaled.azucar.toFixed(1)} kg</span>
        <span><i class="fas fa-tint" style="color:#4A90D9;width:16px"></i> Agua</span><span class="font-semibold text-right">${scaled.agua.toFixed(1)} L</span>
        <span><i class="fas fa-flask" style="color:#8B5CF6;width:16px"></i> Pectina</span><span class="font-semibold text-right">${scaled.pectina.toFixed(0)} g</span>
        <span><i class="fas fa-vial" style="color:#F59E0B;width:16px"></i> Ácido cítrico</span><span class="font-semibold text-right">${scaled.acido.toFixed(0)} g</span>
        <span><i class="fas fa-prescription-bottle" style="color:#EC4899;width:16px"></i> Sorbato K</span><span class="font-semibold text-right">${scaled.sorbato.toFixed(0)} g</span>
      </div>
      <button onclick="applyScaled(${factor})" class="mt-2 w-full bg-secondary text-white text-xs py-1.5 rounded-lg hover:bg-secondary-hover"><i class="fas fa-check"></i> Aplicar esta escala</button>
    </div>
  `;
}

function applyScaled(factor) {
  const i = state.ingredientes;
  const calc = getCalculos();
  const cy = calc.rendimientoBruto;
  if (cy <= 0) return;
  i.parchita.kg = safeNumber(i.parchita.kg * factor, 0);
  i.azucar.kg = safeNumber(i.azucar.kg * factor, 0);
  i.agua.L = safeNumber(i.agua.L * factor, 0);
  i.pectina.g = safeNumber(i.pectina.g * factor, 0);
  i.acido_citrico.g = safeNumber(i.acido_citrico.g * factor, 0);
  i.sorbato_potasio.g = safeNumber(i.sorbato_potasio.g * factor, 0);
  saveState();
  renderAll();
  showToast('✅ Receta escalada', 'success');
}

// ======================== BACKUP ========================
function exportData() {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `parchita_backup_${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('✅ Backup descargado', 'success');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const parsed = JSON.parse(ev.target.result);
      const cleaned = stripDangerousKeys(parsed);
      if (!cleaned.ingredientes || !cleaned.costos) {
        showToast('❌ El archivo no tiene el formato correcto', 'error');
        return;
      }
      state = cleaned;
      saveState();
      renderAll();
      showToast('✅ Backup restaurado correctamente', 'success');
    } catch(err) {
      showToast('❌ Error al leer el archivo', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ======================== PRODUCTS CRUD ========================
function guardarEstadoComoProducto() {
  $('modal-product-name').value = '';
  $('modal-title').textContent = 'Guardar producto';
  state.ui.editando_id = null;
  $('modal-edit').classList.remove('hidden');
  $('modal-edit').classList.add('flex');
}

function closeModal() {
  $('modal-edit').classList.add('hidden');
  $('modal-edit').classList.remove('flex');
}

function confirmSaveProduct() {
  const name = $('modal-product-name').value.trim() || 'Producto sin nombre';
  const i = state.ingredientes;

  const prod = {
    id: Date.now(),
    nombre: name,
    fecha: new Date().toLocaleDateString('es-ES'),
    parchita: i.parchita.kg,
    azucar: i.azucar.kg,
    agua: i.agua.L,
    pectina: i.pectina.g,
    acido_citrico: i.acido_citrico.g,
    sorbato_potasio: i.sorbato_potasio.g
  };

  if (state.ui.editando_id !== null) {
    const idx = state.productos.findIndex(p => p.id === state.ui.editando_id);
    if (idx >= 0) state.productos[idx] = { ...state.productos[idx], ...prod };
  } else {
    state.productos.push(prod);
  }

  state.ui.editando_id = null;
  saveState();
  closeModal();
  renderAll();
}

function cargarProducto(idx) {
  const p = state.productos[idx];
  if (!p) return;
  state.ingredientes.parchita.kg = p.parchita;
  state.ingredientes.azucar.kg = p.azucar;
  state.ingredientes.agua.L = p.agua;
  state.ingredientes.pectina.g = p.pectina;
  state.ingredientes.acido_citrico.g = p.acido_citrico;
  state.ingredientes.sorbato_potasio.g = p.sorbato_potasio;
  saveState();
  switchTab('calculadora');
  renderAll();
}

function eliminarProducto(idx) {
  if (!confirm('¿Eliminar este producto?')) return;
  state.productos.splice(idx, 1);
  saveState();
  renderAll();
}

// ======================== HISTORY ========================
function registrarLote() {
  const calc = getCalculos();
  const ref = calc.envasesDetalle.find(e => e.ml === 1000) || calc.envasesDetalle[0];
  const i = state.ingredientes;

  const registro = {
    id: Date.now(),
    fecha: new Date().toLocaleString('es-ES'),
    receta: `${i.parchita.kg}kg parchita, ${i.azucar.kg}kg azúcar, ${i.agua.L}L agua`,
    costo_total: calc.totalCostosFijos + (ref ? ref.totalEnvase : 0),
    rendimiento: calc.rendimientoBruto,
    roi: ref ? ref.roi : 0,
    roi_ajustado: ref ? ref.roiAjustado : 0,
    co2: calc.co2Ahorrado,
    ingredientes: { ...i }
  };

  state.historial.unshift(registro);
  saveState();
  renderAll();
  showToast('✅ Lote registrado en el historial', 'success');
}

function eliminarHistorial(idx) {
  if (!confirm('¿Eliminar este registro?')) return;
  state.historial.splice(idx, 1);
  saveState();
  renderAll();
}

// ======================== EXPORT ========================
function escCSV(str) {
  const s = String(str);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function exportCSV() {
  const h = state.historial;
  if (!h || h.length === 0) { showToast('No hay datos para exportar', 'error'); return; }
  let csv = 'Fecha,Receta,Costo Total,Rendimiento (L),ROI (%),CO₂ (kg)\n';
  h.forEach(r => {
    csv += `${escCSV(r.fecha)},"${escCSV(r.receta)}",${(safeNumber(r.costo_total,0)||0).toFixed(2)},${(safeNumber(r.rendimiento,0)||0).toFixed(2)},${(safeNumber(r.roi,0)||0).toFixed(1)},${(safeNumber(r.co2,0)||0).toFixed(1)}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `historial_parchita_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportPDF() {
  const h = state.historial;
  if (!h || h.length === 0) { showToast('No hay datos para exportar', 'error'); return; }
  const content = document.createElement('div');
  content.style.padding = '20px';
  content.style.fontFamily = 'Outfit, sans-serif';
  content.style.color = '#2C1810';
  content.innerHTML = `
    <h1 style="font-size:20px;font-weight:700;color:#F4A100;"><i class="fas fa-apple-alt"></i> Sirope de Parchita — Historial de Costos</h1>
    <p style="font-size:12px;color:#7A5C4A;margin-bottom:16px;">Generado: ${new Date().toLocaleString('es-ES')}</p>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:#F4A100;color:white;">
          <th style="padding:8px;text-align:left;">Fecha</th>
          <th style="padding:8px;text-align:left;">Receta</th>
          <th style="padding:8px;text-align:right;">Costo</th>
          <th style="padding:8px;text-align:right;">Rend.</th>
          <th style="padding:8px;text-align:right;">ROI</th>
          <th style="padding:8px;text-align:right;">CO₂</th>
        </tr>
      </thead>
      <tbody>
        ${h.map(r => `
          <tr style="border-bottom:1px solid #E8D5B5;">
            <td style="padding:6px 8px;">${esc(r.fecha)}</td>
            <td style="padding:6px 8px;">${esc(r.receta)}</td>
            <td style="padding:6px 8px;text-align:right;">$${(safeNumber(r.costo_total,0)||0).toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:right;">${(safeNumber(r.rendimiento,0)||0).toFixed(2)}L</td>
            <td style="padding:6px 8px;text-align:right;color:${(safeNumber(r.roi,0)||0) > 0 ? '#10B981' : '#EF4444'};">${(safeNumber(r.roi,0)||0).toFixed(1)}%</td>
            <td style="padding:6px 8px;text-align:right;">${(safeNumber(r.co2,0)||0).toFixed(1)}kg</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  html2pdf().set({
    margin: [10, 10, 10, 10],
    filename: `historial_parchita_${new Date().toISOString().slice(0,10)}.pdf`,
    html2canvas: { scale: 2, backgroundColor: '#FFFAF3' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(content).save();
}

// ======================== SLIDER INIT ========================
function initSliders() {
  const configs = [
    { key: 'ingredientes.parchita.kg', max: 500, step: 0.1, label: 'Parchita amarilla', unit: 'kg', icon: '<i class="fas fa-apple-alt" style="color:#E8A137"></i>' },
    { key: 'ingredientes.azucar.kg', max: 500, step: 0.1, label: 'Azúcar refinada', unit: 'kg', icon: '<i class="fas fa-cube" style="color:#D4A853"></i>' },
    { key: 'ingredientes.agua.L', max: 500, step: 0.1, label: 'Agua filtrada', unit: 'L', icon: '<i class="fas fa-tint" style="color:#4A90D9"></i>' },
    { key: 'ingredientes.pectina.g', max: 5000, step: 5, label: 'Pectina cítrica', unit: 'g', icon: '<i class="fas fa-flask" style="color:#8B5CF6"></i>' },
    { key: 'ingredientes.acido_citrico.g', max: 1000, step: 1, label: 'Ácido cítrico', unit: 'g', icon: '<i class="fas fa-vial" style="color:#F59E0B"></i>' },
    { key: 'ingredientes.sorbato_potasio.g', max: 500, step: 1, label: 'Sorbato de potasio', unit: 'g', icon: '<i class="fas fa-prescription-bottle" style="color:#EC4899"></i>' }
  ];

  const container = document.querySelector('.slider-group')?.parentNode;
  if (!container) return;
  container.innerHTML = '';

  configs.forEach(cfg => {
    const keys = cfg.key.split('.');
    let val = state;
    for (let k of keys) val = val[k];
    const div = document.createElement('div');
    div.className = 'slider-group';
    div.dataset.key = cfg.key;
    div.innerHTML = `
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium flex items-center gap-1.5"><span>${cfg.icon}</span>${cfg.label}</label>
        <div class="flex items-center gap-1.5">
          <input type="number" min="0" max="${cfg.max}" step="${cfg.step}" value="${val}"
            oninput="updateIngrediente('${keys[1]}','${keys[2]}',this.value)"
            class="slider-num w-20 text-right text-sm font-bold border border-subtle rounded-lg px-2 py-1 outline-none">
          <span class="text-xs text-secondary w-5">${cfg.unit}</span>
        </div>
      </div>
      <input type="range" min="0" max="${cfg.max}" step="${cfg.step}" value="${val}"
        oninput="updateIngrediente('${keys[1]}','${keys[2]}',this.value)"
        class="w-full mt-1.5">
    `;
    container.appendChild(div);
  });
}

// ======================== EVENT DELEGATION ========================
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (t) {
    const action = t.dataset.action;
    switch (action) {
      case 'toggle-sidebar': toggleSidebar(); break;
      case 'close-modal': closeModal(); break;
      case 'confirm-save': confirmSaveProduct(); break;
      case 'registrar-lote': registrarLote(); break;
      case 'calcular-precio': calcularPrecioObjetivo(); break;
      case 'calcular-escalado': calcularEscalado(); break;
      case 'export-csv': exportCSV(); break;
      case 'export-pdf': exportPDF(); break;
      case 'export-backup': exportData(); break;
      case 'import-backup': document.getElementById('import-file').click(); break;
    }
    return;
  }

  // Scrollable envase table card view on mobile
  const envCard = e.target.closest('.envase-card');
  if (envCard && window.innerWidth < 640) {
    envCard.classList.toggle('expanded');
  }
});

// Product buttons (rendered dynamically)
document.addEventListener('click', e => {
  const compareBtn = e.target.closest('.compare-btn');
  if (compareBtn && compareBtn.dataset.compareId) {
    toggleCompare(Number(compareBtn.dataset.compareId));
    return;
  }
  const loadBtn = e.target.closest('.load-product-btn');
  if (loadBtn && loadBtn.dataset.prodIdx !== undefined) {
    cargarProducto(Number(loadBtn.dataset.prodIdx));
    return;
  }
  const delProdBtn = e.target.closest('.delete-product-btn');
  if (delProdBtn && delProdBtn.dataset.prodIdx !== undefined) {
    eliminarProducto(Number(delProdBtn.dataset.prodIdx));
    return;
  }
  const delHistBtn = e.target.closest('.delete-historial-btn');
  if (delHistBtn && delHistBtn.dataset.histIdx !== undefined) {
    eliminarHistorial(Number(delHistBtn.dataset.histIdx));
    return;
  }
  const loadSuppBtn = e.target.closest('.load-supplier-btn');
  if (loadSuppBtn && loadSuppBtn.dataset.supplierIdx !== undefined) {
    cargarPreciosProveedor(Number(loadSuppBtn.dataset.supplierIdx));
    return;
  }
  const delSuppBtn = e.target.closest('.delete-supplier-btn');
  if (delSuppBtn && delSuppBtn.dataset.supplierIdx !== undefined) {
    if (!confirm('¿Eliminar este proveedor?')) return;
    state.proveedores.splice(Number(delSuppBtn.dataset.supplierIdx), 1);
    saveState();
    renderProveedores();
    return;
  }
  const completePlanBtn = e.target.closest('.complete-plan-btn');
  if (completePlanBtn && completePlanBtn.dataset.planIdx !== undefined) {
    completarPlan(Number(completePlanBtn.dataset.planIdx));
    return;
  }
  const cancelPlanBtn = e.target.closest('.cancel-plan-btn');
  if (cancelPlanBtn && cancelPlanBtn.dataset.planIdx !== undefined) {
    cancelarPlan(Number(cancelPlanBtn.dataset.planIdx));
    return;
  }
  const delPlanBtn = e.target.closest('.delete-plan-btn');
  if (delPlanBtn && delPlanBtn.dataset.planIdx !== undefined) {
    eliminarPlan(Number(delPlanBtn.dataset.planIdx));
    return;
  }
});

// Modal overlay close
document.addEventListener('click', e => {
  if (e.target.id === 'modal-edit') closeModal();
});

// Validation on input
document.addEventListener('input', e => {
  const el = e.target;
  if (el.classList.contains('precio-input')) {
    const key = el.dataset.key;
    if (!key) return;
    const keys = key.split('.');
    let obj = state;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = safeNumber(el.value, 0);
    saveState();
    renderAll();
  }
  if (el.type === 'number') validateInput(el);
});

// Envase price inputs (rendered dynamically)
document.addEventListener('input', e => {
  const el = e.target;
  const compraIdx = el.dataset.envaseCompra;
  const ventaIdx = el.dataset.envaseVenta;
  if (compraIdx !== undefined) {
    updateEnvase(Number(compraIdx), 'precio_compra', el.value);
  } else if (ventaIdx !== undefined) {
    updateEnvase(Number(ventaIdx), 'precio_venta', el.value);
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const modal = $('modal-edit');
    if (!modal.classList.contains('hidden')) closeModal();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    guardarEstadoComoProducto();
  }
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    e.preventDefault();
    showToast('⌨️ Ctrl+S: Guardar · Esc: Cerrar · ?: Ayuda', 'info');
  }
});

// ======================== INIT ========================
loadState();

const savedTheme = localStorage.getItem('parchita_theme');
if (savedTheme === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); }
const themeBtn = $('theme-btn');
if (themeBtn && savedTheme === 'dark') themeBtn.innerHTML = '<i class="fas fa-sun"></i> <span>Claro</span>';

document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
const activeTab = state.ui.tab || 'calculadora';
const activeBtn = document.querySelector(`.tab-btn[data-tab="${activeTab}"]`);
if (activeBtn) activeBtn.classList.add('active');
const activeContent = $(`tab-${activeTab}`);
if (activeContent) activeContent.classList.add('active');
const activeNav = document.querySelector(`.nav-item[data-tab="${activeTab}"]`);
if (activeNav) activeNav.classList.add('active');

initSliders();
renderAll();

// ======================== PWA ========================
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  showToast('📲 Instala esta app en tu dispositivo para acceso rápido', 'info');
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
