/**
 * Única fuente de verdad de Business.availabilityConfirmedAt ("vendiendo
 * ahora · confirmado hace X") — R5, docs/specs/r5-estoy-vendiendo.md.
 *
 * Regla: el aviso más reciente del vendedor manda, venga de donde venga:
 *   - respuesta a una pregunta (solicitudes_disponibilidad): "sí" = vendiendo,
 *     "no" = dejó de vender;
 *   - aviso propio (senales_venta): "Estoy vendiendo ahora" / "Ya no estoy
 *     vendiendo".
 * Si ese último aviso es "vendiendo" y tiene menos de
 * AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES, su fecha es la confirmación
 * vigente; en cualquier otro caso, null.
 *
 * Antes de R5 esta consulta vivía copiada en tres lugares y solo miraba
 * las respuestas "sí": un "no" posterior no apagaba un "sí" anterior
 * todavía fresco (confirmado con una prueba de regresión en
 * availabilityRequests.test.js antes de cambiarlo).
 *
 * Devuelve una subconsulta con una sola columna, `respondida_en` (nombre
 * que ya usaban los callers), pensada para `LEFT JOIN LATERAL (...) disp
 * ON true`. Cada mitad del UNION usa su índice (idx_senales_venta_negocio,
 * idx_solicitudes_disponibilidad_respondidas).
 *
 * @param {string} exprNegocioId expresión SQL del id del negocio (ej. `n.id` o `$1`)
 * @param {number} idxFrescura índice ($N) de AVAILABILITY_CONFIRMED_FRESHNESS_MINUTES en params
 */
function subconsultaUltimaSenalVenta(exprNegocioId, idxFrescura) {
  return `SELECT CASE
             WHEN ult.vendiendo AND ult.fecha > now() - ($${idxFrescura} || ' minutes')::interval
             THEN ult.fecha
           END AS respondida_en
         FROM (
           (SELECT sd.respondida_en AS fecha, (sd.decision = 'confirmada') AS vendiendo
              FROM solicitudes_disponibilidad sd
             WHERE sd.negocio_id = ${exprNegocioId} AND sd.decision IS NOT NULL
             ORDER BY sd.respondida_en DESC
             LIMIT 1)
           UNION ALL
           (SELECT sv.fecha_creacion AS fecha, (sv.senal = 'vendiendo') AS vendiendo
              FROM senales_venta sv
             WHERE sv.negocio_id = ${exprNegocioId}
             ORDER BY sv.fecha_creacion DESC
             LIMIT 1)
         ) ult
         ORDER BY ult.fecha DESC
         LIMIT 1`;
}

/** `LEFT JOIN LATERAL` listo para listados que ya tienen `n` (negocios) en el FROM. */
function lateralUltimaSenalVenta(idxFrescura) {
  return `LEFT JOIN LATERAL (${subconsultaUltimaSenalVenta('n.id', idxFrescura)}) disp ON true`;
}

module.exports = { subconsultaUltimaSenalVenta, lateralUltimaSenalVenta };
