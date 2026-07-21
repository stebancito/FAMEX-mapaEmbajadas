// main.js
import './style.css';
import 'leaflet/dist/leaflet.css';


import {
  map,
  capaMarcadores,
  todasLasUbicaciones,
  seleccionActual,
  marcadorSeleccionado,
  agendaItems,
  mesActualOffset,
  setWorkbookGlobal,
  setSeleccionActual,
  setMarcadorSeleccionado,
  setAgendaItems,
  setMesActualOffset
} from './state.js';

import { showAlert } from './ui.js';
import { procesarHoja, setWorkbook } from './map.js';
import { obtenerBanderaBase64DesdeCache, crearIconoNormal, crearIconoSeleccionado } from './markers.js';
import { calcularCercanas, restaurarMarcadores } from './cercanas.js';
import { renderizarAgenda, agregarAAgenda, renderizarCalendario } from './agenda.js';
import { exportarImagenMapa } from './export.js';
import * as XLSX from 'xlsx';

// ----- DOM references -----
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
const listaAgenda = document.getElementById('lista-agenda');
const verCalendarioBtn = document.getElementById('ver-calendario-btn');
const fechaVisita = document.getElementById('fecha-visita');
const horaVisita = document.getElementById('hora-visita');
const btnAgregarAgenda = document.getElementById('btn-agregar-agenda');
const modalCalendario = document.getElementById('modal-calendario');
const cerrarModalCalendario = document.getElementById('cerrar-modal-calendario');
const calMesAnterior = document.getElementById('cal-mes-anterior');
const calMesSiguiente = document.getElementById('cal-mes-siguiente');
const guardarAgendaBtn = document.getElementById('guardar-agenda-btn');
const cargarAgendaBtn = document.getElementById('cargar-agenda-btn');
const agendaUpload = document.getElementById('agenda-upload');
const tabMapa = document.getElementById('tab-mapa');
const tabAgenda = document.getElementById('tab-agenda');
const contenidoMapa = document.getElementById('contenido-mapa');
const contenidoAgenda = document.getElementById('contenido-agenda');
const filtroTipo = document.getElementById('filtro-tipo'); // nuevo

// ----- Panel toggle -----
let panelAbierto = true;
function togglePanel(abrir) {
  if (typeof abrir === 'boolean') panelAbierto = abrir;
  else panelAbierto = !panelAbierto;

  if (panelAbierto) {
    panel.style.display = 'flex';
    toggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />`;
    toggleBtn.classList.remove('bg-slate-800/80', 'hover:bg-slate-700');
    toggleBtn.classList.add('bg-slate-800/90', 'hover:bg-slate-900');
  } else {
    panel.style.display = 'none';
    toggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />`;
    toggleBtn.classList.remove('bg-slate-800/90', 'hover:bg-slate-900');
    toggleBtn.classList.add('bg-slate-800/80', 'hover:bg-slate-700');
  }
}
toggleBtn.addEventListener('click', () => togglePanel());
closePanelBtn.addEventListener('click', () => togglePanel(false));

function asegurarPanelAbierto() {
  if (!panelAbierto) togglePanel(true);
}

// ----- Pestañas -----
function mostrarPestana(pestana) {
  if (pestana === 'mapa') {
    contenidoMapa.classList.remove('hidden');
    contenidoAgenda.classList.add('hidden');
    tabMapa.classList.add('border-blue-500', 'text-slate-700');
    tabMapa.classList.remove('border-transparent', 'text-slate-400');
    tabAgenda.classList.remove('border-blue-500', 'text-slate-700');
    tabAgenda.classList.add('border-transparent', 'text-slate-400');
  } else {
    contenidoMapa.classList.add('hidden');
    contenidoAgenda.classList.remove('hidden');
    tabAgenda.classList.add('border-blue-500', 'text-slate-700');
    tabAgenda.classList.remove('border-transparent', 'text-slate-400');
    tabMapa.classList.remove('border-blue-500', 'text-slate-700');
    tabMapa.classList.add('border-transparent', 'text-slate-400');
  }
}
tabMapa.addEventListener('click', () => mostrarPestana('mapa'));
tabAgenda.addEventListener('click', () => mostrarPestana('agenda'));

// ----- Carga de Excel -----
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = evt.target.result;
    const wb = XLSX.read(data, { type: 'binary' });
    setWorkbook(wb);
    setWorkbookGlobal(wb);
    const sheetNames = wb.SheetNames;
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

// ----- Evento personalizado para selección de embajada -----
window.addEventListener('seleccionar-embajada', (e) => {
  const index = e.detail.index;
  seleccionarEmbajada(index);
});

// ----- Evento personalizado cuando se cargan nuevos datos -----
window.addEventListener('datos-cargados', (e) => {
  const ubicaciones = e.detail.ubicaciones;
  const tipos = [...new Set(ubicaciones.map(u => u.tipo).filter(t => t))];
  if (filtroTipo) {
    filtroTipo.innerHTML = '<option value="todos">Todos</option>';
    tipos.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      filtroTipo.appendChild(opt);
    });
    filtroTipo.value = 'todos';
  }
  aplicarFiltro('todos');
  if (ubicaciones.length > 0) {
    window.dispatchEvent(new CustomEvent('seleccionar-embajada', { detail: { index: 0 } }));
  }
});

