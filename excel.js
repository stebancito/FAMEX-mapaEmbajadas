// excel.js
import * as XLSX from 'xlsx';

function getValue(row, ...keys) {
  const rowKeys = Object.keys(row);
  // Búsqueda exacta
  for (let key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  // Búsqueda insensible a mayúsculas/minúsculas y espacios
  const lowerRowKeys = rowKeys.map(k => k.toLowerCase().trim());
  for (let key of keys) {
    const idx = lowerRowKeys.indexOf(key.toLowerCase().trim());
    if (idx !== -1) {
      const val = row[rowKeys[idx]];
      if (val !== undefined && val !== '') return val;
    }
  }
  return '';
}

export function procesarDatosDeHoja(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  console.log('Filas leídas:', jsonData.length);

  if (jsonData.length === 0) {
    return { totales: 0, validas: [] };
  }

  let totalUbicaciones = 0;
  const ubicacionesValidas = [];

  jsonData.forEach((fila, idx) => {
    const tipo = getValue(fila, 'TIPO', 'tipo').toUpperCase().trim();
    const ubicacion = getValue(fila, 'UBICACIÓN', 'ubicación', 'UBICACION', 'ubicacion');
    const pertenece = getValue(fila, 'PERTENECE', 'pertenece');
    const coords = getValue(
      fila,
      'LATITUD y LONGITUD',
      'latitud y longitud',
      'LATITUD Y LONGITUD',
      'LATITUD, LONGITUD',
      'latitud, longitud',
      'LATITUD/LONGITUD',
      'latitud/longitud'
    );
    const horario = getValue(fila, 'HORARIO', 'horario');

    // Si no hay ubicación ni pertenece, lo ignoramos
    if (ubicacion === '' && pertenece === '') {
      return;
    }

    totalUbicaciones++;

    // Intentar extraer coordenadas
    let lat = NaN, lng = NaN;
    if (coords && typeof coords === 'string' && coords.includes(',')) {
      const partes = coords.split(',').map(s => s.trim());
      if (partes.length >= 2) {
        lat = parseFloat(partes[0]);
        lng = parseFloat(partes[1]);
      }
    } else if (coords && typeof coords === 'number') {
      // Podría ser un número único, pero necesitamos dos valores, lo ignoramos
      console.warn(`Fila ${idx + 1}: coordenadas como número simple (${coords}), se ignora.`);
    } else {
      console.warn(`Fila ${idx + 1}: coordenadas no encontradas o formato inválido: "${coords}"`);
    }

    if (!isNaN(lat) && !isNaN(lng)) {
      let pais = '';
      if (tipo === 'EMBAJADA') {
        pais = pertenece;
      }
      ubicacionesValidas.push({
        direccion: ubicacion,
        tipo: tipo,
        pertenece: pertenece,
        pais: pais,
        lat: lat,
        lng: lng,
        horario: horario || '',
      });
    } else {
      console.log(`Fila ${idx + 1}: coordenadas no válidas (lat=${lat}, lng=${lng})`);
    }
  });

  console.log(`Total registros: ${totalUbicaciones}, Válidos con coordenadas: ${ubicacionesValidas.length}`);
  if (ubicacionesValidas.length > 0) {
    console.log('Primer registro válido:', ubicacionesValidas[0]);
  }

  return { totales: totalUbicaciones, validas: ubicacionesValidas };
}