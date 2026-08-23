/**
 * CFT Laplace — Dashboard Institucional
 * SIGA.gs
 *
 * Gestión de archivos SIGA por año calendario y semestre calendario.
 * Los originales XLSX y los CSV normalizados quedan en la subcarpeta SIGA.
 */

var SIGA_FOLDER_ID = '1EnK0b8gb8DVkNdvlYIWkCnVcwyCNRHYf';

var SIGA_OFERTA_CAMPOS = [
  'ANIO','SEMESTRE_CALENDARIO','PERIODO','ID_CURSO','SEDE','CARRERA',
  'SEMESTRE_PLAN','NIVEL','JORNADA','ASIGNATURA'
];

var SIGA_RESULTADOS_CAMPOS = [
  'ANIO','SEMESTRE_CALENDARIO','PERIODO','ID_CURSO','SEDE','CARRERA',
  'SEMESTRE_PLAN','JORNADA','ASIGNATURA','PROMEDIO_FINAL','SITUACION',
  'TIPO_EVALUACION','ESTADO_ENVIO'
];

var SIGA_INSCRITOS_CAMPOS = [
  'ANIO','SEMESTRE_CALENDARIO','PERIODO','ALUMNO_ID','ID_CURSO','SEDE','CARRERA',
  'SEMESTRE_PLAN','NIVEL','JORNADA','ESTADO'
];

function sigaValidarPeriodo_(ano, semestreCalendario) {
  var anio = String(ano || '').trim();
  var sem = String(semestreCalendario || '').trim();

  if (!/^20\d{2}$/.test(anio)) {
    throw new Error('Debe indicar un año calendario válido para SIGA.');
  }
  if (sem !== '1' && sem !== '2') {
    throw new Error('Debe indicar semestre calendario 1 o 2.');
  }

  return { ano: anio, semestre: sem, periodo: anio + '-' + sem };
}

function sigaNombreArchivo_(tipo, ano, semestreCalendario) {
  var periodo = sigaValidarPeriodo_(ano, semestreCalendario);
  var clave = String(tipo || '').trim().toLowerCase();

  if (clave !== 'siga_oferta' && clave !== 'siga_resultados' && clave !== 'siga_inscritos') {
    throw new Error('Tipo de dataset SIGA no válido: ' + tipo);
  }

  return clave + '_' + periodo.ano + '_' + periodo.semestre + '.csv';
}

function sigaObtenerFolder_() {
  return DriveApp.getFolderById(SIGA_FOLDER_ID);
}

function sigaGuardarArchivo_(nombre, contenido, mimeType) {
  var folder = sigaObtenerFolder_();
  var files = folder.getFilesByName(nombre);
  var blob = Utilities.newBlob(contenido, mimeType || MimeType.PLAIN_TEXT, nombre);

  if (files.hasNext()) {
    files.next().setContent(blob.getDataAsString('UTF-8'));
    return;
  }
  folder.createFile(blob);
}

function sigaGuardarCsv_(nombre, contenido) {
  var folder = sigaObtenerFolder_();
  var files = folder.getFilesByName(nombre);
  if (files.hasNext()) {
    files.next().setContent(String(contenido));
    return;
  }
  folder.createFile(nombre, String(contenido), MimeType.CSV);
}

function sigaLeerCsv_(nombre) {
  var files = sigaObtenerFolder_().getFilesByName(nombre);
  if (!files.hasNext()) {
    throw new Error('No se encontró ' + nombre + ' en la carpeta SIGA.');
  }
  return files.next().getBlob().getDataAsString('UTF-8');
}

function sigaLeerCsvSiExiste_(nombre) {
  var files = sigaObtenerFolder_().getFilesByName(nombre);
  return files.hasNext() ? files.next().getBlob().getDataAsString('UTF-8') : null;
}

function procesarSigaOferta_(contenidoCSV) {
  return procesarSigaCsv_(contenidoCSV, SIGA_OFERTA_CAMPOS, 'siga_oferta');
}

