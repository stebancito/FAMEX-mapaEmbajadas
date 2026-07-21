// state.js
import L from 'leaflet';

// Variables del mapa y capas
export const map = L.map('map').setView([19.432761349059973, -99.13321947725065], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
}).addTo(map);

export let capaMarcadores = L.layerGroup().addTo(map);
export let workbookGlobal = null;
export let todasLasUbicaciones = [];      // array de objetos con { direccion, pais, lat, lng, horario, index, marker }
export const marcadoresPorUbicacion = new Map(); // clave "lat,lng" -> marker
export let marcadoresResaltados = [];
export let seleccionActual = null;        // índice en todasLasUbicaciones
export let marcadorSeleccionado = null;   // referencia al marker con resaltado azul
export const cacheBanderaBase64 = new Map();
export let panelAbierto = true;
export let agendaItems = [];
export let mesActualOffset = 0;
export let diaSeleccionado = null;

// Funciones para actualizar el estado (para mantener consistencia)
export function setCapaMarcadores(nuevaCapa) {
  capaMarcadores = nuevaCapa;
}
export function setWorkbookGlobal(wb) {
  workbookGlobal = wb;
}
export function setTodasLasUbicaciones(ubicaciones) {
  todasLasUbicaciones = ubicaciones;
}
export function setMarcadoresResaltados(arr) {
  marcadoresResaltados = arr;
}
export function setSeleccionActual(idx) {
  seleccionActual = idx;
}
export function setMarcadorSeleccionado(marker) {
  marcadorSeleccionado = marker;
}
export function setAgendaItems(items) {
  agendaItems = items;
}
export function setMesActualOffset(offset) {
  mesActualOffset = offset;
}
export function setDiaSeleccionado(dia) {
  diaSeleccionado = dia;
}