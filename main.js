import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as XLSX from 'xlsx';
import * as turf from '@turf/turf';
import { toPng } from 'html-to-image';
import { procesarDatosDeHoja } from './excel.js';
import { showAlert } from './ui.js';

const map = L.map('map').setView([19.432761349059973, -99.13321947725065], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
}).addTo(map);

let capaMarcadores = L.layerGroup().addTo(map);
let workbookGlobal = null;
let todasLasUbicaciones = [];
let marcadoresPorUbicacion = new Map();
let marcadoresResaltados = [];
let seleccionActual = null;
let marcadorSeleccionado = null; // referencia al marcador con resaltado azul

// Caché de banderas en base64
const cacheBanderaBase64 = new Map();

// DOM
const fileInput = document.getElementById('excel-upload');
const uploadBtn = document.getElementById('upload-btn');
const sheetSelectorContainer = document.getElementById('sheet-selector-container');
const sheetSelect = document.getElementById('sheet-select');
const processSheetBtn = document.getElementById('process-sheet-btn');
const panel = document.getElementById('panel');
const toggleBtn = document.getElementById('toggle-panel-btn');
const toggleIcon = document.getElementById('toggle-icon');
const closePanelBtn = document.getElementById('close-panel-btn');
const detalleEmbajada = document.getElementById('detalle-embajada');
const infoEmbajada = document.getElementById('info-embajada');
const numCercanas = document.getElementById('num-cercanas');
const btnCalcularCercanas = document.getElementById('btn-calcular-cercanas');
const cercanasContainer = document.getElementById('cercanas-container');
const listaCercanas = document.getElementById('lista-cercanas');
const exportImgBtn = document.getElementById('export-img-btn');

// Estado del panel
let panelAbierto = true;

function togglePanel(abrir) {
  if (typeof abrir === 'boolean') {
    panelAbierto = abrir;
  } else {
    panelAbierto = !panelAbierto;
  }

  if (panelAbierto) {
    panel.style.display = 'flex';
    toggleIcon.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    `;
    toggleBtn.classList.remove('bg-slate-800/80', 'hover:bg-slate-700');
    toggleBtn.classList.add('bg-slate-800/90', 'hover:bg-slate-900');
  } else {
    panel.style.display = 'none';
    toggleIcon.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
    `;
    toggleBtn.classList.remove('bg-slate-800/90', 'hover:bg-slate-900');
    toggleBtn.classList.add('bg-slate-800/80', 'hover:bg-slate-700');
  }
}

toggleBtn.addEventListener('click', () => togglePanel());
closePanelBtn.addEventListener('click', () => togglePanel(false));

function asegurarPanelAbierto() {
  if (!panelAbierto) {
    togglePanel(true);
  }
}

uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = evt.target.result;
    workbookGlobal = XLSX.read(data, { type: 'binary' });
    const sheetNames = workbookGlobal.SheetNames;
    if (sheetNames.length > 1) {
      sheetSelect.innerHTML = sheetNames.map(n => `<option value="${n}">${n}</option>`).join('');
      sheetSelectorContainer.classList.remove('hidden');
      showAlert('Archivo con varias hojas. Selecciona una.');
    } else {
      procesarHoja(sheetNames[0]);
    }
  };
  reader.readAsBinaryString(file);
});

processSheetBtn.addEventListener('click', () => {
  procesarHoja(sheetSelect.value);
  sheetSelectorContainer.classList.add('hidden');
});

// Cargar banderas en base64
async function cargarBanderaBase64(pais) {
  const codigo = obtenerCodigoPais(pais);
  const url = `https://flagcdn.com/w40/${codigo}.png`;

  if (cacheBanderaBase64.has(url)) {
    return cacheBanderaBase64.get(url);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al descargar la bandera');
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    cacheBanderaBase64.set(url, dataUrl);
    return dataUrl;
  } catch (error) {
    console.warn(`No se pudo cargar la bandera de ${pais}`, error);
    const fallback = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSIzMCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iMjAiIHk9IjE4IiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMDAwIj7wn6OzPC90ZXh0Pjwvc3ZnPg==';
    cacheBanderaBase64.set(url, fallback);
    return fallback;
  }
}

