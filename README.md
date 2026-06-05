<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Parchita-v3.0-D4A04A?style=flat-square&labelColor=1A1A2E">
  <img src="https://img.shields.io/badge/Parchita-v3.0-C4956A?style=flat-square&labelColor=F0EDEA">
</picture>

# 🍯 Passion Fruit Cost Calculator — PWA + Crafting Simulator

> **Transforma residuos en revenue. Convierte datos en decisiones. Juega a producir.**

Una **Progressive Web App** para calcular costos de producción de sirope de parchita amarilla con **cero residuos**, ahora con un **simulador de producción interactivo 3D** y un **juego de crafting** donde tus decisiones determinan la calidad del producto final.

---

## 🚀 Características

| Feature | Impacto |
|---|---|
| **Calculadora inteligente** | Sliders en tiempo real con actualización instantánea de costos, ROI y rendimiento |
| **Zero Waste Dashboard** | Valorización automatizada de cáscaras y semillas — convierte residuos en ingresos |
| **CO₂ Tracker** | Mide el impacto ambiental: kg de CO₂ ahorrados vs. autos y árboles |
| **Chart.js Analytics** | Distribución de costos, radar multidimensional, punto de equilibrio, evolución histórica |
| **ROI Ajustado** | ROI con y sin subproductos — ve el panorama real de tu negocio |
| **Historial + Filtros** | Busca, filtra por fecha/ROI, ordena asc/desc — sin pérdida de datos |
| **Planificación** | Programa lotes futuros con fechas y notas |
| **Exportación** | CSV, PDF y backup JSON — tus datos siempre disponibles |
| **Modo Oscuro** | Tema claro/oscuro con persistencia en localStorage |
| **PWA Ready** | Service worker, manifest, instalable en mobile como app nativa |
| **Responsive** | UI adaptativa con navegación bottom y sidebar — funciona en cualquier dispositivo |
| **Multi-Envase** | Precios de compra/venta para 4 formatos (250ml a 2L) con ganancia por unidad |
| **Línea de Producción 3D** | 5 estaciones 3D interactivas con objetos pickeables, arrastre, panel de propiedades y modo sandbox |
| **Parchita Crafting Simulator** | Juego de 5 fases donde eliges ingredientes, lavas, cocinas, envasa y vendes — cada decisión afecta la calidad final |

---

## 🎮 Parchita Crafting Simulator

Un juego interactivo integrado en la línea de producción 3D. Toma el rol de un maestro siropero y crea el mejor sirope de parchita posible.

### Fases del juego

1. **Selección** — Elige la cantidad de parchita, azúcar, agua, pectina, ácido cítrico y sorbato de potasio
2. **Lavado** — Controla tiempo, temperatura y velocidad del tambor para maximizar la limpieza
3. **Cocción** — 4 pasos secuenciales: precalentar, añadir azúcar, añadir pectina, hervir a temperatura controlada
4. **Envasado** — Ajusta precisión de boquilla y nivel de llenado para minimizar pérdidas
5. **Venta** — Elige estante (bajo/medio/alto) y fija el precio por botella

### Sistema de calidad

El producto final se evalúa con 4 métricas (0–100):

- **Dulzor** — Basado en la proporción azúcar/parchita (óptimo 0.75:1)
- **Viscosidad** — Función de la pectina agregada y tiempo de cocción
- **Acidez** — Temperatura de cocción y ácido cítrico (óptimo 85°C, 5g)
- **Claridad** — Eficacia del lavado y temperatura del agua (óptimo 30°C)

### Rankings

| Rango | Puntaje | 
|-------|---------|
| **S** | ≥ 90 |
| **A** | ≥ 75 |
| **B** | ≥ 55 |
| **C** | < 55 |

### Sonido ambiental

Efectos de sonido generados por Web Audio API (pop, buzz, chime, fanfare, sizzle, pour, tick, error, splash) — sin dependencias externas ni archivos de audio.

---

## ⚡ Stack técnico

<p>
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black">
  <img src="https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=three.js&logoColor=white">
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=flat-square&logo=chart.js&logoColor=white">
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white">
  <img src="https://img.shields.io/badge/Web Audio API-FF6F00?style=flat-square&logo=web-audio-api&logoColor=white">
</p>

**Arquitectura:** SPA vanilla JS sin frameworks — peso mínimo, máximo rendimiento.  
**3D:** Three.js r128 con OrbitControls, raycasting, drag & drop y animaciones procedurales.  
**Persistencia:** localStorage con backup/restore JSON.  
**Charts:** Chart.js 4.4.7 para visualización de datos en tiempo real.  
**Audio:** Web Audio API — síntesis procedural, zero network dependencies.  
**Estilos:** CSS custom properties con glassmorphism y diseño atómico Tailwind-like.

---

## 🧠 Filosofía

> No es solo una calculadora. Es un **sistema de inteligencia operativa** para el emprendimiento sostenible.

Cada lote de sirope de parchita genera cáscaras y semillas que tradicionalmente se descartan. Esta app demuestra que **los residuos son activos** — los cuantifica, los valora y los integra en la ecuación financiera. El resultado: un emprendimiento más rentable, más verde y más inteligente.

El simulador 3D y el juego de crafting llevan esta filosofía un paso más allá: **aprender haciendo**. Cada fase del juego refleja un paso real del proceso productivo, y las fórmulas de calidad están basadas en la química real del sirope de parchita.

---

## 📦 Instalación

```bash
git clone https://github.com/rooselvelt6/passion_fruits.git
cd passion_fruits
# Sirve con cualquier servidor estático:
python3 -m http.server 8080
# O usando npx:
npx serve .
```

Abre `http://localhost:8080` en tu navegador.  
En Android/iOS: **Añadir a pantalla de inicio** para usarla como app nativa.

---

## 🧩 Uso rápido

1. **Calculadora** — Ajusta ingredientes con sliders, ve el costo del lote al instante
2. **Producción 3D** — Explora la línea de producción interactiva, arrastra objetos, cambia al modo sandbox
3. **Jugar** — Activa el modo juego y completa las 5 fases para obtener tu ranking (S/A/B/C)
4. **Dashboard** — Charts, proyecciones, punto de equilibrio
5. **Activa el modo oscuro** para sesiones nocturnas

---

## 🌱 Impacto

- **Económico:** Maximiza el ROI valorizando subproductos
- **Ambiental:** Cuantifica CO₂ ahorrado vs. árboles y km en auto
- **Social:** Herramienta gratuita para emprendedores venezolanos
- **Educativo:** El simulador 3D y el juego enseñan el proceso productivo real

---

## 🤝 Contribuir

¿Tienes ideas para mejorar la calculadora? ¿Quieres adaptarla a otro producto?

1. Fork este repo
2. Crea tu branch: `git checkout -b feature/algo-increible`
3. Commit: `git commit -m 'feat: agrega algo increíble'`
4. Push: `git push origin feature/algo-increible`
5. Abre un Pull Request

---

<p align="center">
  <strong>Hecho con ❤️ y 🥭 por emprendedores venezolanos</strong><br>
  <sub>Porque la parchita no es solo un fruto — es una oportunidad.</sub>
</p>