function procesarSigaInscritos_(contenidoCSV) {
  return procesarSigaCsv_(contenidoCSV, SIGA_INSCRITOS_CAMPOS, 'siga_inscritos');
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
    throw new Error('No fue posible interpretar el CSV SIGA. ' + error.message);
  }

  filas = filas.filter(function(fila, indice) {
    if (indice === 0) return true;
    return fila.some(function(valor) { return String(valor || '').trim() !== ''; });
  });

  if (filas.length < 2) throw new Error('El CSV SIGA no contiene registros de datos.');

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

    sigaValidarPeriodo_(registro.ANIO, registro.SEMESTRE_CALENDARIO);
    var obligatorioComun = registro.PERIODO && registro.ID_CURSO && registro.SEDE && registro.CARRERA;
    var obligatorioTipo = tipo === 'siga_inscritos' ? registro.ALUMNO_ID : registro.ASIGNATURA;
    if (!obligatorioComun || !obligatorioTipo) {
      throw new Error('Fila ' + (indice + 2) + ': faltan campos obligatorios de identificación.');
    }

    registro.SEMESTRE_PLAN = String(parseInt(registro.SEMESTRE_PLAN, 10) || '');
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
      semestresCalendario: valoresUnicos_(registros, 'SEMESTRE_CALENDARIO'),
      sedes: valoresUnicos_(registros, 'SEDE'),
      carreras: valoresUnicos_(registros, 'CARRERA'),
      jornadas: valoresUnicos_(registros, 'JORNADA'),
      semestresPlan: valoresUnicos_(registros, 'SEMESTRE_PLAN'),
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

/**
 * Carga un XLSX original de SIGA desde el dashboard, conserva el original y
 * genera los dos CSV del período seleccionado.
 */
function procesarArchivoSigaXlsx(ano, semestreCalendario, base64, nombreOriginal, mimeType) {
  var periodo = sigaValidarPeriodo_(ano, semestreCalendario);
  var nombre = String(nombreOriginal || 'SIGA.xlsx');

  if (!/\.xlsx$/i.test(nombre)) {
    throw new Error('El archivo SIGA debe estar en formato XLSX.');
  }
  if (!base64) throw new Error('No se recibió contenido del archivo XLSX.');

  var bytes = Utilities.base64Decode(String(base64));
  var blob = Utilities.newBlob(
    bytes,
    mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    nombre
  );

  // Se conserva siempre una copia del archivo fuente antes de procesar.
  var timestamp = Utilities.formatDate(new Date(), 'America/Santiago', 'yyyyMMdd_HHmmss');
  var nombreSeguro = nombre.replace(/[^A-Za-z0-9._-]+/g, '_');
  sigaObtenerFolder_().createFile(blob.copyBlob().setName(
    'original_' + periodo.ano + '_' + periodo.semestre + '_' + timestamp + '_' + nombreSeguro
  ));

  var libro = sigaLeerXlsx_(blob);
  var cursos = libro['CURSOS_ESI'];
  var pautas = libro['PAUTAS_ESI'];
  var publicacion = libro['PUBLICACION_SIGA'];
  var estudiantes = libro['ESTUDIANTES_ESI'];

  if (!cursos || !pautas || !publicacion || !estudiantes) {
    throw new Error('El XLSX no contiene las hojas CURSOS_ESI, PAUTAS_ESI, ESTUDIANTES_ESI y PUBLICACION_SIGA requeridas.');
  }

  sigaValidarPeriodoFuente_(cursos, periodo.periodo, 'CURSOS_ESI');
  sigaValidarPeriodoFuente_(publicacion, periodo.periodo, 'PUBLICACION_SIGA');
  sigaValidarPeriodoFuente_(estudiantes, periodo.periodo, 'ESTUDIANTES_ESI');

  var oferta = sigaConstruirOfertaDesdeXlsx_(cursos, pautas, periodo);
  var resultados = sigaConstruirResultadosDesdeXlsx_(publicacion, periodo);
  var inscritos = sigaConstruirInscritosDesdeXlsx_(estudiantes, cursos, periodo);

  var ofertaProcesada = procesarSigaOferta_(construirCSV_(
    SIGA_OFERTA_CAMPOS,
    oferta.map(function(r) { return SIGA_OFERTA_CAMPOS.map(function(c) { return r[c]; }); }),
    ';'
  ));

  var resultadosProcesados = procesarSigaResultados_(construirCSV_(
    SIGA_RESULTADOS_CAMPOS,
    resultados.map(function(r) { return SIGA_RESULTADOS_CAMPOS.map(function(c) { return r[c]; }); }),
    ';'
  ));

  var inscritosProcesados = procesarSigaInscritos_(construirCSV_(
    SIGA_INSCRITOS_CAMPOS,
    inscritos.map(function(r) { return SIGA_INSCRITOS_CAMPOS.map(function(c) { return r[c]; }); }),
    ';'
  ));

  var archivoOferta = sigaNombreArchivo_('siga_oferta', periodo.ano, periodo.semestre);
  var archivoResultados = sigaNombreArchivo_('siga_resultados', periodo.ano, periodo.semestre);
  var archivoInscritos = sigaNombreArchivo_('siga_inscritos', periodo.ano, periodo.semestre);
  sigaGuardarCsv_(archivoOferta, ofertaProcesada.csv);
  sigaGuardarCsv_(archivoResultados, resultadosProcesados.csv);
  sigaGuardarCsv_(archivoInscritos, inscritosProcesados.csv);

  return {
    ok: true,
    ano: periodo.ano,
    semestreCalendario: periodo.semestre,
    periodo: periodo.periodo,
    nombreOriginal: nombre,
    archivoOferta: archivoOferta,
    archivoResultados: archivoResultados,
    archivoInscritos: archivoInscritos,
    ramosEvaluados: sigaContarRamosEvaluados_(ofertaProcesada.registros),
    alumnosInscritos: sigaContarAlumnosInscritos_(inscritosProcesados.registros),
    registrosProcesados: resultadosProcesados.cantidadRegistros
  };
}

