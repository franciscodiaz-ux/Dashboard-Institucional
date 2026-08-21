/**
 * CFT Laplace — Dashboard Institucional
 * Dotacion.gs
 *
 * Procesa el archivo bruto de Personal Académico de SIES.
 * La fuente posee tres filas de encabezados; se normaliza a un CSV plano
 * de 61 columnas y se conservan todos los campos disponibles.
 */

var DOTACION_CAMPOS = [
  'ANIO',
  'CODIGO_INSTITUCION',
  'NOMBRE_INSTITUCION',
  'TIPO_INSTITUCION_I',
  'TIPO_INSTITUCION_II',
  'TIPO_INSTITUCION_III',
  'JCE_MUJERES',
  'JCE_HOMBRES',
  'JCE_NO_BINARIO_INDEFINIDO',
  'JCE_TOTAL',
  'EDAD_PROMEDIO_MUJER',
  'EDAD_PROMEDIO_HOMBRE',
  'EDAD_PROMEDIO_TOTAL',
  'JCE_MUJER_MENOS_35',
  'JCE_MUJER_35_44',
  'JCE_MUJER_45_54',
  'JCE_MUJER_55_64',
  'JCE_MUJER_65_MAS',
  'JCE_MUJER_SIN_INFO',
  'JCE_HOMBRE_MENOS_35',
  'JCE_HOMBRE_35_44',
  'JCE_HOMBRE_45_54',
  'JCE_HOMBRE_55_64',
  'JCE_HOMBRE_65_MAS',
  'JCE_HOMBRE_SIN_INFO',
  'JCE_TRABAJA_1_INSTITUCION',
  'JCE_TRABAJA_2_INSTITUCIONES',
  'JCE_TRABAJA_3_MAS_INSTITUCIONES',
  'JCE_DOCTOR',
  'JCE_MAGISTER',
  'JCE_ESPECIALIDAD_MEDICA_ODONTOLOGICA',
  'JCE_TITULO_PROFESIONAL',
  'JCE_LICENCIATURA',
  'JCE_TNS',
  'JCE_TNM',
  'JCE_LICENCIA_MEDIA',
  'JCE_SIN_TITULO_GRADO',
  'JCE_FORMACION_SIN_INFO',
  'ACADEMICOS_ARICA_PARINACOTA',
  'ACADEMICOS_TARAPACA',
  'ACADEMICOS_ANTOFAGASTA',
  'ACADEMICOS_ATACAMA',
  'ACADEMICOS_COQUIMBO',
  'ACADEMICOS_VALPARAISO',
  'ACADEMICOS_METROPOLITANA',
  'ACADEMICOS_OHIGGINS',
  'ACADEMICOS_MAULE',
  'ACADEMICOS_NUBLE',
  'ACADEMICOS_BIOBIO',
  'ACADEMICOS_ARAUCANIA',
  'ACADEMICOS_RIOS',
  'ACADEMICOS_LAGOS',
  'ACADEMICOS_AYSEN',
  'ACADEMICOS_MAGALLANES',
  'ACADEMICOS_REGION_SIN_INFO',
  'JCE_CHILENO',
  'JCE_EXTRANJERO',
  'JCE_HORAS_MENOS_11',
  'JCE_HORAS_11_22',
  'JCE_HORAS_23_38',
  'JCE_HORAS_39_MAS'
];

function procesarDotacion_(contenidoCSV) {
  if (
    contenidoCSV === null ||
    contenidoCSV === undefined ||
    String(contenidoCSV).trim() === ''
  ) {
    throw new Error('El archivo de Dotación Docente está vacío.');
  }

  var filas;

  try {
    filas = Utilities.parseCsv(String(contenidoCSV), ';');
  } catch (error) {
    throw new Error(
      'No fue posible interpretar el archivo de Dotación Docente como CSV separado por punto y coma. ' +
      error.message
    );
  }

  filas = filas.filter(function(fila) {
    return fila.some(function(valor) {
      return String(valor || '').trim() !== '';
    });
  });

  if (!filas || filas.length < 2) {
    throw new Error('El archivo de Dotación Docente no contiene registros de datos.');
  }

  var datos;

  // Fuente bruta SIES: 3 filas de encabezado.
  if (
    normalizarEncabezado_(filas[0][0]) === 'PERIODO' &&
    filas.length >= 4 &&
    normalizarEncabezado_(filas[2][6]) === 'TOTAL_MUJERES'
  ) {
    datos = filas.slice(3);
  }
  // Archivo oficial ya normalizado.
  else if (normalizarEncabezado_(filas[0][0]) === 'ANIO') {
    validarEncabezadosDotacion_(filas[0]);
    datos = filas.slice(1);
  }
  else {
    throw new Error(
      'El archivo no corresponde al formato esperado de Personal Académico SIES ni al dotacion.csv normalizado.'
    );
  }

  datos = datos.filter(function(fila) {
    return String(fila[0] || '').trim() !== '';
  });

  if (datos.length === 0) {
    throw new Error('El archivo de Dotación Docente no contiene períodos válidos.');
  }

  var registros = datos.map(function(fila, indice) {
    if (fila.length !== DOTACION_CAMPOS.length) {
      throw new Error(
        'La fila de datos ' + (indice + 1) +
        ' tiene ' + fila.length +
        ' columnas; se esperaban ' + DOTACION_CAMPOS.length + '.'
      );
    }

    var registro = {};

    DOTACION_CAMPOS.forEach(function(campo, i) {
      var valor = String(fila[i] === null || fila[i] === undefined ? '' : fila[i]).trim();

      if (campo === 'ANIO') {
        valor = extraerAno_(valor);
      }
      else if (i >= 6) {
        valor = normalizarDecimalDotacion_(valor);
      }

      registro[campo] = valor;
    });

    return registro;
  });

  var filasNormalizadas = registros.map(function(registro) {
    return DOTACION_CAMPOS.map(function(campo) {
      return registro[campo];
    });
  });

  return {
    tipo: 'dotacion',
    csv: construirCSV_(DOTACION_CAMPOS, filasNormalizadas, ';'),
    encabezados: DOTACION_CAMPOS.slice(),
    registros: registros,
    cantidadRegistros: registros.length,
    filtros: {
      anos: valoresUnicos_(registros, 'ANIO')
    }
  };
}

function validarEncabezadosDotacion_(encabezados) {
  var normalizados = encabezados.map(normalizarEncabezado_);

  var faltantes = DOTACION_CAMPOS.filter(function(campo) {
    return normalizados.indexOf(normalizarEncabezado_(campo)) === -1;
  });

  if (faltantes.length > 0) {
    throw new Error(
      'dotacion.csv no posee la estructura esperada. Faltan: ' +
      faltantes.join(', ')
    );
  }
}

function normalizarDecimalDotacion_(valor) {
  var texto = String(valor || '').trim();

  if (texto === '') {
    return '';
  }

  texto = texto.replace(/\./g, '').replace(',', '.');

  var numero = Number(texto);

  if (!isFinite(numero)) {
    return String(valor || '').trim();
  }

  return String(numero);
}
