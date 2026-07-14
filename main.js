import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as XLSX from 'xlsx';
import * as turf from '@turf/turf';
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
let seleccionActual = null; // índice de la embajada seleccionada

// Elementos DOM
const fileInput = document.getElementById('excel-upload');
const uploadBtn = document.getElementById('upload-btn');
const sheetSelectorContainer = document.getElementById('sheet-selector-container');
const sheetSelect = document.getElementById('sheet-select');
const processSheetBtn = document.getElementById('process-sheet-btn');
const toggleBtn = document.getElementById('toggle-panel');
const panel = document.getElementById('panel');
const detalleEmbajada = document.getElementById('detalle-embajada');
const infoEmbajada = document.getElementById('info-embajada');
const btnVerMaps = document.getElementById('btn-ver-maps');
const numCercanas = document.getElementById('num-cercanas');
const btnCalcularCercanas = document.getElementById('btn-calcular-cercanas');
const cercanasContainer = document.getElementById('cercanas-container');
const listaCercanas = document.getElementById('lista-cercanas');

// Toggle panel
let panelVisible = true;
toggleBtn.addEventListener('click', () => {
  panelVisible = !panelVisible;
  panel.style.display = panelVisible ? 'block' : 'none';
  toggleBtn.textContent = panelVisible ? '✕' : '☰';
});

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

function procesarHoja(sheetName) {
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
  showAlert(`¡Éxito! Ubicando ${validas.length} de ${totales} embajadas.`);

  capaMarcadores.clearLayers();
  todasLasUbicaciones = [];
  marcadoresPorUbicacion.clear();
  marcadoresResaltados = [];
  seleccionActual = null;
  detalleEmbajada.classList.add('hidden');
  cercanasContainer.classList.add('hidden');

  validas.forEach((item, index) => {
    const marker = crearMarcador(item.pais, item.lat, item.lng);
    const ubicacion = { ...item, index, marker };
    todasLasUbicaciones.push(ubicacion);
    marcadoresPorUbicacion.set(`${item.lat},${item.lng}`, marker);

    // Evento click en el marcador
    marker.on('click', () => {
      seleccionarEmbajada(index);
    });

    capaMarcadores.addLayer(marker);
  });

  if (capaMarcadores.getLayers().length > 0) {
    const bounds = L.featureGroup(capaMarcadores.getLayers()).getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  // Si hay al menos una, seleccionar la primera por defecto
  if (todasLasUbicaciones.length > 0) {
    seleccionarEmbajada(0);
  }
}

function seleccionarEmbajada(index) {
  // Restaurar resaltados previos
  restaurarMarcadores();

  seleccionActual = index;
  const item = todasLasUbicaciones[index];
  if (!item) return;

  // Mostrar detalles en el panel
  detalleEmbajada.classList.remove('hidden');
  // infoEmbajada.innerHTML = `
  //   <p><span class="font-semibold">País:</span> ${item.pais}</p>
  //   <p><span class="font-semibold">Dirección:</span> ${item.direccion || 'Sin dirección'}</p>
  //   <p><span class="font-semibold">Coordenadas:</span> ${item.lat}, ${item.lng}</p>
  // `;

  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;

  // Inyectar HTML de la embajada principal
  infoEmbajada.innerHTML = `
      <div class="text-center">
          <img src="https://flagcdn.com/w80/${obtenerCodigoPais(item.pais)}.png" class="mx-auto mb-3 border border-slate-200 rounded shadow-sm" alt="Bandera">
          <h3 class="font-black text-slate-800 text-base uppercase tracking-wider mb-2">${item.pais}</h3>
          <p class="text-[11px] font-medium text-slate-600 leading-relaxed mb-4 text-left border-l-2 border-blue-500 pl-2 bg-slate-50 p-2 rounded">${item.direccion}</p>
          
          <a href="${gmapsUrl}" target="_blank" class="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-md">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              Abrir en Google Maps
          </a>
      </div>
  `;


  // Limpiar lista de cercanas
  cercanasContainer.classList.add('hidden');
  listaCercanas.innerHTML = '';

  // Centrar mapa en la embajada seleccionada
  map.setView([item.lat, item.lng], 16);
}

// Crear marcador con bandera
function crearMarcador(pais, lat, lng) {
  const codigo = obtenerCodigoPais(pais);
  const icon = L.divIcon({
    className: 'custom-flag-marker',
    html: `
      <div class="marker-pin-small">
        <div class="marker-flag-small">
          <img src="https://flagcdn.com/w40/${codigo}.png" alt="${pais}" 
               onerror="this.parentElement.innerHTML='<span class=\\'flag-fallback\\'>🏳️</span>';">
        </div>
      </div>
    `,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -35],
  });
  return L.marker([lat, lng], { icon });
}