function sigaValidarPeriodoFuente_(registros, periodoEsperado, hoja) {
  var encontrados = {};
  registros.forEach(function(r) {
    var p = String(r.PERIODO || '').trim();
    if (p) encontrados[p] = true;
  });
  var periodos = Object.keys(encontrados);
  if (periodos.length !== 1 || periodos[0] !== periodoEsperado) {
    throw new Error(
      'La hoja ' + hoja + ' identifica el período ' + (periodos.join(', ') || 'desconocido') +
      ', pero se seleccionó ' + periodoEsperado + '.'
    );
  }
}

function sigaConstruirOfertaDesdeXlsx_(cursos, pautas, periodo) {
  var asignaturasPorPauta = {};

  pautas.forEach(function(p) {
    var pauta = String(p.PAUTA_ID || '').trim();
    var asignatura = String(p.ASIGNATURA || '').trim();
    if (!pauta || !asignatura) return;
    asignaturasPorPauta[pauta] = asignaturasPorPauta[pauta] || {};
    asignaturasPorPauta[pauta][asignatura] = true;
  });

  var vistos = {};
  var salida = [];

  cursos.forEach(function(c) {
    if (String(c.PERIODO || '').trim() !== periodo.periodo) return;
    var pauta = String(c.PAUTA_ID || '').trim();
    var asignaturas = Object.keys(asignaturasPorPauta[pauta] || {});

    asignaturas.forEach(function(asignatura) {
      var clave = [c.ID_CURSO, asignatura].join('|');
      if (vistos[clave]) return;
      vistos[clave] = true;

      salida.push({
        ANIO: periodo.ano,
        SEMESTRE_CALENDARIO: periodo.semestre,
        PERIODO: periodo.periodo,
        ID_CURSO: String(c.ID_CURSO || '').trim(),
        SEDE: String(c.SEDE || '').trim(),
        CARRERA: String(c.CARRERA || '').trim(),
        SEMESTRE_PLAN: String(parseInt(c.SEMESTRE, 10) || ''),
        NIVEL: String(c.NIVEL || '').trim(),
        JORNADA: String(c.JORNADA || '').trim(),
        ASIGNATURA: asignatura
      });
    });
  });

  return salida;
}


function sigaConstruirInscritosDesdeXlsx_(estudiantes, cursos, periodo) {
  var cursosPorId = {};
  cursos.forEach(function(c) {
    if (String(c.PERIODO || '').trim() !== periodo.periodo) return;
    var id = String(c.ID_CURSO || '').trim();
    if (id) cursosPorId[id] = c;
  });

  var ruts = {};
  estudiantes.forEach(function(e) {
    if (String(e.PERIODO || '').trim() !== periodo.periodo) return;
    var rut = String(e.RUT || '').trim();
    if (rut) ruts[rut] = true;
  });
  var listaRuts = Object.keys(ruts).sort();
  var idAnonimo = {};
  listaRuts.forEach(function(rut, i) {
    idAnonimo[rut] = 'A' + ('0000' + (i + 1)).slice(-4);
  });

  var vistos = {};
  var salida = [];
  estudiantes.forEach(function(e) {
    if (String(e.PERIODO || '').trim() !== periodo.periodo) return;
    var rut = String(e.RUT || '').trim();
    var idCurso = String(e.ID_CURSO || '').trim();
    if (!rut || !idCurso || !cursosPorId[idCurso]) return;

    var clave = rut + '|' + idCurso;
    if (vistos[clave]) return;
    vistos[clave] = true;

    var c = cursosPorId[idCurso];
    salida.push({
      ANIO: periodo.ano,
      SEMESTRE_CALENDARIO: periodo.semestre,
      PERIODO: periodo.periodo,
      ALUMNO_ID: idAnonimo[rut],
      ID_CURSO: idCurso,
      SEDE: String(c.SEDE || '').trim(),
      CARRERA: String(c.CARRERA || '').trim(),
      SEMESTRE_PLAN: String(parseInt(c.SEMESTRE, 10) || ''),
      NIVEL: String(c.NIVEL || '').trim(),
      JORNADA: String(c.JORNADA || '').trim(),
      ESTADO: String(e.ESTADO || '').trim()
    });
  });
  return salida;
}

