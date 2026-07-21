// markers.js
import L from 'leaflet';
import { COLORES, PAISES_CODIGOS, BANDERA_FALLBACK } from './constants.js';
import { cacheBanderaBase64 } from './state.js';

export function obtenerCodigoPais(nombrePais) {
  if (!nombrePais || nombrePais === 'Sin país') return null;
  const normalizado = nombrePais.toLowerCase().trim();
  return PAISES_CODIGOS[normalizado] || null;
}

export async function cargarBanderaBase64(pais) {
  if (!pais || pais === 'Sin país') return BANDERA_FALLBACK;
  const codigo = obtenerCodigoPais(pais);
  if (!codigo) return BANDERA_FALLBACK;
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
    cacheBanderaBase64.set(url, BANDERA_FALLBACK);
    return BANDERA_FALLBACK;
  }
}

export function obtenerBanderaBase64DesdeCache(pais) {
  if (!pais || pais === 'Sin país') return BANDERA_FALLBACK;
  const codigo = obtenerCodigoPais(pais);
  if (!codigo) return BANDERA_FALLBACK;
  const url = `https://flagcdn.com/w40/${codigo}.png`;
  return cacheBanderaBase64.get(url) || BANDERA_FALLBACK;
}

export function obtenerColorPorNombre(nombre) {
  if (!nombre) return COLORES[0];
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORES[Math.abs(hash) % COLORES.length];
}

// Crea el icono base (normal, seleccionado o resaltado)
function crearIconoBase(ubicacion, extraClass = '') {
  const { tipo, pertenece, pais, direccion } = ubicacion;
  const color = obtenerColorPorNombre(tipo || direccion || 'ubicación');
  const esEmbajada = tipo === 'EMBAJADA';

  let contenidoIcono = '';
  if (esEmbajada && pais) {
    const dataUrl = obtenerBanderaBase64DesdeCache(pais);
    contenidoIcono = `<img src="${dataUrl}" alt="${pais}" style="width:28px; height:28px; object-fit:cover; border-radius:50%; border:1px solid rgba(255,255,255,0.5);">`;
  } else {
    const inicial = pertenece ? pertenece.charAt(0).toUpperCase() : '?';
    contenidoIcono = `<span style="font-size:16px; font-weight:bold; color:#fff; line-height:28px;">${inicial}</span>`;
  }

  const label = esEmbajada ? pais : (pertenece || direccion || 'Ubicación');

  return L.divIcon({
    className: 'custom-flag-marker',
    html: `
      <div class="marker-container ${extraClass}">
        <div class="marker-circle" style="background-color: ${color};">
          ${contenidoIcono}
        </div>
        <div class="marker-label">${label}</div>
      </div>
    `,
    iconSize: [50, 58],
    iconAnchor: [25, 48],
    popupAnchor: [0, -48],
  });
}

export function crearMarcador(ubicacion) {
  const icon = crearIconoBase(ubicacion);
  return L.marker([ubicacion.lat, ubicacion.lng], { icon });
}

export function crearIconoNormal(ubicacion) {
  return crearIconoBase(ubicacion);
}

export function crearIconoSeleccionado(ubicacion) {
  return crearIconoBase(ubicacion, 'seleccionado');
}

export function crearIconoResaltado(ubicacion) {
  return crearIconoBase(ubicacion, 'resaltado');
}