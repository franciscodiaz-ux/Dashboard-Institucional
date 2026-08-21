/**
 * CFT Laplace — Dashboard Institucional
 * Retencion.gs
 *
 * Indicador derivado desde composicion_matricula.csv.
 *
 * Regla metodológica simplificada acordada:
 * Retención cohorte t = Segundo Año en t+1 / Primer Año en t * 100
 *
 * Se asume, para efectos de este indicador, que los estudiantes de segundo año
 * pertenecen a la cohorte inmediatamente anterior.
 */

/**
 * Determina si existen al menos dos años consecutivos en Composición Matrícula.
 */
function hayRetencionCalculable_() {
  var contenido = leerDatasetSiExiste_('composicion_matricula.csv');

  if (!csvTieneDatos_(contenido)) {
    return false;
  }

  var resultado = procesarComposicionMatricula_(contenido);
  var anos = {};

  resultado.registros.forEach(function(registro) {
    var ano = Number(extraerAno_(registro.ANIO));
    if (isFinite(ano)) {
      anos[ano] = true;
    }
  });

  return Object.keys(anos).some(function(anoTexto) {
    var ano = Number(anoTexto);
    return !!anos[ano + 1];
  });
}

/**
 * Genera un CSV derivado de retención institucional por cohorte.
 *
 * Formato:
 * COHORTE;PRIMER_ANIO;SEGUNDO_ANIO_SIGUIENTE;RETENCION_PORCENTAJE
 */
function generarCsvRetencionPrimerAno_() {
  var contenido = leerDatasetSiExiste_('composicion_matricula.csv');

  if (!csvTieneDatos_(contenido)) {
    return '';
  }

  var resultado = procesarComposicionMatricula_(contenido);
  var registros = resultado.registros;
  var porAno = {};

  registros.forEach(function(registro) {
    var ano = Number(extraerAno_(registro.ANIO));

    if (!isFinite(ano)) {
      return;
    }

    if (!porAno[ano]) {
      porAno[ano] = {
        primero: 0,
        segundo: 0
      };
    }

    porAno[ano].primero += numeroSeguro_(registro.PRIMER_ANIO);
    porAno[ano].segundo += numeroSeguro_(registro.SEGUNDO_ANIO);
  });

  var anos = Object.keys(porAno)
    .map(Number)
    .sort(function(a, b) { return a - b; });

  var filas = [];

  anos.forEach(function(ano) {
    if (!porAno[ano + 1]) {
      return;
    }

    var primero = porAno[ano].primero;
    var segundoSiguiente = porAno[ano + 1].segundo;

    if (primero <= 0) {
      return;
    }

    var retencion = (segundoSiguiente / primero) * 100;

    filas.push([
      String(ano),
      String(primero),
      String(segundoSiguiente),
      retencion.toFixed(2)
    ]);
  });

  if (filas.length === 0) {
    return '';
  }

  return construirCSV_(
    [
      'COHORTE',
      'PRIMER_ANIO',
      'SEGUNDO_ANIO_SIGUIENTE',
      'RETENCION_PORCENTAJE'
    ],
    filas,
    ';'
  );
}