function obtenerCodigoPais(nombrePais) {
  const paises = {
    'alemania': 'de', 'arabia saudita': 'sa', 'argelia': 'dz',
    'argentina': 'ar', 'australia': 'au', 'autralia': 'au',
    'austria': 'at', 'autria': 'at', 'azerbaiyán': 'az',
    'azerbaiyan': 'az', 'bélgica': 'be', 'belgica': 'be',
    'belice': 'bz', 'brasil': 'br', 'bulgaria': 'bg',
    'canadá': 'ca', 'canada': 'ca', 'chile': 'cl',
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

// Calcular y mostrar cercanas
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
  restaurarMarcadores(); // Limpiar resaltados previos

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

  // Resaltar en el mapa
  cercanas.forEach((d) => {
    const marker = todasLasUbicaciones[d.index].marker;
    if (marker) {
      const iconoResaltado = L.divIcon({
        className: 'custom-flag-marker resaltado',
        html: `
          <div class="marker-pin-small resaltado">
            <div class="marker-flag-small" style="border-color: #FFD700; box-shadow: 0 0 15px #FFD700;">
              <img src="https://flagcdn.com/w40/${obtenerCodigoPais(d.item.pais)}.png" alt="${d.item.pais}" 
                   onerror="this.parentElement.innerHTML='<span class=\\'flag-fallback\\'>🏳️</span>';">
            </div>
            <div class="circulo-resaltado"></div>
          </div>
        `,
        iconSize: [30, 38],
        iconAnchor: [15, 38],
        popupAnchor: [0, -35],
      });
      marker.setIcon(iconoResaltado);
      marcadoresResaltados.push(marker);
    }
  });

  // // Mostrar lista en el panel
  cercanasContainer.classList.remove('hidden');
  listaCercanas.innerHTML = cercanas.map(c => {
        const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${c.item.lat},${c.item.lng}`;
        return `
        <div class="bg-white/80 p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 hover:border-blue-300 transition-colors">
            <div class="flex items-center gap-2">
                <img src="https://flagcdn.com/w20/${obtenerCodigoPais(c.item.pais)}.png" class="border border-slate-300 rounded-sm shadow-sm" alt="${c.item.pais}">
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

  // Agregar eventos a los botones de centrar
  listaCercanas.querySelectorAll('.btn-centrar-cercana').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      if (!isNaN(idx)) {
        const item = todasLasUbicaciones[idx];
        if (item) {
          map.setView([item.lat, item.lng], 12);
          // Opcional: seleccionar esa embajada en el panel
          seleccionarEmbajada(idx);
        }
      }
    });
  });

  showAlert(`Se encontraron ${cercanas.length} embajadas cercanas.`);
}

function restaurarMarcadores() {
  marcadoresResaltados.forEach(marker => {
    const ubicacion = todasLasUbicaciones.find(u => u.marker === marker);
    if (ubicacion) {
      const nuevoIcon = crearIconoNormal(ubicacion.pais);
      marker.setIcon(nuevoIcon);
    }
  });
  marcadoresResaltados = [];
}

function crearIconoNormal(pais) {
  const codigo = obtenerCodigoPais(pais);
  return L.divIcon({
    className: 'custom-flag-marker',
    html: `
      <div class="marker-pin-small">
        <div class="marker-flag-small">
          <img src="https://flagcdn.com/w40/${codigo}.png" alt="${pais}" 
               onerror="this.parentElement.innerHTML='<span class=\\'flag-fallback\\'>🏳️</span>';">
        </div>
      </div>
    `,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -35],
  });
}