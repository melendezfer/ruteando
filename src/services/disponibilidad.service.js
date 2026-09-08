const { ORDEN_DIAS_DB } = require('./business.mapper');

/**
 * Día anterior a diaDb en el ciclo lunes->domingo (con wraparound:
 * anterior a "lunes" es "domingo", no un índice negativo). Necesario para
 * "abierto ahora" — ver estaAbiertoAhora más abajo.
 */
function diaAnterior(diaDb) {
  const indice = ORDEN_DIAS_DB.indexOf(diaDb);
  return ORDEN_DIAS_DB[(indice + 6) % 7]; // +6 ≡ -1 (mod 7), sin índices negativos
}

/**
 * ¿Está el negocio abierto en este momento? horarios es el arreglo crudo
 * de filas de la tabla `horarios` (con `dia`, `hora_apertura`,
 * `hora_cierre` en formato 'HH:MM' o 'HH:MM:SS', y `cerrado`) para TODOS
 * los días del negocio — esta función filtra internamente cuáles
 * aplican.
 *
 * Un turno nocturno que cruza medianoche (hora_apertura > hora_cierre,
 * ej. 18:00-02:00) queda guardado bajo el día en que EMPIEZA, así que
 * hay que revisar dos filas, no una:
 *   - la fila de HOY aporta la mitad "antes de medianoche" (ahora >= apertura)
 *   - la fila de AYER (si también es nocturna) aporta la mitad "después
 *     de medianoche" (ahora <= cierre)
 * Aplicar la regla completa (ahora >= apertura O ahora <= cierre) contra
 * una sola fila da un falso positivo: la fila de HOY, evaluada antes de
 * su propia hora de apertura, no debe abrirse por la mitad "ahora <=
 * cierre" que en realidad le pertenece al turno de AYER (o a nadie, si
 * ayer no tenía turno nocturno) — ver la prueba de regresión en
 * disponibilidad.service.test.js con este caso exacto.
 */
function estaAbiertoAhora({ hoyDb, horaActual, horarios }) {
  const ayerDb = diaAnterior(hoyDb);

  const filaHoy = horarios.find((h) => h.dia === hoyDb && !h.cerrado);
  const filaAyer = horarios.find((h) => h.dia === ayerDb && !h.cerrado);

  if (filaHoy) {
    const { hora_apertura: apertura, hora_cierre: cierre } = filaHoy;
    if (apertura <= cierre) {
      // Caso normal: turno de un solo día.
      if (horaActual >= apertura && horaActual <= cierre) return true;
    } else {
      // Nocturno que empieza hoy: solo la mitad "antes de medianoche".
      if (horaActual >= apertura) return true;
    }
  }

  if (filaAyer) {
    const { hora_apertura: aperturaAyer, hora_cierre: cierreAyer } = filaAyer;
    if (aperturaAyer > cierreAyer) {
      // Nocturno que empezó ayer: solo la mitad "después de medianoche".
      if (horaActual <= cierreAyer) return true;
    }
  }

  return false;
}

const DIA_INGLES_A_DB = {
  Monday: 'lunes',
  Tuesday: 'martes',
  Wednesday: 'miercoles',
  Thursday: 'jueves',
  Friday: 'viernes',
  Saturday: 'sabado',
  Sunday: 'domingo',
};

/**
 * Colombia usa un solo huso horario, sin horario de verano (America/Bogota,
 * UTC-5 todo el año) — por eso alcanza con Intl.DateTimeFormat en vez de
 * necesitar un cálculo de offset. Se usa para el filtro openNow de
 * /businesses y /businesses/nearby (ver negocios.repository.js).
 */
function momentoActualBogota(ahora = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const partes = Object.fromEntries(formatter.formatToParts(ahora).map((p) => [p.type, p.value]));

  // Curiosidad de ICU: con hour12:false, algunas implementaciones
  // devuelven "24" para la medianoche en vez de "00" — se normaliza para
  // no romper la comparación lexicográfica contra las columnas TIME.
  const hora = partes.hour === '24' ? '00' : partes.hour;

  return {
    hoyDb: DIA_INGLES_A_DB[partes.weekday],
    horaActual: `${hora}:${partes.minute}`,
  };
}

module.exports = { diaAnterior, estaAbiertoAhora, momentoActualBogota };
