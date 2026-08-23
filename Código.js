/**
 * CFT Laplace — Dashboard Institucional
 * Código.gs
 *
 * Orquestador principal de la aplicación web.
 */

var FOLDER_ID = '1x6HcDdtrVkEJj9z3z6m3jIUxSwuHEmem';

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('CFT Laplace — Dashboard Institucional')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Permite incrustar archivos HTML auxiliares dentro de Index.html.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Prueba manual de acceso a la carpeta de datos.
 */
function testFolderAccess() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFiles();
  var names = [];

  while (files.hasNext()) {
    names.push(files.next().getName());
  }

  Logger.log('Archivos en la carpeta: ' + names.join(', '));
  return names;
}

/**
 * Actualiza un dataset oficial desde el frontend.
 *
 * El nombre del archivo local NO determina el archivo de Drive.
 * El parámetro "tipo" determina qué dataset se procesa y reemplaza.
 */
function actualizarDataset(tipo, contenidoCSV, nombreOriginal) {
  var config = obtenerConfiguracionDataset_(tipo);
  var resultado;

  switch (String(tipo).toLowerCase()) {
    case 'matricula':
      resultado = procesarMatricula_(contenidoCSV);
      break;

    case 'titulados':
      resultado = procesarTitulados_(contenidoCSV);
      break;

    case 'oferta':
      resultado = procesarOferta_(contenidoCSV);
      break;

    case 'composicion_matricula':
      resultado = procesarComposicionMatricula_(contenidoCSV);
      break;

    case 'dotacion':
      resultado = procesarDotacion_(contenidoCSV);
      break;

    default:
      throw new Error(
        'El dataset "' + tipo + '" todavía no tiene un procesador implementado.'
      );
  }

  // Solo se reemplaza el archivo oficial después de validar completamente.
  guardarDataset_(config.archivo, resultado.csv);

  var sincronizacionComposicion = null;
  var discrepanciasPrimerAno = [];

  if (String(tipo).toLowerCase() === 'matricula') {
    sincronizacionComposicion =
      sincronizarComposicionDesdeMatricula_(resultado.registros);

    discrepanciasPrimerAno =
      sincronizacionComposicion.discrepancias || [];
  }

  if (String(tipo).toLowerCase() === 'composicion_matricula') {
    discrepanciasPrimerAno =
      compararComposicionActualConMatricula_(resultado.registros);
  }

  return {
    ok: true,
    tipo: tipo,
    nombreOriginal: nombreOriginal || '',
    archivoOficial: config.archivo,
    cantidadRegistros: resultado.cantidadRegistros,
    cantidadColumnas: resultado.encabezados.length,
    encabezados: resultado.encabezados,
    filtros: resultado.filtros,
    registros: resultado.registros,
    sincronizacionComposicion: sincronizacionComposicion,
    discrepanciasPrimerAno: discrepanciasPrimerAno
  };
}

/**
 * Lee un dataset oficial y lo devuelve procesado al frontend.
 * No modifica Drive.
 */
function obtenerDataset(tipo) {
  var config = obtenerConfiguracionDataset_(tipo);
  var contenidoCSV = leerDataset_(config.archivo);
  var resultado;

  switch (String(tipo).toLowerCase()) {
    case 'matricula':
      resultado = procesarMatricula_(contenidoCSV);
      break;

    case 'titulados':
      resultado = procesarTitulados_(contenidoCSV);
      break;

    case 'oferta':
      resultado = procesarOferta_(contenidoCSV);
      break;

    case 'composicion_matricula':
      resultado = procesarComposicionMatricula_(contenidoCSV);
      break;

    case 'dotacion':
      resultado = procesarDotacion_(contenidoCSV);
      break;

    default:
      throw new Error(
        'El dataset "' + tipo + '" todavía no tiene un lector implementado.'
      );
  }

  var discrepanciasPrimerAno = [];

  if (String(tipo).toLowerCase() === 'composicion_matricula') {
    discrepanciasPrimerAno =
      compararComposicionActualConMatricula_(resultado.registros);
  }

  return {
    ok: true,
    tipo: tipo,
    archivoOficial: config.archivo,
    cantidadRegistros: resultado.cantidadRegistros,
    cantidadColumnas: resultado.encabezados.length,
    encabezados: resultado.encabezados,
    filtros: resultado.filtros,
    registros: resultado.registros,
    discrepanciasPrimerAno: discrepanciasPrimerAno
  };
}