function sigaContarRamosEvaluados_(registros) {
  var vistos = {};
  (registros || []).forEach(function(r) {
    var clave = [
      String(r.SEDE || '').trim().toUpperCase(),
      String(r.CARRERA || '').trim().toUpperCase(),
      String(r.JORNADA || '').trim().toUpperCase(),
      String(r.ASIGNATURA || '').trim().toUpperCase()
    ].join('|');
    if (clave.replace(/\|/g, '')) vistos[clave] = true;
  });
  return Object.keys(vistos).length;
}

function sigaContarAlumnosInscritos_(registros) {
  var vistos = {};
  (registros || []).forEach(function(r) {
    var id = String(r.ALUMNO_ID || '').trim();
    if (id) vistos[id] = true;
  });
  return Object.keys(vistos).length;
}

function sigaConstruirResultadosDesdeXlsx_(publicacion, periodo) {
  return publicacion
    .filter(function(r) { return String(r.PERIODO || '').trim() === periodo.periodo; })
    .map(function(r) {
      return {
        ANIO: periodo.ano,
        SEMESTRE_CALENDARIO: periodo.semestre,
        PERIODO: periodo.periodo,
        ID_CURSO: String(r.ID_CURSO || '').trim(),
        SEDE: String(r.SEDE || '').trim(),
        CARRERA: String(r.CARRERA || '').trim(),
        SEMESTRE_PLAN: String(parseInt(r.SEMESTRE, 10) || ''),
        JORNADA: String(r.JORNADA || '').trim(),
        ASIGNATURA: String(r.ASIGNATURA || '').trim(),
        PROMEDIO_FINAL: String(r.PROMEDIO_FINAL === null || r.PROMEDIO_FINAL === undefined ? '' : r.PROMEDIO_FINAL).trim(),
        SITUACION: String(r.SITUACION || '').trim(),
        TIPO_EVALUACION: String(r.TIPO_EVALUACION || '').trim(),
        ESTADO_ENVIO: String(r.ESTADO_ENVIO || '').trim()
      };
    })
    .filter(function(r) { return r.ID_CURSO && r.ASIGNATURA; });
}

