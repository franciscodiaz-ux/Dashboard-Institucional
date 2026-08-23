/**
 * CFT Laplace — Dashboard Institucional
 * PlanMejora.gs
 *
 * Lectura y seguimiento del Plan de Mejora Institucional 2026–2027.
 * El contenido aprobado del plan se mantiene inmutable desde el dashboard.
 * Solo se actualizan los campos de seguimiento.
 */

var PLAN_MEJORA_ARCHIVO = 'plan_mejora.csv';

var PLAN_MEJORA_ESTADOS = [
  'No iniciada',
  'Iniciada',
  'En proceso',
  'Demorada',
  'Terminada',
  'No realizada'
];

function obtenerPlanMejora() {
  var contenido = leerPlanMejoraCsv_();
  var resultado = procesarPlanMejora_(contenido);

  return {
    ok: true,
    archivoOficial: PLAN_MEJORA_ARCHIVO,
    cantidadRegistros: resultado.registros.length,
    registros: resultado.registros,
    filtros: resultado.filtros,
    estadosPermitidos: PLAN_MEJORA_ESTADOS.slice()
  };
}

function obtenerPlanMejoraCsv() {
  var contenido = leerPlanMejoraCsv_();

  return {
    disponible: String(contenido || '').trim() !== '',
    archivo: PLAN_MEJORA_ARCHIVO,
    contenido: contenido || ''
  };
}

function actualizarSeguimientoPlanMejora(idActividad, cambios) {
  var id = String(idActividad || '').trim();
  if (!id) {
    throw new Error('No se recibió el ID de la actividad.');
  }

  cambios = cambios || {};

  var contenido = leerPlanMejoraCsv_();
  var filas = Utilities.parseCsv(String(contenido), ';');

  if (!filas.length) {
    throw new Error('plan_mejora.csv está vacío.');
  }

  var encabezados = filas[0].map(function(valor) {
    return String(valor || '').replace(/^\uFEFF/, '').trim();
  });

  var mapa = {};
  encabezados.forEach(function(encabezado, indice) {
    mapa[normalizarPlanEncabezado_(encabezado)] = indice;
  });

  var camposSeguimiento = [
    'ESTADO',
    'AVANCE',
    'FECHA_ACTUALIZACION',
    'OBSERVACION',
    'URL_EVIDENCIA'
  ];

  // Si una columna de seguimiento faltara, se agrega sin alterar
  // las columnas originales del Plan de Mejora.
  camposSeguimiento.forEach(function(campo) {
    if (mapa[campo] === undefined) {
      mapa[campo] = encabezados.length;
      encabezados.push(campo);
      filas[0].push(campo);

      for (var i = 1; i < filas.length; i++) {
        filas[i].push('');
      }
    }
  });

  var indiceId = mapa.ID;
  if (indiceId === undefined) {
    throw new Error('plan_mejora.csv no contiene la columna ID.');
  }

  var filaEncontrada = -1;

  for (var f = 1; f < filas.length; f++) {
    if (String(filas[f][indiceId] || '').trim() === id) {
      filaEncontrada = f;
      break;
    }
  }

  if (filaEncontrada < 0) {
    throw new Error('No se encontró la actividad "' + id + '".');
  }

  var fila = filas[filaEncontrada];

  if (Object.prototype.hasOwnProperty.call(cambios, 'estado')) {
    var estado = String(cambios.estado || '').trim();

    if (estado && PLAN_MEJORA_ESTADOS.indexOf(estado) === -1) {
      throw new Error('Estado no válido: ' + estado);
    }

    fila[mapa.ESTADO] = estado;
  }

  if (Object.prototype.hasOwnProperty.call(cambios, 'avance')) {
    var avanceTexto = String(
      cambios.avance === null || cambios.avance === undefined
        ? ''
        : cambios.avance
    ).trim().replace(',', '.');

    if (avanceTexto === '') {
      fila[mapa.AVANCE] = '';
    } else {
      var avance = Number(avanceTexto);

      if (!isFinite(avance) || avance < 0 || avance > 100) {
        throw new Error('El avance debe estar entre 0 y 100.');
      }

      fila[mapa.AVANCE] = String(avance);
    }
  }

  if (Object.prototype.hasOwnProperty.call(cambios, 'observacion')) {
    fila[mapa.OBSERVACION] = String(cambios.observacion || '').trim();
  }

  if (Object.prototype.hasOwnProperty.call(cambios, 'urlEvidencia')) {
    fila[mapa.URL_EVIDENCIA] = String(cambios.urlEvidencia || '').trim();
  }

  var zona = Session.getScriptTimeZone() || 'America/Santiago';
  fila[mapa.FECHA_ACTUALIZACION] =
    Utilities.formatDate(new Date(), zona, 'yyyy-MM-dd HH:mm:ss');

  var csvActualizado = construirCSV_(
    encabezados,
    filas.slice(1),
    ';'
  );

  guardarDataset_(PLAN_MEJORA_ARCHIVO, csvActualizado);

  var resultado = procesarPlanMejora_(csvActualizado);
  var registroActualizado = null;

  resultado.registros.some(function(registro) {
    if (registro.ID === id) {
      registroActualizado = registro;
      return true;
    }
    return false;
  });

  return {
    ok: true,
    registro: registroActualizado
  };
}

