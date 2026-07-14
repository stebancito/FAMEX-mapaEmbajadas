import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as XLSX from 'xlsx';
import * as turf from '@turf/turf';
import { procesarDatosDeHoja } from './excel.js';
import { showAlert } from './ui.js';

const map = L.map('map').setView([19.4326, -99.1332], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
}).addTo(map);

let capaMarcadores = L.layerGroup().addTo(map);
let workbookGlobal = null;

// Almacenar todas las ubicaciones procesadas
let todasLasUbicaciones = [];
let marcadoresPorUbicacion = new Map(); // clave: lat+lng, valor: marker

// Referencias para resaltado
let marcadoresResaltados = [];

// Elementos DOM
const fileInput = document.getElementById('excel-upload');
const uploadBtn = document.getElementById('upload-btn');
const sheetSelectorContainer = document.getElementById('sheet-selector-container');
const sheetSelect = document.getElementById('sheet-select');
const processSheetBtn = document.getElementById('process-sheet-btn');
const toggleBtn = document.getElementById('toggle-panel');
const panel = document.getElementById('panel');

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
  showAlert(`¡Éxito! Trazando ${validas.length} embajadas.`);

  // Limpiar datos anteriores
  capaMarcadores.clearLayers();
  todasLasUbicaciones = [];
  marcadoresPorUbicacion.clear();
  marcadoresResaltados = [];

  validas.forEach((item, index) => {
    const marker = crearMarcador(item.pais, item.lat, item.lng);
    const ubicacion = { ...item, index, marker };
    todasLasUbicaciones.push(ubicacion);
    marcadoresPorUbicacion.set(`${item.lat},${item.lng}`, marker);

    marker.bindPopup(crearPopupHTML(item, index));
    capaMarcadores.addLayer(marker);
  });

  if (capaMarcadores.getLayers().length > 0) {
    const bounds = L.featureGroup(capaMarcadores.getLayers()).getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

// Crear marcador con bandera (fallback a genérico si no carga imagen)
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

  // Si hay error de carga, usar marcador genérico de Leaflet
  // (lo manejamos en el onerror de la imagen, pero también podemos forzar un cambio)
  // De momento, el fallback muestra un emoji, pero podemos mejorar: 
  // si falla, reemplazar todo el div con un marcador por defecto.
  // Para simplificar, dejamos el emoji.
  return L.marker([lat, lng], { icon });
}

function obtenerCodigoPais(nombrePais) {
  const paises = {
    'alemania': 'de', 'arabia saudita': 'sa', 'argelia': 'dz',
    'argentina': 'ar', 'australia': 'au', 'autralia': 'au',
    'austria': 'at', 'autria': 'at', 'azerbaiyán': 'az',
    'azerbaiyan': 'az', 'bélgica': 'be', 'belgica': 'be',
    'belice': 'bz', 'estados unidos': 'us', 'usa': 'us',
    'eua': 'us', 'canadá': 'ca', 'canada': 'ca',
    'españa': 'es', 'francia': 'fr', 'reino unido': 'gb',
    'inglaterra': 'gb', 'italia': 'it', 'japón': 'jp',
    'japon': 'jp', 'china': 'cn', 'rusia': 'ru',
    'brasil': 'br', 'colombia': 'co', 'perú': 'pe',
    'peru': 'pe', 'chile': 'cl', 'venezuela': 've',
    'ecuador': 'ec', 'guatemala': 'gt', 'cuba': 'cu',
    'bolivia': 'bo', 'república dominicana': 'do',
    'honduras': 'hn', 'paraguay': 'py', 'el salvador': 'sv',
    'nicaragua': 'ni', 'costa rica': 'cr', 'panamá': 'pa',
    'panama': 'pa', 'uruguay': 'uy', 'puerto rico': 'pr',
    'méxico': 'mx', 'mexico': 'mx',
  };
  const normalizado = nombrePais?.toLowerCase().trim() || '';
  return paises[normalizado] || 'un';
}

// Popup HTML con botón
function crearPopupHTML(item, index) {
  return `
    <div class="popup-embajada">
      <strong>${item.pais}</strong><br>
      ${item.direccion || 'Sin dirección'}<br>
      <small>${item.lat}, ${item.lng}</small><br>
      <button class="btn-cercanas" data-index="${index}">Dos más cercanas</button>
    </div>
  `;
}

// Manejar clics en el botón (usamos evento delegado en el mapa)
map.on('popupopen', (e) => {
  const popup = e.popup;
  const container = popup.getElement();
  if (!container) return;
  const btn = container.querySelector('.btn-cercanas');
  if (btn) {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      if (!isNaN(index)) {
        calcularYResaltarCercanas(index);
      }
    });
  }
});

// Cerrar popup al seleccionar otra cosa (para limpiar resaltados)
map.on('popupclose', () => {
  restaurarMarcadores();
});

function calcularYResaltarCercanas(index) {
  // Restaurar resaltados previos
  restaurarMarcadores();

  const origen = todasLasUbicaciones[index];
  if (!origen) return;

  // Calcular distancias a todas las demás
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

  // Tomar las dos primeras
  const dosCercanas = distancias.slice(0, 2);
  if (dosCercanas.length < 2) {
    showAlert('No hay suficientes embajadas para calcular las dos más cercanas.', true);
    return;
  }

  // Resaltar esos dos marcadores
  dosCercanas.forEach((d) => {
    const marker = todasLasUbicaciones[d.index].marker;
    if (marker) {
      // Cambiar ícono a uno resaltado (con borde dorado)
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

  // Mostrar mensaje con las distancias
  showAlert(`Las dos más cercanas: ${dosCercanas[0].item.pais} (${dosCercanas[0].distance.toFixed(1)} km) y ${dosCercanas[1].item.pais} (${dosCercanas[1].distance.toFixed(1)} km)`);
}

function restaurarMarcadores() {
  marcadoresResaltados.forEach(marker => {
    // Reconstruir ícono original (sin resaltado)
    // Para simplificar, guardamos el país original en el marker o lo buscamos en todasLasUbicaciones
    // Aquí usamos una búsqueda por coordenadas, pero mejor guardar referencia.
    // Como tenemos el marker, buscamos en todasLasUbicaciones el que coincida con ese marker.
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