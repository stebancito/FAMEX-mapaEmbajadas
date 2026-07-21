// export.js
import { toPng } from 'html-to-image';
import { map } from './state.js';
import { showAlert } from './ui.js';

export async function exportarImagenMapa() {
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
}