async function procesarHoja(sheetName) {
  if (!workbookGlobal) {
    showAlert('No hay archivo cargado.', true);
    return;
  }
  const { totales, validas } = procesarDatosDeHoja(workbookGlobal, sheetName);
  if (totales === 0) {
    showAlert('No se encontraron datos válidos en esta hoja.', true);
    return;
  }
  if (validas.length === 0) {
    showAlert(`Se encontraron ${totales} registros, pero ninguno con coordenadas válidas.`, true);
    return;
  }

  showAlert(`Cargando banderas...`);

  const paisesUnicos = [...new Set(validas.map(item => item.pais))];
  await Promise.all(paisesUnicos.map(pais => cargarBanderaBase64(pais)));

  showAlert(`¡Éxito! Ubicando ${validas.length} de ${totales} embajadas.`);

  capaMarcadores.clearLayers();
  todasLasUbicaciones = [];
  marcadoresPorUbicacion.clear();
  marcadoresResaltados = [];
  seleccionActual = null;
  marcadorSeleccionado = null;
  detalleEmbajada.classList.add('hidden');
  cercanasContainer.classList.add('hidden');

  validas.forEach((item, index) => {
    const marker = crearMarcador(item.pais, item.lat, item.lng);
    const ubicacion = { ...item, index, marker };
    todasLasUbicaciones.push(ubicacion);
    marcadoresPorUbicacion.set(`${item.lat},${item.lng}`, marker);

    marker.on('click', () => {
      seleccionarEmbajada(index);
    });

    capaMarcadores.addLayer(marker);
  });

  if (capaMarcadores.getLayers().length > 0) {
    const bounds = L.featureGroup(capaMarcadores.getLayers()).getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  if (todasLasUbicaciones.length > 0) {
    seleccionarEmbajada(0);
  }
}

function seleccionarEmbajada(index) {
  asegurarPanelAbierto();

  // Restaurar el marcador seleccionado anterior a normal
  if (marcadorSeleccionado) {
    const ubicAnterior = todasLasUbicaciones.find(u => u.marker === marcadorSeleccionado);
    if (ubicAnterior) {
      const nuevoIcon = crearIconoNormal(ubicAnterior.pais);
      marcadorSeleccionado.setIcon(nuevoIcon);
    }
    marcadorSeleccionado = null;
  }

  // Restaurar resaltados de cercanas (si los hay)
  restaurarMarcadores();

  seleccionActual = index;
  const item = todasLasUbicaciones[index];
  if (!item) return;

  // Aplicar resaltado azul al marcador seleccionado
  const iconoSeleccionado = crearIconoSeleccionado(item.pais);
  item.marker.setIcon(iconoSeleccionado);
  marcadorSeleccionado = item.marker;

  detalleEmbajada.classList.remove('hidden');
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;

  const codigo = obtenerCodigoPais(item.pais);
  const url = `https://flagcdn.com/w80/${codigo}.png`;
  const banderaBase64 = cacheBanderaBase64.get(url) || '';

  infoEmbajada.innerHTML = `
      <div class="text-center">
          <h3 class="font-black text-slate-800 text-base uppercase tracking-wider mb-2">${item.pais}</h3>
          <p class="text-[11px] font-medium text-slate-600 leading-relaxed mb-4 text-left border-l-2 border-blue-500 pl-2 bg-slate-50 p-2 rounded">${item.direccion}</p>
          <a href="${gmapsUrl}" target="_blank" class="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition-all shadow-md">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              Abrir en Google Maps
          </a>
      </div>
  `;

  cercanasContainer.classList.add('hidden');
  listaCercanas.innerHTML = '';
  map.setView([item.lat, item.lng], 16);
}

// Crear marcador normal (sin resaltar)
function crearMarcador(pais, lat, lng) {
  const color = obtenerColorPorPais(pais);
  const dataUrl = obtenerBanderaBase64DesdeCache(pais);

  const icon = L.divIcon({
    className: 'custom-flag-marker',
    html: `
      <div class="marker-container">
        <div class="marker-circle" style="background-color: ${color};">
          <img src="${dataUrl}" alt="${pais}" style="width:28px; height:28px; object-fit:cover; border-radius:50%; border:1px solid rgba(255,255,255,0.5);">
        </div>
        <div class="marker-label">${pais}</div>
      </div>
    `,
    iconSize: [50, 58],
    iconAnchor: [25, 48],
    popupAnchor: [0, -48],
  });

  return L.marker([lat, lng], { icon });
}

// Icono normal (para restaurar)
function crearIconoNormal(pais) {
  const color = obtenerColorPorPais(pais);
  const dataUrl = obtenerBanderaBase64DesdeCache(pais);
  return L.divIcon({
    className: 'custom-flag-marker',
    html: `
      <div class="marker-container">
        <div class="marker-circle" style="background-color: ${color};">
          <img src="${dataUrl}" alt="${pais}" style="width:28px; height:28px; object-fit:cover; border-radius:50%; border:1px solid rgba(255,255,255,0.5);">
        </div>
        <div class="marker-label">${pais}</div>
      </div>
    `,
    iconSize: [50, 58],
    iconAnchor: [25, 48],
    popupAnchor: [0, -48],
  });
}

// Icono seleccionado (azul)
function crearIconoSeleccionado(pais) {
  const color = obtenerColorPorPais(pais);
  const dataUrl = obtenerBanderaBase64DesdeCache(pais);
  return L.divIcon({
    className: 'custom-flag-marker',
    html: `
      <div class="marker-container seleccionado">
        <div class="marker-circle" style="background-color: ${color};">
          <img src="${dataUrl}" alt="${pais}" style="width:28px; height:28px; object-fit:cover; border-radius:50%; border:1px solid rgba(255,255,255,0.5);">
        </div>
        <div class="marker-label">${pais}</div>
      </div>
    `,
    iconSize: [50, 58],
    iconAnchor: [25, 48],
    popupAnchor: [0, -48],
  });
}

// Icono resaltado (dorado para cercanas)
function crearIconoResaltado(pais) {
  const color = obtenerColorPorPais(pais);
  const dataUrl = obtenerBanderaBase64DesdeCache(pais);
  return L.divIcon({
    className: 'custom-flag-marker',
    html: `
      <div class="marker-container resaltado">
        <div class="marker-circle" style="background-color: ${color};">
          <img src="${dataUrl}" alt="${pais}" style="width:28px; height:28px; object-fit:cover; border-radius:50%; border:1px solid rgba(255,255,255,0.5);">
        </div>
        <div class="marker-label">${pais}</div>
      </div>
    `,
    iconSize: [50, 58],
    iconAnchor: [25, 48],
    popupAnchor: [0, -48],
  });
}

function obtenerBanderaBase64DesdeCache(pais) {
  const codigo = obtenerCodigoPais(pais);
  const url = `https://flagcdn.com/w40/${codigo}.png`;
  return cacheBanderaBase64.get(url) || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSIzMCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iMjAiIHk9IjE4IiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMDAwIj7wn6OzPC90ZXh0Pjwvc3ZnPg==';
}

function obtenerColorPorPais(nombrePais) {
  const colores = [
    '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6',
    '#1abc9c', '#e67e22', '#e84393', '#00b894', '#6c5ce7',
    '#fd79a8', '#0984e3', '#fdcb6e', '#00cec9', '#d63031',
    '#6ab04c', '#eb4d4b', '#f0932b', '#4834d4', '#be2edd'
  ];
  let hash = 0;
  for (let i = 0; i < nombrePais.length; i++) {
    hash = nombrePais.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % colores.length;
  return colores[idx];
}

function obtenerCodigoPais(nombrePais) {
  const paises = {
    'alemania': 'de', 'arabia saudita': 'sa', 'argelia': 'dz',
    'argentina': 'ar', 'australia': 'au', 'autralia': 'au',
    'austria': 'at', 'autria': 'at', 'azerbaiyán': 'az',
    'azerbaiyan': 'az', 'bélgica': 'be', 'belgica': 'be',
    'belice': 'bz', 'brasil': 'br', 'bulgaria': 'bg',
    'canadá': 'ca', 'canada': 'ca', 'chile': 'cl',
    'costa rica': 'cr',
    'china': 'cn', 'colombia': 'co', 'corea': 'kr',
    'dinamarca': 'dk', 'ecuador': 'ec', 'egipto': 'eg',
    'el salvador': 'sv', 'emitatos árabes': 'ae', 'emiratos árabes': 'ae',
    'emiratos arabes': 'ae', 'eslovaquia': 'sk', 'españa': 'es',
    'estados unidos': 'us', 'usa': 'us', 'eua': 'us',
    'filipinas': 'ph', 'finlandia': 'fi', 'francia': 'fr',
    'grecia': 'gr', 'guatemala': 'gt', 'haití': 'ht', 'haiti': 'ht',
    'honduras': 'hn', 'hungría': 'hu', 'hungria': 'hu',
    'india': 'in', 'indonesia': 'id', 'irlanda': 'ie',
    'italia': 'it', 'jamaica': 'jm', 'japón': 'jp', 'japon': 'jp',
    'jordania': 'jo', 'líbano': 'lb', 'libano': 'lb',
    'malasia': 'my', 'marruecos': 'ma', 'méxico': 'mx', 'mexico': 'mx',
    'nicaragua': 'ni', 'nigeria': 'ng', 'noruega': 'no',
    'nueva zelanda': 'nz', 'pakistán': 'pk', 'pakistan': 'pk',
    'panamá': 'pa', 'panama': 'pa', 'paraguay': 'py',
    'países bajos': 'nl', 'paises bajos': 'nl', 'polonia': 'pl',
    'portugal': 'pt', 'puerto rico': 'pr', 'perú': 'pe', 'peru': 'pe',
    'qatar': 'qa', 'reino unido': 'gb', 'inglaterra': 'gb',
    'república dominicana': 'do', 'republica dominicana': 'do',
    'republiica checa': 'cz', 'república checa': 'cz', 'republica checa': 'cz',
    'rumania': 'ro', 'rusia': 'ru', 'serbia': 'rs',
    'singapur': 'sg', 'sudáfrica': 'za', 'sudafrica': 'za',
    'suecia': 'se', 'suiza': 'ch', 'tailandia': 'th',
    'uruguay': 'uy', 'venezuela': 've', 'vietnam': 'vn'
  };
  const normalizado = nombrePais?.toLowerCase().trim() || '';
  return paises[normalizado] || 'un';
}

// Calcular cercanas
btnCalcularCercanas.addEventListener('click', () => {
  if (seleccionActual === null) {
    showAlert('Primero selecciona una embajada.', true);
    return;
  }
  const n = parseInt(numCercanas.value) || 2;
  if (n < 1) {
    showAlert('El número debe ser al menos 1.', true);
    return;
  }
  calcularCercanas(seleccionActual, n);
});

function calcularCercanas(index, n) {
  restaurarMarcadores();

  const origen = todasLasUbicaciones[index];
  if (!origen) return;

  const from = turf.point([origen.lng, origen.lat]);
  const distancias = todasLasUbicaciones
    .map((item, i) => {
      if (i === index) return null;
      const to = turf.point([item.lng, item.lat]);
      const distance = turf.distance(from, to, { units: 'kilometers' });
      return { index: i, distance, item };
    })
    .filter(d => d !== null)
    .sort((a, b) => a.distance - b.distance);

  const cercanas = distancias.slice(0, n);
  if (cercanas.length === 0) {
    showAlert('No hay otras embajadas.', true);
    return;
  }

  cercanas.forEach((d) => {
    const marker = todasLasUbicaciones[d.index].marker;
    if (marker) {
      const iconoResaltado = crearIconoResaltado(d.item.pais);
      marker.setIcon(iconoResaltado);
      marcadoresResaltados.push(marker);
    }
  });

  cercanasContainer.classList.remove('hidden');
  listaCercanas.innerHTML = cercanas.map(c => {
        const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${c.item.lat},${c.item.lng}`;
        return `
        <div class="bg-white/80 p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2 hover:border-blue-300 transition-colors">
            <div class="flex items-center gap-2">
                <img src="${obtenerBanderaBase64DesdeCache(c.item.pais)}" class="border border-slate-300 rounded-sm shadow-sm" alt="${c.item.pais}" style="width:20px; height:20px; object-fit:cover;">
                <span class="text-xs font-bold text-slate-800">${c.item.pais}</span>
                <span class="text-[10px] font-bold text-blue-700 ml-auto bg-blue-100/80 px-2 py-0.5 rounded-full shadow-inner">a ${c.distance.toFixed(1)} km</span>
            </div>
            <p class="text-[10px] text-slate-500 line-clamp-2" title="${c.item.direccion}">${c.item.direccion}</p>
            <a href="${gmapsUrl}" target="_blank" class="mt-1 text-center bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-semibold py-1.5 rounded-lg transition-all">
                Ver en Maps
            </a>
        </div>
        `;
    }).join('');

  showAlert(`Se encontraron ${cercanas.length} embajadas cercanas.`);
}

function restaurarMarcadores() {
  marcadoresResaltados.forEach(marker => {
    const ubicacion = todasLasUbicaciones.find(u => u.marker === marker);
    if (ubicacion) {
      // Solo restaurar si no es el marcador seleccionado actual
      if (marker !== marcadorSeleccionado) {
        const nuevoIcon = crearIconoNormal(ubicacion.pais);
        marker.setIcon(nuevoIcon);
      }
    }
  });
  marcadoresResaltados = [];
}

// ===== EXPORTAR IMAGEN =====
exportImgBtn.addEventListener('click', async () => {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) {
    showAlert('No se encontró el mapa.', true);
    return;
  }

  showAlert('Generando imagen...');

  try {
    map.invalidateSize();
    await new Promise(resolve => setTimeout(resolve, 400));

    const dataUrl = await toPng(mapContainer, {
      useCORS: true,
      backgroundColor: '#f0f2f5',
      pixelRatio: window.devicePixelRatio || 1,
      skipFonts: true,
    });

    const link = document.createElement('a');
    link.download = 'mapa-embajadas.png';
    link.href = dataUrl;
    link.click();

    showAlert('Imagen exportada con éxito.');
  } catch (error) {
    console.error('Error al exportar:', error);
    showAlert('Error al exportar la imagen: ' + error.message, true);
  }
});