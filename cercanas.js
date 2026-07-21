// cercanas.js
import * as turf from '@turf/turf';
import { todasLasUbicaciones, marcadoresResaltados, seleccionActual, setMarcadoresResaltados } from './state.js';
import { crearIconoNormal, crearIconoResaltado, obtenerBanderaBase64DesdeCache } from './markers.js';
import { showAlert } from './ui.js';

export function calcularCercanas(index, n) {
  // Obtener filtro actual
  const filtroSelect = document.getElementById('filtro-tipo');
  const filtro = filtroSelect ? filtroSelect.value : 'todos';

  // Restaurar marcadores resaltados previos
  restaurarMarcadores();

  const origen = todasLasUbicaciones[index];
  if (!origen) {
    showAlert('No se encontró la ubicación seleccionada.', true);
    return;
  }

  // Filtrar según el filtro
  let candidatos = todasLasUbicaciones;
  if (filtro !== 'todos') {
    candidatos = todasLasUbicaciones.filter(u => u.tipo === filtro);
  }

  // Verificar que el origen esté en el conjunto filtrado
  if (!candidatos.some(u => u.index === index)) {
    showAlert('La ubicación seleccionada no pertenece al filtro actual.', true);
    return;
  }

  const from = turf.point([origen.lng, origen.lat]);
  const distancias = candidatos
    .map((item) => {
      if (item.index === index) return null;
      const to = turf.point([item.lng, item.lat]);
      const distance = turf.distance(from, to, { units: 'kilometers' });
      return { index: item.index, distance, item };
    })
    .filter(d => d !== null)
    .sort((a, b) => a.distance - b.distance);

  const cercanas = distancias.slice(0, n);
  if (cercanas.length === 0) {
    showAlert('No hay otras ubicaciones del mismo tipo.', true);
    return;
  }

  const resaltados = [];
  cercanas.forEach((d) => {
    const marker = todasLasUbicaciones[d.index].marker;
    if (marker) {
      const iconoResaltado = crearIconoResaltado(d.item);
      marker.setIcon(iconoResaltado);
      resaltados.push(marker);
    }
  });
  setMarcadoresResaltados(resaltados);

  // Mostrar lista en el panel
  const cercanasContainer = document.getElementById('cercanas-container');
  const listaCercanas = document.getElementById('lista-cercanas');
  if (cercanasContainer) {
    cercanasContainer.classList.remove('hidden');
    listaCercanas.innerHTML = cercanas.map(c => {
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${c.item.lat},${c.item.lng}`;
      const esEmbajada = c.item.tipo === 'EMBAJADA';
      const banderaUrl = esEmbajada ? obtenerBanderaBase64DesdeCache(c.item.pais) : '';
      return `
        <div class="bg-white/80 p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2 hover:border-blue-300 transition-colors">
          <div class="flex items-center gap-2">
            ${esEmbajada ? `<img src="${banderaUrl}" class="border border-slate-300 rounded-sm shadow-sm" alt="${c.item.pais}" style="width:20px; height:20px; object-fit:cover;">` : ''}
            <span class="text-xs font-bold text-slate-800">${c.item.pertenece}</span>
            <span class="text-[10px] font-bold text-blue-700 ml-auto bg-blue-100/80 px-2 py-0.5 rounded-full shadow-inner">a ${c.distance.toFixed(1)} km</span>
          </div>
          <p class="text-[10px] text-slate-500 line-clamp-2" title="${c.item.direccion}">${c.item.direccion}</p>
          <a href="${gmapsUrl}" target="_blank" class="mt-1 text-center bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-semibold py-1.5 rounded-lg transition-all">Ver en Maps</a>
        </div>
      `;
    }).join('');
  }
  showAlert(`Se encontraron ${cercanas.length} ubicaciones cercanas.`);
}

export function restaurarMarcadores() {
  marcadoresResaltados.forEach(marker => {
    const ubicacion = todasLasUbicaciones.find(u => u.marker === marker);
    if (ubicacion) {
      const nuevoIcon = crearIconoNormal(ubicacion);
      marker.setIcon(nuevoIcon);
    }
  });
  setMarcadoresResaltados([]);
}