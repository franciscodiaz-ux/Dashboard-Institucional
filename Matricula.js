/**
 * CFT Laplace — Dashboard Institucional
 * Matricula.gs
 *
 * Parser y validaciones específicas del dataset de Matrícula.
 *
 * El archivo recibido ya viene filtrado para CFT Laplace.
 * No se filtra por institución.
 */

var MATRICULA_CAMPOS_OBLIGATORIOS = [
  'AÑO',
  'TOTAL MATRÍCULA',
  'NOMBRE SEDE',
  'NOMBRE CARRERA',
  'JORNADA',
  'CÓDIGO CARRERA'
];

function procesarMatricula_(contenidoCSV) {
  if (
    contenidoCSV === null ||
    contenidoCSV === undefined ||
    String(contenidoCSV).trim() === ''
  ) {
    throw new Error('El archivo de matrícula está vacío.');
  }

  var filas;

  try {
    filas = Utilities.parseCsv(String(contenidoCSV), ';');
  } catch (error) {
    throw new Error(
      'No fue posible interpretar el archivo de matrícula como CSV separado por punto y coma. ' +
      error.message
    );
  }

  if (!filas || filas.length < 2) {
    throw new Error('El archivo de matrícula no contiene registros de datos.');
  }

  filas = filas.filter(function(fila, indice) {
    if (indice === 0) return true;

    return fila.some(function(valor) {
      return String(valor || '').trim() !== '';
    });
  });

  if (filas.length < 2) {
    throw new Error('El archivo de matrícula no contiene registros válidos.');
  }

  var encabezados = filas[0].map(function(encabezado, indice) {
    var limpio = String(encabezado || '')
      .replace(/^\uFEFF/, '')
      .trim();

    if (limpio === '') {
      throw new Error('La columna ' + (indice + 1) + ' no tiene encabezado.');
    }

    return limpio;
  });

  validarEncabezadosMatricula_(encabezados);

  var cantidadColumnas = encabezados.length;
  var datos = filas.slice(1);

  datos.forEach(function(fila, indice) {
    if (fila.length !== cantidadColumnas) {
      throw new Error(
        'La fila ' + (indice + 2) +
        ' tiene ' + fila.length +
        ' columnas; se esperaban ' + cantidadColumnas + '.'
      );
    }
  });

  var registros = filasAObjetos_(encabezados, datos);

  return {
    tipo: 'matricula',
    csv: construirCSV_(encabezados, datos, ';'),
    encabezados: encabezados,
    registros: registros,
    cantidadRegistros: registros.length,
    filtros: {
      anos: valoresUnicos_(registros, 'AÑO'),
      sedes: valoresUnicos_(registros, 'NOMBRE SEDE'),
      carreras: valoresUnicos_(registros, 'NOMBRE CARRERA'),
      jornadas: valoresUnicos_(registros, 'JORNADA')
    }
  };
}

function validarEncabezadosMatricula_(encabezados) {
  var normalizados = encabezados.map(normalizarEncabezado_);

  var faltantes = MATRICULA_CAMPOS_OBLIGATORIOS.filter(function(campo) {
    return normalizados.indexOf(normalizarEncabezado_(campo)) === -1;
  });

  if (faltantes.length > 0) {
    throw new Error(
      'El archivo no corresponde a la estructura esperada de Matrícula. ' +
      'Faltan estos campos: ' + faltantes.join(', ')
    );
  }

  var vistos = {};
  var duplicados = [];

  normalizados.forEach(function(encabezado) {
    if (vistos[encabezado]) duplicados.push(encabezado);
    vistos[encabezado] = true;
  });

  if (duplicados.length > 0) {
    throw new Error(
      'El archivo contiene encabezados duplicados: ' +
      duplicados.join(', ')
    );
  }
}

