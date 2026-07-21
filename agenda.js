// agenda.js
import { agendaItems, setAgendaItems, mesActualOffset, setMesActualOffset, diaSeleccionado, setDiaSeleccionado, todasLasUbicaciones, seleccionActual } from './state.js';
import { showAlert } from './ui.js';
import { obtenerBanderaBase64DesdeCache } from './markers.js';

// Renderizar lista de agenda
export function renderizarAgenda() {
  const listaAgenda = document.getElementById('lista-agenda');
  if (!listaAgenda) return;

  if (agendaItems.length === 0) {
    listaAgenda.innerHTML = `<p class="text-xs text-slate-500 italic">Aún no hay embajadas en la agenda.</p>`;
    return;
  }

  const grupos = {};
  agendaItems.forEach(item => {
    if (!grupos[item.fecha]) grupos[item.fecha] = [];
    grupos[item.fecha].push(item);
  });
  const fechasOrdenadas = Object.keys(grupos).sort();

  let html = '';
  fechasOrdenadas.forEach(fecha => {
    html += `<div class="mb-4">`;
    html += `<div class="text-xs font-bold text-slate-700 border-b border-slate-200 pb-1 mb-2 flex items-center gap-2">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              ${fecha}
            </div>`;
    grupos[fecha].forEach((item, idx) => {
      const globalIdx = agendaItems.indexOf(item);
      html += `
        <div class="bg-white/70 p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2 mb-1.5">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1">
              <span class="font-bold text-xs text-slate-800 truncate">${item.pais}</span>
              <span class="text-[10px] text-slate-500">${item.hora}</span>
            </div>
            <p class="text-[10px] text-slate-600 truncate">${item.direccion}</p>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="agenda-mover-up" data-idx="${globalIdx}" title="Subir">
              <svg class="w-4 h-4 text-slate-600 hover:text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
            </button>
            <button class="agenda-mover-down" data-idx="${globalIdx}" title="Bajar">
              <svg class="w-4 h-4 text-slate-600 hover:text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button class="agenda-eliminar" data-idx="${globalIdx}" title="Eliminar">
              <svg class="w-4 h-4 text-red-500 hover:text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  });

  listaAgenda.innerHTML = html;

  // Eventos para mover/eliminar
  document.querySelectorAll('.agenda-mover-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx);
      moverAgenda(idx, -1);
    });
  });
  document.querySelectorAll('.agenda-mover-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx);
      moverAgenda(idx, 1);
    });
  });
  document.querySelectorAll('.agenda-eliminar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx);
      eliminarDeAgenda(idx);
    });
  });
}

export function moverAgenda(idx, delta) {
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= agendaItems.length) return;
  [agendaItems[idx], agendaItems[newIdx]] = [agendaItems[newIdx], agendaItems[idx]];
  renderizarAgenda();
  showAlert('Orden actualizado.');
}

export function eliminarDeAgenda(idx) {
  agendaItems.splice(idx, 1);
  renderizarAgenda();
  showAlert('Embajada eliminada de la agenda.');
}

export function agregarAAgenda(fecha, hora) {
  if (seleccionActual === null) {
    showAlert('Primero selecciona una embajada.', true);
    return false;
  }
  const item = todasLasUbicaciones[seleccionActual];
  if (!item) return false;

  if (!fecha || !hora) {
    showAlert('Selecciona fecha y hora para la visita.', true);
    return false;
  }

  const existe = agendaItems.some(a => a.pais === item.pais && a.fecha === fecha && a.hora === hora);
  if (existe) {
    showAlert('Esta embajada ya está agendada para esa fecha y hora.', true);
    return false;
  }

  agendaItems.push({
    pais: item.pais,
    direccion: item.direccion,
    lat: item.lat,
    lng: item.lng,
    fecha: fecha,
    hora: hora,
  });
  renderizarAgenda();
  showAlert(`Agregada ${item.pais} a la agenda.`);
  return true;
}

// ===== CALENDARIO =====
export function renderizarCalendario(offset) {
  const fecha = obtenerFechaBase(offset);
  const año = fecha.getFullYear();
  const mes = fecha.getMonth();
  const primerDia = new Date(año, mes, 1);
  const ultimoDia = new Date(año, mes + 1, 0);
  const diasEnMes = ultimoDia.getDate();
  const diaInicioSemana = primerDia.getDay();

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('cal-mes-titulo').textContent = `${meses[mes]} ${año}`;

  const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let html = diasSemana.map(d => `<div class="font-bold text-xs text-slate-500">${d}</div>`).join('');

  for (let i = 0; i < diaInicioSemana; i++) {
    html += `<div></div>`;
  }

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaStr = `${año}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const eventosDia = agendaItems.filter(item => item.fecha === fechaStr);
    const tieneEventos = eventosDia.length > 0;
    let contenidoDia = `<div class="text-xs font-bold">${dia}</div>`;
    if (tieneEventos) {
      const maxMostrar = 2;
      const itemsMostrar = eventosDia.slice(0, maxMostrar);
      contenidoDia += `<div class="text-[8px] leading-tight mt-1">`;
      itemsMostrar.forEach(ev => {
        const abrev = ev.pais.length > 12 ? ev.pais.substring(0,10)+'…' : ev.pais;
        contenidoDia += `<div class="truncate text-left px-0.5">${abrev} ${ev.hora}</div>`;
      });
      if (eventosDia.length > maxMostrar) {
        contenidoDia += `<div class="text-[8px] text-slate-500">+${eventosDia.length - maxMostrar} más</div>`;
      }
      contenidoDia += `</div>`;
    }
    const clasesDia = `p-1 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors min-h-[60px] flex flex-col ${tieneEventos ? 'bg-blue-50/80' : ''} ${diaSeleccionado === fechaStr ? 'ring-2 ring-blue-500' : ''}`;
    html += `<div class="${clasesDia}" data-fecha="${fechaStr}">${contenidoDia}</div>`;
  }

  document.getElementById('cal-grid').innerHTML = html;

  document.querySelectorAll('#cal-grid [data-fecha]').forEach(el => {
    el.addEventListener('click', () => {
      const fecha = el.dataset.fecha;
      setDiaSeleccionado(fecha);
      document.querySelectorAll('#cal-grid [data-fecha]').forEach(c => c.classList.remove('ring-2', 'ring-blue-500'));
      el.classList.add('ring-2', 'ring-blue-500');
      mostrarEventosDelDia(fecha);
    });
  });

  // Seleccionar primer día con eventos o el día actual
  const hoyStr = new Date().toISOString().slice(0,10);
  let fechaInicial = hoyStr;
  if (!agendaItems.some(item => item.fecha === hoyStr)) {
    const fechasConEventos = [...new Set(agendaItems.map(item => item.fecha))].sort();
    fechaInicial = fechasConEventos.length > 0 ? fechasConEventos[0] : null;
  }
  if (fechaInicial && agendaItems.some(item => item.fecha === fechaInicial)) {
    setDiaSeleccionado(fechaInicial);
    document.querySelectorAll('#cal-grid [data-fecha]').forEach(el => {
      if (el.dataset.fecha === fechaInicial) {
        el.classList.add('ring-2', 'ring-blue-500');
      }
    });
    mostrarEventosDelDia(fechaInicial);
  } else {
    document.getElementById('cal-lista-eventos').innerHTML = `<p class="text-xs text-slate-500 italic">No hay eventos en la agenda.</p>`;
  }
}

function obtenerFechaBase(offset) {
  const hoy = new Date();
  hoy.setMonth(hoy.getMonth() + offset);
  return hoy;
}

function mostrarEventosDelDia(fecha) {
  const eventos = agendaItems.filter(item => item.fecha === fecha);
  const contenedor = document.getElementById('cal-lista-eventos');
  if (eventos.length === 0) {
    contenedor.innerHTML = `<p class="text-xs text-slate-500 italic">No hay eventos para este día.</p>`;
    return;
  }
  let html = `<div class="text-xs font-semibold text-slate-600 mb-2">${fecha}</div>`;
  eventos.forEach(item => {
    html += `
      <div class="bg-white/80 p-2 rounded-lg border border-slate-200 flex items-center gap-2">
        <span class="font-bold text-xs text-slate-800">${item.pais}</span>
        <span class="text-[10px] text-slate-500">${item.hora}</span>
        <span class="text-[10px] text-slate-600 truncate flex-1">${item.direccion}</span>
      </div>
    `;
  });
  contenedor.innerHTML = html;
}