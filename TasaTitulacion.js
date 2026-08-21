/**
 * CFT Laplace — Dashboard Institucional
 * TasaTitulacion.gs
 *
 * Indicadores derivados:
 *
 * 1) Tasa de Titulación por cohorte (aproximada)
 *    Cohorte y = año de titulación x - 2
 *    TT cohorte y = Titulados del año y+2 / Primer Año de la cohorte y * 100
 *
 *    Supuesto metodológico institucional:
 *    mientras no exista año real de ingreso de cada titulado, se atribuyen
 *    todos los titulados del año x a la cohorte x-2.
 *
 * 2) Conversión PT anual
 *    Conversión PT año x = Titulados año x / Proceso de Titulación año x * 100
 */

function hayTasaTitulacionCalculable_() {
  return csvTieneDatos_(leerDatasetSiExiste_('titulados.csv')) &&
         csvTieneDatos_(leerDatasetSiExiste_('composicion_matricula.csv'));
}

function obtenerDatosTasaTitulacion() {
  if (!hayTasaTitulacionCalculable_()) {
    throw new Error(
      'Tasa de Titulación requiere titulados.csv y composicion_matricula.csv con datos.'
    );
  }

  var titulados = procesarTitulados_(
    leerDatasetSiExiste_('titulados.csv')
  );

  var composicion = procesarComposicionMatricula_(
    leerDatasetSiExiste_('composicion_matricula.csv')
  );

  return {
    titulados: titulados.registros,
    composicion: composicion.registros
  };
}

function generarCsvTasaTitulacion_() {
  if (!hayTasaTitulacionCalculable_()) {
    return '';
  }

  var datos = obtenerDatosTasaTitulacion();
  var primeroPorAno = {};
  var ptPorAno = {};
  var tituladosPorAno = {};

  datos.composicion.forEach(function(r) {
    var ano = Number(extraerAno_(r.ANIO));
    if (!isFinite(ano)) return;

    primeroPorAno[ano] =
      (primeroPorAno[ano] || 0) + numeroSeguro_(r.PRIMER_ANIO);

    ptPorAno[ano] =
      (ptPorAno[ano] || 0) + numeroSeguro_(r.PROCESO_TITULACION);
  });

  datos.titulados.forEach(function(r) {
    var ano = Number(extraerAno_(r['AÑO']));
    if (!isFinite(ano)) return;

    tituladosPorAno[ano] =
      (tituladosPorAno[ano] || 0) + numeroSeguro_(r['TOTAL TITULACIONES']);
  });

  var cohortes = Object.keys(primeroPorAno)
    .map(Number)
    .sort(function(a, b) { return a - b; });

  var filas = cohortes.map(function(cohorte) {
    var anoTitulacion = cohorte + 2;
    var primerAno = primeroPorAno[cohorte] || 0;
    var tituladosCohorte = tituladosPorAno[anoTitulacion] || 0;
    var tasa = primerAno > 0 && tituladosPorAno.hasOwnProperty(anoTitulacion)
      ? (tituladosCohorte / primerAno) * 100
      : '';

    var tituladosMismoAno = tituladosPorAno[cohorte] || 0;
    var pt = ptPorAno[cohorte] || 0;
    var conversion = pt > 0 && tituladosPorAno.hasOwnProperty(cohorte)
      ? (tituladosMismoAno / pt) * 100
      : '';

    return [
      String(cohorte),
      String(anoTitulacion),
      String(primerAno),
      tituladosPorAno.hasOwnProperty(anoTitulacion) ? String(tituladosCohorte) : '',
      tasa === '' ? '' : tasa.toFixed(2),
      String(cohorte),
      String(pt),
      tituladosPorAno.hasOwnProperty(cohorte) ? String(tituladosMismoAno) : '',
      conversion === '' ? '' : conversion.toFixed(2)
    ];
  });

  return construirCSV_(
    [
      'COHORTE',
      'ANIO_TITULACION_ASUMIDO',
      'PRIMER_ANIO_COHORTE',
      'TITULADOS_ANIO_COHORTE_MAS_2',
      'TASA_TITULACION_PORCENTAJE',
      'ANIO_CONVERSION_PT',
      'PROCESO_TITULACION',
      'TITULADOS_MISMO_ANIO',
      'CONVERSION_PT_PORCENTAJE'
    ],
    filas,
    ';'
  );
}

