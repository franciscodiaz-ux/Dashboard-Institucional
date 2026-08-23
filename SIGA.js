/**
 * CFT Laplace — Dashboard Institucional
 * SIGA.gs
 *
 * Datasets anuales normalizados para el seguimiento SIGA.
 * - siga_oferta_YYYY.csv: una fila por ramo ofrecido en cada curso.
 * - siga_resultados_YYYY.csv: una fila por resultado estudiante-asignatura,
 *   sin datos personales en el dataset publicado por el dashboard.
 */

var SIGA_OFERTA_CAMPOS = [
  'ANIO','PERIODO','ID_CURSO','SEDE','CARRERA','SEMESTRE','NIVEL','JORNADA','ASIGNATURA'
];

var SIGA_RESULTADOS_CAMPOS = [
  'ANIO','PERIODO','ID_CURSO','SEDE','CARRERA','SEMESTRE','JORNADA',
  'ASIGNATURA','PROMEDIO_FINAL','SITUACION','TIPO_EVALUACION','ESTADO_ENVIO'
];

function sigaNombreArchivo_(tipo, ano) {
  var clave = String(tipo || '').trim().toLowerCase();
  var anio = String(ano || '').trim();

  if (!/^20\d{2}$/.test(anio)) {
    throw new Error('Debe indicar un año válido para SIGA.');
  }

  if (clave !== 'siga_oferta' && clave !== 'siga_resultados') {
    throw new Error('Tipo de dataset SIGA no válido: ' + tipo);
  }

  return clave + '_' + anio + '.csv';
}

function procesarSigaOferta_(contenidoCSV) {
  return procesarSigaCsv_(contenidoCSV, SIGA_OFERTA_CAMPOS, 'siga_oferta');
}

function procesarSigaResultados_(contenidoCSV) {
  var resultado = procesarSigaCsv_(contenidoCSV, SIGA_RESULTADOS_CAMPOS, 'siga_resultados');

  resultado.registros = resultado.registros.map(function(r) {
    var nota = sigaNumero_(r.PROMEDIO_FINAL);
    var situacionFuente = String(r.SITUACION || '').trim().toUpperCase();
    var situacion;

    if (situacionFuente === 'PENDIENTE' || nota === null) {
      situacion = 'PENDIENTE';
    } else {
      situacion = nota >= 4 ? 'APROBADO' : 'REPROBADO';
    }

    r.SITUACION = situacion;
    r.PROMEDIO_FINAL = nota === null ? '' : String(nota);
    return r;
  });

  resultado.csv = construirCSV_(
    SIGA_RESULTADOS_CAMPOS,
    resultado.registros.map(function(r) {
      return SIGA_RESULTADOS_CAMPOS.map(function(campo) { return r[campo]; });
    }),
    ';'
  );

  return resultado;
}

function procesarSigaCsv_(contenidoCSV, campos, tipo) {
  if (contenidoCSV === null || contenidoCSV === undefined || String(contenidoCSV).trim() === '') {
    throw new Error('El archivo SIGA está vacío.');
  }

  var filas;
  try {
    filas = Utilities.parseCsv(String(contenidoCSV).replace(/^\uFEFF/, ''), ';');
  } catch (error) {
    throw new Error('No fue posible interpretar el archivo como CSV separado por punto y coma. ' + error.message);
  }

  filas = filas.filter(function(fila, indice) {
    if (indice === 0) return true;
    return fila.some(function(valor) { return String(valor || '').trim() !== ''; });
  });

  if (filas.length < 2) {
    throw new Error('El CSV SIGA no contiene registros de datos.');
  }

  var encabezadosOriginales = filas[0].map(function(h) { return String(h || '').trim(); });
  var encabezadosNorm = encabezadosOriginales.map(normalizarEncabezado_);
  var faltantes = campos.filter(function(campo) {
    return encabezadosNorm.indexOf(normalizarEncabezado_(campo)) === -1;
  });

  if (faltantes.length) {
    throw new Error('El CSV SIGA no tiene la estructura esperada. Faltan: ' + faltantes.join(', '));
  }

  var indices = {};
  campos.forEach(function(campo) {
    indices[campo] = encabezadosNorm.indexOf(normalizarEncabezado_(campo));
  });

  var registros = filas.slice(1).map(function(fila, indice) {
    var registro = {};
    campos.forEach(function(campo) {
      registro[campo] = String(fila[indices[campo]] === undefined ? '' : fila[indices[campo]]).trim();
    });

    if (!/^20\d{2}$/.test(registro.ANIO)) {
      throw new Error('Fila ' + (indice + 2) + ': ANIO no válido.');
    }
    if (!registro.PERIODO || !registro.ID_CURSO || !registro.SEDE || !registro.CARRERA || !registro.ASIGNATURA) {
      throw new Error('Fila ' + (indice + 2) + ': faltan campos obligatorios de identificación.');
    }

    registro.SEMESTRE = String(parseInt(registro.SEMESTRE, 10) || '');
    return registro;
  });

  var filasCanonicas = registros.map(function(r) {
    return campos.map(function(campo) { return r[campo]; });
  });

  return {
    tipo: tipo,
    csv: construirCSV_(campos, filasCanonicas, ';'),
    encabezados: campos.slice(),
    registros: registros,
    cantidadRegistros: registros.length,
    filtros: {
      anos: valoresUnicos_(registros, 'ANIO'),
      sedes: valoresUnicos_(registros, 'SEDE'),
      carreras: valoresUnicos_(registros, 'CARRERA'),
      jornadas: valoresUnicos_(registros, 'JORNADA'),
      semestres: valoresUnicos_(registros, 'SEMESTRE'),
      cursos: valoresUnicos_(registros, 'ID_CURSO')
    }
  };
}

