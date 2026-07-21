// map.js
import { map, capaMarcadores, todasLasUbicaciones, marcadoresPorUbicacion, setTodasLasUbicaciones, setMarcadoresResaltados, setSeleccionActual, setMarcadorSeleccionado } from './state.js';
import { crearMarcador, cargarBanderaBase64 } from './markers.js';
import { showAlert } from './ui.js';
import { procesarDatosDeHoja } from './excel.js';

let workbookGlobal = null;

export function setWorkbook(wb) {
  workbookGlobal = wb;
}

export function getWorkbook() {
  return workbookGlobal;
}

export async function procesarHoja(sheetName) {
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

  showAlert('Cargando banderas...');

  // Cargar banderas solo para embajadas con país
  const paisesUnicos = [...new Set(validas.filter(item => item.tipo === 'EMBAJADA' && item.pais && item.pais !== 'Sin país').map(item => item.pais))];
  await Promise.all(paisesUnicos.map(pais => cargarBanderaBase64(pais)));

  showAlert(`¡Éxito! Ubicando ${validas.length} de ${totales} registros.`);

  // Limpiar capas y estado
  capaMarcadores.clearLayers();
  const nuevasUbicaciones = [];
  marcadoresPorUbicacion.clear();
  setMarcadoresResaltados([]);
  setSeleccionActual(null);
  setMarcadorSeleccionado(null);

  validas.forEach((item, index) => {
    // Verificar que item tenga lat/lng definidos
    if (item.lat === undefined || item.lng === undefined || isNaN(item.lat) || isNaN(item.lng)) {
      console.warn(`Omitiendo registro ${index} por coordenadas inválidas:`, item);
      return;
    }
    const marker = crearMarcador(item);
    const ubicacion = { ...item, index, marker };
    nuevasUbicaciones.push(ubicacion);
    marcadoresPorUbicacion.set(`${item.lat},${item.lng}`, marker);

    marker.on('click', () => {
      window.dispatchEvent(new CustomEvent('seleccionar-embajada', { detail: { index } }));
    });

    capaMarcadores.addLayer(marker);
  });

  setTodasLasUbicaciones(nuevasUbicaciones);

  // Disparar evento para que main.js actualice el filtro y seleccione la primera
  window.dispatchEvent(new CustomEvent('datos-cargados', { detail: { ubicaciones: nuevasUbicaciones } }));
}