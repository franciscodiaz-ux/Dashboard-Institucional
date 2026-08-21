/**
 * CFT Laplace — Dashboard Institucional
 * Oferta.gs
 *
 * Parser y validaciones específicas del dataset de Oferta Académica.
 *
 * La fuente SIES recibida ya viene filtrada para CFT Laplace.
 * Se conservan todas las columnas del archivo recibido.
 */

var OFERTA_CAMPOS_OBLIGATORIOS = [
  'Año',
  'Código Único',
  'Nombre Sede',
  'Nombre Carrera',
  'Área del conocimiento',
  'Jornada',
  'Vacantes Semestre Uno',
  'Vacantes Semestre Dos',
  'Vigencia'
];

function procesarOferta_(contenidoCSV) {
  if (
    contenidoCSV === null ||
    contenidoCSV === undefined ||
    String(contenidoCSV).trim() === ''
  ) {
    throw new Error('El archivo de Oferta Académica está vacío.');
  }

  var filas;

  try {
    filas = Utilities.parseCsv(String(contenidoCSV), ';');
  } catch (error) {
    throw new Error(
      'No fue posible interpretar el archivo de Oferta Académica como CSV separado por punto y coma. ' +
      error.message
    );
  }

  if (!filas || filas.length < 2) {
    throw new Error('El archivo de Oferta Académica no contiene registros de datos.');
  }

  filas = filas.filter(function(fila, indice) {
    if (indice === 0) return true;

    return fila.some(function(valor) {
      return String(valor || '').trim() !== '';
    });
  });

  if (filas.length < 2) {
    throw new Error('El archivo de Oferta Académica no contiene registros válidos.');
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

  validarEncabezadosOferta_(encabezados);

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
    tipo: 'oferta',
    csv: construirCSV_(encabezados, datos, ';'),
    encabezados: encabezados,
    registros: registros,
    cantidadRegistros: registros.length,
    filtros: {
      anos: valoresUnicos_(registros, 'Año'),
      sedes: valoresUnicos_(registros, 'Nombre Sede'),
      areas: valoresUnicos_(registros, 'Área del conocimiento'),
      carreras: valoresUnicos_(registros, 'Nombre Carrera'),
      jornadas: valoresUnicos_(registros, 'Jornada'),
      vigencias: valoresUnicos_(registros, 'Vigencia')
    }
  };
}

function validarEncabezadosOferta_(encabezados) {
  var normalizados = encabezados.map(normalizarEncabezado_);

  var faltantes = OFERTA_CAMPOS_OBLIGATORIOS.filter(function(campo) {
    return normalizados.indexOf(normalizarEncabezado_(campo)) === -1;
  });

  if (faltantes.length > 0) {
    throw new Error(
      'El archivo no corresponde a la estructura esperada de Oferta Académica. ' +
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


