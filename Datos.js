/**
 * CFT Laplace — Dashboard Institucional
 * Datos.gs
 *
 * Servicios comunes de configuración, lectura y escritura.
 */

var DATASETS = {
  matricula: { archivo: 'matricula.csv' },
  oferta: { archivo: 'oferta.csv' },
  retencion: { archivo: 'retencion.csv' },
  egreso: { archivo: 'egreso.csv' },
  dotacion: { archivo: 'dotacion.csv' },
  jce: { archivo: 'jce.csv' },
  titulados: { archivo: 'titulados.csv' },
  composicion_matricula: { archivo: 'composicion_matricula.csv' }
};

function obtenerConfiguracionDataset_(tipo) {
  var clave = String(tipo || '').trim().toLowerCase();
  var config = DATASETS[clave];

  if (!config) {
    throw new Error('Tipo de dataset no válido: ' + tipo);
  }

  return config;
}

function obtenerArchivoDataset_(nombreArchivo) {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFilesByName(nombreArchivo);

  if (!files.hasNext()) {
    throw new Error(
      'No se encontró el archivo oficial "' +
      nombreArchivo +
      '" en la carpeta del proyecto.'
    );
  }

  return files.next();
}

function leerDataset_(nombreArchivo) {
  return obtenerArchivoDataset_(nombreArchivo)
    .getBlob()
    .getDataAsString('UTF-8');
}

function guardarDataset_(nombreArchivo, contenidoCSV) {
  if (contenidoCSV === null || contenidoCSV === undefined) {
    throw new Error('No se recibió contenido para guardar.');
  }

  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFilesByName(nombreArchivo);
  var contenido = String(contenidoCSV);

  if (files.hasNext()) {
    files.next().setContent(contenido);
    return;
  }

  // Si el dataset oficial todavía no existe (por ejemplo, Titulados
  // en su primera carga), se crea directamente con su nombre oficial.
  folder.createFile(nombreArchivo, contenido, MimeType.CSV);
}

function normalizarEncabezado_(encabezado) {
  return String(encabezado || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function construirCSV_(encabezados, filas, separador) {
  separador = separador || ';';

  return [encabezados].concat(filas).map(function(fila) {
    return fila.map(function(valor) {
      var texto = String(
        valor === null || valor === undefined ? '' : valor
      ).replace(/"/g, '""');

      if (
        texto.indexOf(separador) !== -1 ||
        texto.indexOf('"') !== -1 ||
        texto.indexOf('\n') !== -1 ||
        texto.indexOf('\r') !== -1
      ) {
        texto = '"' + texto + '"';
      }

      return texto;
    }).join(separador);
  }).join('\r\n');
}

function filasAObjetos_(encabezados, filas) {
  return filas.map(function(fila) {
    var obj = {};

    encabezados.forEach(function(encabezado, indice) {
      obj[encabezado] = fila[indice];
    });

    return obj;
  });
}

function valoresUnicos_(registros, campo) {
  var vistos = {};
  var resultado = [];

  registros.forEach(function(registro) {
    var valor = String(registro[campo] || '').trim();

    if (valor !== '' && !vistos[valor]) {
      vistos[valor] = true;
      resultado.push(valor);
    }
  });

  return resultado.sort(function(a, b) {
    return a.localeCompare(b, 'es', { numeric: true });
  });
}


/**
 * Lee un archivo si existe. Si no existe, devuelve null.
 */
function leerDatasetSiExiste_(nombreArchivo) {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFilesByName(nombreArchivo);

  if (!files.hasNext()) {
    return null;
  }

  return files.next()
    .getBlob()
    .getDataAsString('UTF-8');
}

/**
 * Indica si un CSV contiene al menos una fila de datos además del encabezado.
 */
function csvTieneDatos_(contenidoCSV) {
  if (contenidoCSV === null || contenidoCSV === undefined) {
    return false;
  }

  var lineas = String(contenidoCSV)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(function(linea) {
      return String(linea).trim() !== '';
    });

  return lineas.length > 1;
}

/**
 * Devuelve el estado de disponibilidad de los datasets implementados.
 * "true" significa que existe un archivo y contiene al menos una fila de datos.
 */
function obtenerEstadoDatasets() {
  var tipos = [
    'matricula',
    'oferta',
    'titulados',
    'composicion_matricula',
    'dotacion'
  ];

  var estado = {};

  tipos.forEach(function(tipo) {
    var config = obtenerConfiguracionDataset_(tipo);
    var contenido = leerDatasetSiExiste_(config.archivo);
    estado[tipo] = csvTieneDatos_(contenido);
  });

  // Indicadores derivados, sin dataset independiente.
  estado.retencion = hayRetencionCalculable_();
  estado.tasa_titulacion = hayTasaTitulacionCalculable_();

  return estado;
}

/**
 * Devuelve el CSV oficial para descarga.
 * Si no existe o no contiene datos, devuelve disponible=false.
 *
 * Más adelante este mismo punto podrá devolver plantillas vacías.
 */
function obtenerCsvDescarga(tipo) {
  var clave = String(tipo || '').trim().toLowerCase();

  if (clave === 'retencion') {
    var csvRetencion = generarCsvRetencionPrimerAno_();

    return {
      disponible: String(csvRetencion || '').trim() !== '',
      archivo: 'retencion.csv',
      contenido: csvRetencion || ''
    };
  }

  if (clave === 'tasa_titulacion') {
    var csvTasa = generarCsvTasaTitulacion_();

    return {
      disponible: String(csvTasa || '').trim() !== '',
      archivo: 'tasa_titulacion.csv',
      contenido: csvTasa || ''
    };
  }

  var config = obtenerConfiguracionDataset_(clave);
  var contenido = leerDatasetSiExiste_(config.archivo);

  if (!csvTieneDatos_(contenido)) {
    return {
      disponible: false,
      archivo: config.archivo,
      contenido: ''
    };
  }

  return {
    disponible: true,
    archivo: config.archivo,
    contenido: contenido
  };
}
