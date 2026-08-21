/**
 * CFT Laplace — Dashboard Institucional
 * ComposicionMatricula.gs
 *
 * Dataset:
 * ANIO;SEDE;JORNADA;CARRERA;PRIMER_ANIO;SEGUNDO_ANIO;PROCESO_TITULACION
 *
 * Reglas:
 * - si composición no tiene datos, una actualización de Matrícula la inicializa
 *   automáticamente con los datos de primer año;
 * - si composición ya tiene datos, Matrícula NO la sobrescribe;
 * - los valores de primer año se comparan y las discrepancias se reportan;
 * - el CSV de control de discrepancias se implementará cuando se acuerde su formato.
 */

var COMPOSICION_CAMPOS = [
  'ANIO',
  'SEDE',
  'JORNADA',
  'CARRERA',
  'PRIMER_ANIO',
  'SEGUNDO_ANIO',
  'PROCESO_TITULACION'
];

function procesarComposicionMatricula_(contenidoCSV) {
  if (
    contenidoCSV === null ||
    contenidoCSV === undefined ||
    String(contenidoCSV).trim() === ''
  ) {
    return crearResultadoComposicionVacio_();
  }

  var filas;

  try {
    filas = Utilities.parseCsv(String(contenidoCSV), ';');
  } catch (error) {
    throw new Error(
      'No fue posible interpretar composicion_matricula.csv como CSV separado por punto y coma. ' +
      error.message
    );
  }

  if (!filas || filas.length === 0) {
    return crearResultadoComposicionVacio_();
  }

  filas = filas.filter(function(fila, indice) {
    if (indice === 0) return true;

    return fila.some(function(valor) {
      return String(valor || '').trim() !== '';
    });
  });

  var encabezados = filas[0].map(function(encabezado) {
    return String(encabezado || '')
      .replace(/^\uFEFF/, '')
      .trim();
  });

  validarEncabezadosComposicion_(encabezados);

  if (filas.length === 1) {
    return {
      tipo: 'composicion_matricula',
      csv: construirCSV_(COMPOSICION_CAMPOS, [], ';'),
      encabezados: COMPOSICION_CAMPOS.slice(),
      registros: [],
      cantidadRegistros: 0,
      filtros: {
        anos: [],
        sedes: [],
        jornadas: [],
        carreras: []
      },
      discrepanciasPrimerAno: []
    };
  }

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

  var registros = filasAObjetos_(encabezados, datos).map(function(registro) {
    return normalizarRegistroComposicion_(registro);
  });

  var filasNormalizadas = registros.map(function(registro) {
    return COMPOSICION_CAMPOS.map(function(campo) {
      return registro[campo];
    });
  });

  return {
    tipo: 'composicion_matricula',
    csv: construirCSV_(COMPOSICION_CAMPOS, filasNormalizadas, ';'),
    encabezados: COMPOSICION_CAMPOS.slice(),
    registros: registros,
    cantidadRegistros: registros.length,
    filtros: {
      anos: valoresUnicos_(registros, 'ANIO'),
      sedes: valoresUnicos_(registros, 'SEDE'),
      jornadas: valoresUnicos_(registros, 'JORNADA'),
      carreras: valoresUnicos_(registros, 'CARRERA')
    },
    discrepanciasPrimerAno: []
  };
}

function crearResultadoComposicionVacio_() {
  return {
    tipo: 'composicion_matricula',
    csv: construirCSV_(COMPOSICION_CAMPOS, [], ';'),
    encabezados: COMPOSICION_CAMPOS.slice(),
    registros: [],
    cantidadRegistros: 0,
    filtros: {
      anos: [],
      sedes: [],
      jornadas: [],
      carreras: []
    },
    discrepanciasPrimerAno: []
  };
}