function leerPlanMejoraCsv_() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFilesByName(PLAN_MEJORA_ARCHIVO);

  if (!files.hasNext()) {
    throw new Error(
      'No se encontró "' + PLAN_MEJORA_ARCHIVO + '" en la carpeta del proyecto.'
    );
  }

  return files.next().getBlob().getDataAsString('UTF-8');
}

function procesarPlanMejora_(contenidoCSV) {
  if (!contenidoCSV || String(contenidoCSV).trim() === '') {
    throw new Error('plan_mejora.csv está vacío.');
  }

  var filas = Utilities.parseCsv(String(contenidoCSV), ';')
    .filter(function(fila, indice) {
      if (indice === 0) return true;

      return fila.some(function(valor) {
        return String(valor || '').trim() !== '';
      });
    });

  if (filas.length < 2) {
    throw new Error('plan_mejora.csv no contiene actividades.');
  }

  var encabezados = filas[0].map(function(valor) {
    return normalizarPlanEncabezado_(valor);
  });

  var registros = filas.slice(1).map(function(fila) {
    var registro = {};

    encabezados.forEach(function(encabezado, indice) {
      registro[encabezado] =
        String(fila[indice] === undefined ? '' : fila[indice]).trim();
    });

    registro.ANIO =
      (String(registro.FECHA_INICIO || '').match(/(19|20)\d{2}/) || [''])[0];

    var costo = String(registro.RECURSOS || '')
      .replace(',', '.')
      .match(/CLP\s*([0-9]+(?:\.[0-9]+)?)\s*MM/i);

    registro.COSTO_MM = costo ? Number(costo[1]) : 0;

    registro.ESTADO = registro.ESTADO || '';
    registro.AVANCE = registro.AVANCE || '';
    registro.FECHA_ACTUALIZACION = registro.FECHA_ACTUALIZACION || '';
    registro.OBSERVACION = registro.OBSERVACION || '';
    registro.URL_EVIDENCIA = registro.URL_EVIDENCIA || '';

    return registro;
  });

  function unicos(campo) {
    var vistos = {};

    registros.forEach(function(registro) {
      var valor = String(registro[campo] || '').trim();
      if (valor) vistos[valor] = true;
    });

    return Object.keys(vistos).sort(function(a, b) {
      return a.localeCompare(b, 'es', { numeric: true });
    });
  }

  var responsables = {};

  registros.forEach(function(registro) {
    String(registro.RESPONSABLES || '')
      .split('/')
      .forEach(function(valor) {
        valor = valor.trim();
        if (valor) responsables[valor] = true;
      });
  });

  return {
    registros: registros,
    filtros: {
      dimensiones: unicos('DIMENSION'),
      criterios: unicos('CRITERIO'),
      propositos: unicos('PROPOSITO'),
      anos: unicos('ANIO'),
      responsables: Object.keys(responsables).sort(function(a, b) {
        return a.localeCompare(b, 'es');
      }),
      estados: unicos('ESTADO')
    }
  };
}

function normalizarPlanEncabezado_(valor) {
  return String(valor || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');
}