function sigaNumero_(valor) {
  var texto = String(valor === null || valor === undefined ? '' : valor).trim().replace(',', '.');
  if (texto === '') return null;
  var numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function actualizarDatasetSiga(tipo, ano, contenidoCSV, nombreOriginal) {
  var clave = String(tipo || '').trim().toLowerCase();
  var anio = String(ano || '').trim();
  var resultado = clave === 'siga_oferta'
    ? procesarSigaOferta_(contenidoCSV)
    : clave === 'siga_resultados'
      ? procesarSigaResultados_(contenidoCSV)
      : null;

  if (!resultado) throw new Error('Dataset SIGA no válido: ' + tipo);

  var anosArchivo = valoresUnicos_(resultado.registros, 'ANIO');
  if (anosArchivo.length !== 1 || anosArchivo[0] !== anio) {
    throw new Error(
      'El archivo corresponde al año ' + (anosArchivo.join(', ') || 'desconocido') +
      ', pero se intentó cargar como ' + anio + '.'
    );
  }

  var archivo = sigaNombreArchivo_(clave, anio);
  guardarDataset_(archivo, resultado.csv);

  return {
    ok: true,
    tipo: clave,
    ano: anio,
    nombreOriginal: nombreOriginal || '',
    archivoOficial: archivo,
    cantidadRegistros: resultado.cantidadRegistros,
    cantidadColumnas: resultado.encabezados.length,
    encabezados: resultado.encabezados,
    filtros: resultado.filtros
  };
}

function obtenerDatasetSiga(tipo, ano) {
  var clave = String(tipo || '').trim().toLowerCase();
  var archivo = sigaNombreArchivo_(clave, ano);
  var contenido = leerDataset_(archivo);
  var resultado = clave === 'siga_oferta'
    ? procesarSigaOferta_(contenido)
    : procesarSigaResultados_(contenido);

  return {
    ok: true,
    tipo: clave,
    ano: String(ano),
    archivoOficial: archivo,
    cantidadRegistros: resultado.cantidadRegistros,
    cantidadColumnas: resultado.encabezados.length,
    encabezados: resultado.encabezados,
    filtros: resultado.filtros,
    registros: resultado.registros
  };
}

function obtenerAniosSiga() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFiles();
  var estado = {};

  while (files.hasNext()) {
    var nombre = files.next().getName();
    var match = nombre.match(/^siga_(oferta|resultados)_(20\d{2})\.csv$/i);
    if (!match) continue;

    var anio = match[2];
    estado[anio] = estado[anio] || { ano: anio, oferta: false, resultados: false };
    estado[anio][match[1].toLowerCase()] = true;
  }

  return Object.keys(estado)
    .sort(function(a,b) { return Number(b) - Number(a); })
    .map(function(anio) { return estado[anio]; });
}

function obtenerCsvSigaDescarga(tipo, ano) {
  var archivo = sigaNombreArchivo_(tipo, ano);
  var contenido = leerDatasetSiExiste_(archivo);
  return {
    disponible: csvTieneDatos_(contenido),
    archivo: archivo,
    contenido: contenido || ''
  };
}