function validarEncabezadosComposicion_(encabezados) {
  var normalizados = encabezados.map(normalizarEncabezado_);

  var faltantes = COMPOSICION_CAMPOS.filter(function(campo) {
    return normalizados.indexOf(normalizarEncabezado_(campo)) === -1;
  });

  if (faltantes.length > 0) {
    throw new Error(
      'El archivo no corresponde a la estructura esperada de Composición Matrícula. ' +
      'Faltan estos campos: ' + faltantes.join(', ')
    );
  }
}

function normalizarRegistroComposicion_(registro) {
  return {
    ANIO: extraerAno_(registro.ANIO),
    SEDE: normalizarSedeComposicion_(registro.SEDE),
    JORNADA: normalizarJornadaComposicion_(registro.JORNADA),
    CARRERA: String(registro.CARRERA || '').trim(),
    PRIMER_ANIO: normalizarNumeroComposicion_(registro.PRIMER_ANIO),
    SEGUNDO_ANIO: normalizarNumeroComposicion_(registro.SEGUNDO_ANIO),
    PROCESO_TITULACION: normalizarNumeroComposicion_(registro.PROCESO_TITULACION)
  };
}

function normalizarNumeroComposicion_(valor) {
  var texto = String(
    valor === null || valor === undefined ? '' : valor
  ).trim();

  if (texto === '') {
    return '';
  }

  var numero = Number(texto.replace(/[^\d-]/g, ''));

  if (!isFinite(numero)) {
    throw new Error('Se encontró un valor numérico inválido en Composición Matrícula: ' + valor);
  }

  return String(numero);
}

function extraerAno_(valor) {
  var texto = String(valor || '').trim();
  var coincidencia = texto.match(/(19|20)\d{2}/);

  return coincidencia ? coincidencia[0] : texto;
}

function normalizarSedeComposicion_(valor) {
  return String(valor || '')
    .trim()
    .replace(/^SEDE\s+/i, '')
    .toUpperCase();
}

function normalizarJornadaComposicion_(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase();
}

/**
 * Extrae desde Matrícula la composición de Primer Año.
 */
function construirPrimerAnoDesdeMatricula_(registrosMatricula) {
  var mapa = {};

  (registrosMatricula || []).forEach(function(registro) {
    var ano = extraerAno_(registro['AÑO']);
    var sede = normalizarSedeComposicion_(registro['NOMBRE SEDE']);
    var jornada = normalizarJornadaComposicion_(registro['JORNADA']);
    var carrera = String(registro['NOMBRE CARRERA'] || '').trim();

    if (!ano || !sede || !carrera) {
      return;
    }

    var clave = [
      ano,
      normalizarTextoClave_(sede),
      normalizarTextoClave_(jornada),
      normalizarCarreraClave_(carrera)
    ].join('|');

    if (!mapa[clave]) {
      mapa[clave] = {
        ANIO: ano,
        SEDE: sede,
        JORNADA: jornada,
        CARRERA: carrera,
        PRIMER_ANIO: 0,
        SEGUNDO_ANIO: '',
        PROCESO_TITULACION: ''
      };
    }

    mapa[clave].PRIMER_ANIO += numeroSeguro_(
      registro['TOTAL MATRÍCULA PRIMER AÑO']
    );
  });

  return Object.keys(mapa)
    .map(function(clave) {
      var registro = mapa[clave];
      registro.PRIMER_ANIO = String(registro.PRIMER_ANIO);
      return registro;
    })
    .sort(function(a, b) {
      return String(a.ANIO).localeCompare(String(b.ANIO), 'es', {numeric:true}) ||
             String(a.SEDE).localeCompare(String(b.SEDE), 'es') ||
             String(a.JORNADA).localeCompare(String(b.JORNADA), 'es') ||
             String(a.CARRERA).localeCompare(String(b.CARRERA), 'es');
    });
}

/**
 * Si composición está vacía, la inicializa con Primer Año desde Matrícula.
 * Si ya tiene datos, solo compara y conserva composición sin cambios.
 */
