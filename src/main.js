import L from 'leaflet';

// 1. Inicializar el mapa
// El primer array [23.6345, -102.5528] son las coordenadas (Latitud, Longitud)
// El número '5' es el nivel de zoom inicial
const map = L.map('map').setView([23.6345, -102.5528], 5);

// 2. Añadir la capa base del mapa (usamos OpenStreetMap que es gratis)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// 3. Agregar un marcador de prueba para validar que funcione
L.marker([19.4326, -99.1332]).addTo(map)
    .bindPopup('<b>¡Hola!</b><br>Aquí aparecerán tus embajadas.')
    .openPopup();