// ----- Función de filtrado -----
function aplicarFiltro(tipo) {
  // Restaurar resaltados antes de cambiar
  restaurarMarcadores();
  const cercanasContainer = document.getElementById('cercanas-container');
  if (cercanasContainer) cercanasContainer.classList.add('hidden');
  const listaCercanas = document.getElementById('lista-cercanas');
  if (listaCercanas) listaCercanas.innerHTML = '';

  capaMarcadores.clearLayers();
  let seleccionados = todasLasUbicaciones;
  if (tipo !== 'todos') {
    seleccionados = todasLasUbicaciones.filter(u => u.tipo === tipo);
  }
  seleccionados.forEach(u => {
    capaMarcadores.addLayer(u.marker);
  });

  // Actualizar selección si está visible
  if (seleccionActual !== null) {
    const item = todasLasUbicaciones[seleccionActual];
    if (item && (tipo === 'todos' || item.tipo === tipo)) {
      // mantener selección
    } else {
      setSeleccionActual(null);
      setMarcadorSeleccionado(null);
      detalleEmbajada.classList.add('hidden');
    }
  }

  // Ajustar vista
  if (capaMarcadores.getLayers().length > 0) {
    const bounds = L.featureGroup(capaMarcadores.getLayers()).getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}
// Evento cambio del filtro
if (filtroTipo) {
  filtroTipo.addEventListener('change', () => {
    aplicarFiltro(filtroTipo.value);
  });
}

// ----- Función de selección de embajada -----
function seleccionarEmbajada(index) {
  asegurarPanelAbierto();

  // Restaurar marcador seleccionado anterior
  if (marcadorSeleccionado) {
    const ubicAnterior = todasLasUbicaciones.find(u => u.marker === marcadorSeleccionado);
    if (ubicAnterior) {
      const nuevoIcon = crearIconoNormal(ubicAnterior);
      marcadorSeleccionado.setIcon(nuevoIcon);
    }
    setMarcadorSeleccionado(null);
  }

  restaurarMarcadores();

  setSeleccionActual(index);
  const item = todasLasUbicaciones[index];
  if (!item) return;

  const iconoSeleccionado = crearIconoSeleccionado(item);
  item.marker.setIcon(iconoSeleccionado);
  setMarcadorSeleccionado(item.marker);

  detalleEmbajada.classList.remove('hidden');
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
  const esEmbajada = item.tipo === 'EMBAJADA';
  const tieneBandera = esEmbajada && item.pais && item.pais !== 'Sin país';
  const banderaUrl = tieneBandera ? obtenerBanderaBase64DesdeCache(item.pais) : '';

  infoEmbajada.innerHTML = `
    <div class="text-center">
      ${tieneBandera ? `<img src="${banderaUrl}" class="mx-auto mb-2 border border-slate-300 rounded shadow-sm" style="width:40px; height:auto;" alt="${item.pais}">` : ''}
      <h3 class="font-black text-slate-800 text-base uppercase tracking-wider mb-2">${item.pertenece}</h3>
      <p class="text-xs text-slate-600 mb-1">Tipo: <span class="font-semibold">${item.tipo}</span></p>
      <p class="text-xs text-slate-700 mb-3 bg-slate-100 p-2 rounded border border-slate-200">
        <span class="font-semibold">Horario:</span> ${item.horario || 'No especificado'}
      </p>
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

// ----- Calcular cercanas -----
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

// ----- Exportar imagen -----
exportImgBtn.addEventListener('click', exportarImagenMapa);

// ----- Agenda -----
btnAgregarAgenda.addEventListener('click', () => {
  const fecha = fechaVisita.value;
  const hora = horaVisita.value;
  agregarAAgenda(fecha, hora);
});

guardarAgendaBtn.addEventListener('click', () => {
  if (agendaItems.length === 0) {
    showAlert('La agenda está vacía. Agrega algunas embajadas.', true);
    return;
  }
  const data = JSON.stringify(agendaItems, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agenda-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showAlert('Agenda guardada correctamente.');
});

cargarAgendaBtn.addEventListener('click', () => agendaUpload.click());
agendaUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!Array.isArray(data)) throw new Error('Formato inválido');
      setAgendaItems(data);
      renderizarAgenda();
      showAlert(`Agenda cargada con ${data.length} elementos.`);
    } catch (err) {
      showAlert('Error al cargar el archivo: ' + err.message, true);
    }
  };
  reader.readAsText(file);
  agendaUpload.value = '';
});

// ----- Calendario -----
verCalendarioBtn.addEventListener('click', () => {
  modalCalendario.classList.remove('hidden');
  setMesActualOffset(0);
  renderizarCalendario(0);
});

calMesAnterior.addEventListener('click', () => {
  const nuevoOffset = mesActualOffset - 1;
  setMesActualOffset(nuevoOffset);
  renderizarCalendario(nuevoOffset);
});
calMesSiguiente.addEventListener('click', () => {
  const nuevoOffset = mesActualOffset + 1;
  setMesActualOffset(nuevoOffset);
  renderizarCalendario(nuevoOffset);
});

// ----- Cerrar modal del calendario (CORREGIDO) -----
cerrarModalCalendario.addEventListener('click', () => {
  modalCalendario.classList.add('hidden');
});

// Cerrar modal al hacer clic fuera (fondo oscuro)
modalCalendario.addEventListener('click', (e) => {
  if (e.target === modalCalendario) {
    modalCalendario.classList.add('hidden');
  }
});

// ----- Inicializar mapa y agenda -----
renderizarAgenda();

function ajustarMapa() {
  map.invalidateSize();
}

window.addEventListener('load', () => {
  ajustarMapa();
  setTimeout(ajustarMapa, 300);
});

window.addEventListener('resize', ajustarMapa);

console.log('Sistema de Embajadas iniciado correctamente.');