function sincronizarComposicionDesdeMatricula_(registrosMatricula) {
  var config = obtenerConfiguracionDataset_('composicion_matricula');
  var contenidoActual = leerDatasetSiExiste_(config.archivo);

  if (!csvTieneDatos_(contenidoActual)) {
    var nuevos = construirPrimerAnoDesdeMatricula_(registrosMatricula);

    var filas = nuevos.map(function(registro) {
      return COMPOSICION_CAMPOS.map(function(campo) {
        return registro[campo];
      });
    });

    var csv = construirCSV_(COMPOSICION_CAMPOS, filas, ';');
    guardarDataset_(config.archivo, csv);

    return {
      accion: 'inicializado',
      cantidadRegistros: nuevos.length,
      discrepancias: []
    };
  }

  var composicion = procesarComposicionMatricula_(contenidoActual);
  var discrepancias = compararPrimerAnoComposicion_(
    composicion.registros,
    registrosMatricula
  );

  return {
    accion: 'comparado',
    cantidadRegistros: composicion.cantidadRegistros,
    discrepancias: discrepancias
  };
}

/**
 * Compara Primer Año. Si la fila de composición no trae jornada, la comparación
 * se realiza agregando todas las jornadas de Matrícula para año+sede+carrera.
 */
function compararPrimerAnoComposicion_(registrosComposicion, registrosMatricula) {
  var discrepancias = [];

  (registrosComposicion || []).forEach(function(comp) {
    var valorCompTexto = String(comp.PRIMER_ANIO || '').trim();

    if (valorCompTexto === '') {
      return;
    }

    var valorComp = numeroSeguro_(valorCompTexto);
    var valorMatricula = 0;

    (registrosMatricula || []).forEach(function(mat) {
      if (extraerAno_(mat['AÑO']) !== extraerAno_(comp.ANIO)) {
        return;
      }

      if (
        normalizarTextoClave_(normalizarSedeComposicion_(mat['NOMBRE SEDE'])) !==
        normalizarTextoClave_(normalizarSedeComposicion_(comp.SEDE))
      ) {
        return;
      }

      if (
        normalizarCarreraClave_(mat['NOMBRE CARRERA']) !==
        normalizarCarreraClave_(comp.CARRERA)
      ) {
        return;
      }

      var jornadaComp = normalizarJornadaComposicion_(comp.JORNADA);

      if (
        jornadaComp !== '' &&
        normalizarTextoClave_(normalizarJornadaComposicion_(mat['JORNADA'])) !==
        normalizarTextoClave_(jornadaComp)
      ) {
        return;
      }

      valorMatricula += numeroSeguro_(mat['TOTAL MATRÍCULA PRIMER AÑO']);
    });

    if (valorComp !== valorMatricula) {
      discrepancias.push({
        anio: comp.ANIO,
        sede: comp.SEDE,
        jornada: comp.JORNADA,
        carrera: comp.CARRERA,
        primerAnoComposicion: valorComp,
        primerAnoMatricula: valorMatricula,
        diferencia: valorComp - valorMatricula
      });
    }
  });

  return discrepancias;
}

function compararComposicionActualConMatricula_(registrosComposicion) {
  var contenidoMatricula = leerDatasetSiExiste_('matricula.csv');

  if (!csvTieneDatos_(contenidoMatricula)) {
    return [];
  }

  var resultadoMatricula = procesarMatricula_(contenidoMatricula);

  return compararPrimerAnoComposicion_(
    registrosComposicion,
    resultadoMatricula.registros
  );
}

function normalizarTextoClave_(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarCarreraClave_(valor) {
  var texto = normalizarTextoClave_(valor);

  texto = texto.replace(/^TNS\s+/, 'TECNICO DE NIVEL SUPERIOR ');
  texto = texto.replace(/^TECNICO NIVEL SUPERIOR\s+/, 'TECNICO DE NIVEL SUPERIOR ');

  return texto;
}

function numeroSeguro_(valor) {
  var texto = String(
    valor === null || valor === undefined ? '' : valor
  ).trim();

  if (texto === '') {
    return 0;
  }

  var numero = Number(texto.replace(/[^\d-]/g, ''));

  return isFinite(numero) ? numero : 0;
}


