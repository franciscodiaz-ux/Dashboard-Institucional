/**
 * CFT Laplace — Dashboard Institucional
 * Financiero.gs
 *
 * Procesa financiero.csv y calcula indicadores derivados.
 * Unidad monetaria del archivo: miles de CLP.
 */

var FINANCIERO_ARCHIVO = 'financiero.csv';

function obtenerFinanciero() {
  var contenido = leerFinancieroCsv_();
  var resultado = procesarFinanciero_(contenido);

  return {
    ok: true,
    archivoOficial: FINANCIERO_ARCHIVO,
    registros: resultado.registros,
    anos: resultado.anos,
    ultimoAno: resultado.ultimoAno,
    nota2026: '2026 corresponde al período enero-julio y no es directamente comparable con años completos.'
  };
}

function obtenerFinancieroCsv() {
  var contenido = leerFinancieroCsv_();

  return {
    disponible: String(contenido || '').trim() !== '',
    archivo: FINANCIERO_ARCHIVO,
    contenido: contenido || ''
  };
}

function leerFinancieroCsv_() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFilesByName(FINANCIERO_ARCHIVO);

  if (!files.hasNext()) {
    throw new Error(
      'No se encontró "' + FINANCIERO_ARCHIVO +
      '" en la carpeta del proyecto.'
    );
  }

  return files.next().getBlob().getDataAsString('UTF-8');
}

function procesarFinanciero_(contenidoCSV) {
  if (!contenidoCSV || String(contenidoCSV).trim() === '') {
    throw new Error('financiero.csv está vacío.');
  }

  var filas = Utilities.parseCsv(String(contenidoCSV), ';')
    .filter(function(fila, indice) {
      if (indice === 0) return true;
      return fila.some(function(valor) {
        return String(valor || '').trim() !== '';
      });
    });

  if (filas.length < 2) {
    throw new Error('financiero.csv no contiene registros.');
  }

  var encabezados = filas[0].map(function(valor) {
    return String(valor || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, '_');
  });

  var registros = filas.slice(1).map(function(fila) {
    var r = {};

    encabezados.forEach(function(encabezado, indice) {
      var valor = fila[indice] === undefined ? '' : fila[indice];

      if (
        encabezado === 'PERIODO' ||
        encabezado === 'UNIDAD_MONETARIA'
      ) {
        r[encabezado] = String(valor || '').trim();
      } else {
        var numero = numeroFinanciero_(valor);
        r[encabezado] =
          encabezado === 'ANIO' ? Number(numero || 0) : numero;
      }
    });

    calcularIndicadoresFinancieros_(r);
    return r;
  }).filter(function(r) {
    return Number(r.ANIO) > 0;
  });

  registros.sort(function(a, b) {
    return Number(a.ANIO) - Number(b.ANIO);
  });

  return {
    registros: registros,
    anos: registros.map(function(r) { return r.ANIO; }),
    ultimoAno: registros.length
      ? registros[registros.length - 1].ANIO
      : null
  };
}

function numeroFinanciero_(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return 0;
  }

  if (typeof valor === 'number') {
    return isFinite(valor) ? valor : 0;
  }

  var texto = String(valor).trim();

  if (texto === '') return 0;

  texto = texto
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  var numero = Number(texto);
  return isFinite(numero) ? numero : 0;
}

function dividirSeguro_(numerador, denominador) {
  numerador = Number(numerador || 0);
  denominador = Number(denominador || 0);

  if (!denominador) return null;
  return numerador / denominador;
}

function calcularIndicadoresFinancieros_(r) {
  r.ACTIVOS_TOTALES =
    Number(r.ACTIVOS_CORRIENTES || 0) +
    Number(r.ACTIVOS_NO_CORRIENTES || 0);

  r.RESULTADO_CALCULADO =
    Number(r.INGRESOS_TOTALES || 0) -
    Number(r.GASTOS_TOTALES || 0);

  r.LIQUIDEZ_CORRIENTE = dividirSeguro_(
    r.ACTIVOS_CORRIENTES,
    r.PASIVOS_CORRIENTES
  );

  // La planilla no entrega inventarios como partida separada.
  // Mientras INVENTARIOS no exista, se asume 0.
  r.RAZON_ACIDA = dividirSeguro_(
    Number(r.ACTIVOS_CORRIENTES || 0) -
      Number(r.INVENTARIOS || 0),
    r.PASIVOS_CORRIENTES
  );

  r.CAPITAL_TRABAJO =
    Number(r.ACTIVOS_CORRIENTES || 0) -
    Number(r.PASIVOS_CORRIENTES || 0);

  r.DEUDA_PATRIMONIO = dividirSeguro_(
    r.PASIVOS_TOTALES,
    r.PATRIMONIO
  );

  r.ROE = dividirSeguro_(
    r.RESULTADO_EJERCICIO,
    r.PATRIMONIO
  );

  r.ROA = dividirSeguro_(
    r.RESULTADO_EJERCICIO,
    r.ACTIVOS_TOTALES
  );

  r.MARGEN_EXCEDENTES = dividirSeguro_(
    r.RESULTADO_EJERCICIO,
    r.INGRESOS_TOTALES
  );

  r.GASTO_PERSONAL =
    Number(r.GASTO_REMUNERACIONES_DIRECTORES || 0) +
    Number(r.GASTO_DOCENTES_CONTRATADOS || 0) +
    Number(r.GASTO_DOCENTES_HONORARIOS || 0) +
    Number(r.GASTO_ADMINISTRATIVOS || 0) +
    Number(r.GASTO_OTROS_HONORARIOS || 0);

  r.PESO_GASTO_PERSONAL = dividirSeguro_(
    r.GASTO_PERSONAL,
    r.GASTOS_TOTALES
  );
}