/** Lector OOXML mínimo para las hojas necesarias del XLSX. */
function sigaLeerXlsx_(blob) {
  var partes = Utilities.unzip(blob.copyBlob().setContentType('application/zip'));
  var mapa = {};
  partes.forEach(function(b) { mapa[b.getName()] = b; });

  var workbookBlob = mapa['xl/workbook.xml'];
  var relsBlob = mapa['xl/_rels/workbook.xml.rels'];
  if (!workbookBlob || !relsBlob) throw new Error('El archivo XLSX no tiene una estructura OOXML válida.');

  var shared = sigaLeerSharedStrings_(mapa['xl/sharedStrings.xml']);
  var workbookDoc = XmlService.parse(workbookBlob.getDataAsString('UTF-8'));
  var wbRoot = workbookDoc.getRootElement();
  var ns = wbRoot.getNamespace();
  var relNs = XmlService.getNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships');
  var sheetsEl = wbRoot.getChild('sheets', ns);

  var relDoc = XmlService.parse(relsBlob.getDataAsString('UTF-8'));
  var relRoot = relDoc.getRootElement();
  var relMap = {};
  relRoot.getChildren().forEach(function(rel) {
    relMap[rel.getAttribute('Id').getValue()] = rel.getAttribute('Target').getValue();
  });

  var salida = {};
  sheetsEl.getChildren('sheet', ns).forEach(function(sheet) {
    var nombre = sheet.getAttribute('name').getValue();
    if (['CURSOS_ESI','PAUTAS_ESI','ESTUDIANTES_ESI','PUBLICACION_SIGA'].indexOf(nombre) === -1) return;

    var rid = sheet.getAttribute('id', relNs).getValue();
    var target = relMap[rid];
    if (!target) return;
    var ruta = target.indexOf('/') === 0 ? target.substring(1) : 'xl/' + target.replace(/^\.\//, '');
    var hojaBlob = mapa[ruta];
    if (!hojaBlob) throw new Error('No fue posible leer la hoja ' + nombre + ' del XLSX.');
    salida[nombre] = sigaLeerHojaXlsx_(hojaBlob.getDataAsString('UTF-8'), shared);
  });

  return salida;
}

function sigaLeerSharedStrings_(blob) {
  if (!blob) return [];
  var doc = XmlService.parse(blob.getDataAsString('UTF-8'));
  var root = doc.getRootElement();
  var ns = root.getNamespace();

  return root.getChildren('si', ns).map(function(si) {
    return sigaTextoXml_(si, ns);
  });
}

function sigaTextoXml_(elemento, ns) {
  var texto = '';
  if (elemento.getName() === 't') texto += elemento.getText();
  elemento.getChildren().forEach(function(hijo) {
    texto += sigaTextoXml_(hijo, ns);
  });
  return texto;
}

function sigaLeerHojaXlsx_(xml, shared) {
  var doc = XmlService.parse(xml);
  var root = doc.getRootElement();
  var ns = root.getNamespace();
  var sheetData = root.getChild('sheetData', ns);
  if (!sheetData) return [];

  var filas = [];
  sheetData.getChildren('row', ns).forEach(function(row) {
    var valores = [];
    row.getChildren('c', ns).forEach(function(c) {
      var ref = c.getAttribute('r') ? c.getAttribute('r').getValue() : '';
      var indice = sigaColumnaIndice_(ref.replace(/\d+/g, ''));
      var tipo = c.getAttribute('t') ? c.getAttribute('t').getValue() : '';
      var valor = '';

      if (tipo === 'inlineStr') {
        var is = c.getChild('is', ns);
        valor = is ? sigaTextoXml_(is, ns) : '';
      } else {
        var v = c.getChild('v', ns);
        var bruto = v ? v.getText() : '';
        valor = tipo === 's' ? (shared[Number(bruto)] || '') : bruto;
      }
      valores[indice] = valor;
    });
    filas.push(valores);
  });

  if (!filas.length) return [];
  var headers = filas[0].map(function(h) { return String(h || '').trim(); });
  return filas.slice(1).map(function(fila) {
    var obj = {};
    headers.forEach(function(h, i) {
      if (h) obj[h] = fila[i] === undefined ? '' : fila[i];
    });
    return obj;
  }).filter(function(obj) {
    return Object.keys(obj).some(function(k) { return String(obj[k] || '').trim() !== ''; });
  });
}

function sigaColumnaIndice_(letras) {
  var n = 0;
  String(letras || '').toUpperCase().split('').forEach(function(ch) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  });
  return Math.max(0, n - 1);
}

function obtenerDatasetSiga(tipo, ano, semestreCalendario) {
  var clave = String(tipo || '').trim().toLowerCase();
  var periodo = sigaValidarPeriodo_(ano, semestreCalendario);
  var archivo = sigaNombreArchivo_(clave, periodo.ano, periodo.semestre);
  var contenido = sigaLeerCsv_(archivo);
  var resultado = clave === 'siga_oferta'
    ? procesarSigaOferta_(contenido)
    : clave === 'siga_inscritos'
      ? procesarSigaInscritos_(contenido)
      : procesarSigaResultados_(contenido);

  return {
    ok: true,
    tipo: clave,
    ano: periodo.ano,
    semestreCalendario: periodo.semestre,
    periodo: periodo.periodo,
    archivoOficial: archivo,
    cantidadRegistros: resultado.cantidadRegistros,
    cantidadColumnas: resultado.encabezados.length,
    encabezados: resultado.encabezados,
    filtros: resultado.filtros,
    registros: resultado.registros
  };
}

function obtenerPeriodosSiga() {
  var files = sigaObtenerFolder_().getFiles();
  var estado = {};

  while (files.hasNext()) {
    var nombre = files.next().getName();
    var match = nombre.match(/^siga_(oferta|resultados|inscritos)_(20\d{2})_([12])\.csv$/i);
    if (!match) continue;

    var key = match[2] + '-' + match[3];
    estado[key] = estado[key] || {
      ano: match[2], semestre: match[3], periodo: key, oferta: false, resultados: false, inscritos: false
    };
    estado[key][match[1].toLowerCase()] = true;
  }

  return Object.keys(estado)
    .sort(function(a,b) { return b.localeCompare(a, 'es', { numeric:true }); })
    .map(function(k) { return estado[k]; });
}

function obtenerCsvSigaDescarga(tipo, ano, semestreCalendario) {
  var archivo = sigaNombreArchivo_(tipo, ano, semestreCalendario);
  var contenido = sigaLeerCsvSiExiste_(archivo);
  return {
    disponible: csvTieneDatos_(contenido),
    archivo: archivo,
    contenido: contenido || ''
  };
}
