import * as XLSX from 'xlsx';

export function procesarDatosDeHoja(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (jsonData.length === 0) {
    return { totales: 0, validas: [] };
  }

  let totalUbicaciones = 0;
  const ubicacionesValidas = [];

  jsonData.forEach((fila) => {
    const ubicacion =
      fila['UBICACIÓN'] || fila['Ubicación'] || fila['ubicación'] || '';
    const pais =
      fila['PAIS'] || fila['Pais'] || fila['pais'] || fila['PAÍS'] || 'Desconocido';
    const coords =
      fila['LATITUD y LONGITUD'] ||
      fila['Latitud y Longitud'] ||
      fila['latitud y longitud'] ||
      '';

    if (pais !== 'Desconocido' || ubicacion !== '') {
      totalUbicaciones++;

      if (coords && coords.toString().includes(',')) {
        const partes = coords.toString().split(',');
        const lat = parseFloat(partes[0].trim());
        const lng = parseFloat(partes[1].trim());

        if (!isNaN(lat) && !isNaN(lng)) {
          ubicacionesValidas.push({
            direccion: ubicacion,
            pais: pais,
            lat: lat,
            lng: lng,
          });
        }
      }
    }
  });

  return { totales: totalUbicaciones, validas: ubicacionesValidas };
}