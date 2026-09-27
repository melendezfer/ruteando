const pool = require('../config/db');
const { subconsultaUltimaSenalVenta } = require('./ultimaSenalVenta');

/**
 * Avisos propios del vendedor (R5, docs/specs/r5-estoy-vendiendo.md).
 * Cada escritura corre en una transacción con un advisory lock por negocio
 * (mismo patrón que posiciones_en_vivo y fotos): dos toques simultáneos
 * del mismo vendedor no pueden pasar los dos el chequeo de intervalo
 * mínimo ni insertar dos filas.
 */
async function conBloqueoDeNegocio(negocioId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`venta:${negocioId}`]);
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function confirmacionVigente(client, negocioId, freshnessMinutes) {
  const { rows } = await client.query(subconsultaUltimaSenalVenta('$1', 2), [
    negocioId,
    freshnessMinutes,
  ]);
  return rows[0]?.respondida_en ?? null;
}

/**
 * "Estoy vendiendo ahora". Devuelve:
 *   { resultado: 'guardada', confirmadaEn }  — fila nueva;
 *   { resultado: 'reciente', confirmadaEn }  — ya había una confirmación de
 *     hace menos de `intervaloMinutos` (de cualquier fuente): no se inserta;
 *   { resultado: 'limite' }                  — se pasó el tope de 24 h.
 */
async function registrarVendiendo({ negocioId, usuarioId, freshnessMinutes, intervaloMinutos, maxDiario }) {
  return conBloqueoDeNegocio(negocioId, async (client) => {
    const vigente = await confirmacionVigente(client, negocioId, freshnessMinutes);
    if (vigente && Date.now() - new Date(vigente).getTime() < intervaloMinutos * 60 * 1000) {
      return { resultado: 'reciente', confirmadaEn: vigente };
    }

    const { rows: conteo } = await client.query(
      `SELECT count(*)::int AS total FROM senales_venta
        WHERE negocio_id = $1 AND senal = 'vendiendo' AND fecha_creacion > now() - interval '24 hours'`,
      [negocioId],
    );
    if (conteo[0].total >= maxDiario) {
      return { resultado: 'limite' };
    }

    const { rows } = await client.query(
      `INSERT INTO senales_venta (negocio_id, usuario_id, senal)
       VALUES ($1, $2, 'vendiendo')
       RETURNING fecha_creacion`,
      [negocioId, usuarioId],
    );
    // Analítica (spec DP-7): la escribe el servidor, nunca el cliente.
    await client.query(
      `INSERT INTO eventos (usuario_id, negocio_id, tipo) VALUES ($1, $2, 'confirmacion_venta')`,
      [usuarioId, negocioId],
    );
    return { resultado: 'guardada', confirmadaEn: rows[0].fecha_creacion };
  });
}

/**
 * "Ya no estoy vendiendo". Solo inserta si hay una confirmación vigente
 * que apagar; sin ella es un no-op (devuelve false). No cuenta para el
 * tope diario: apagar siempre tiene que funcionar.
 */
async function registrarDejoDeVender({ negocioId, usuarioId, freshnessMinutes }) {
  return conBloqueoDeNegocio(negocioId, async (client) => {
    const vigente = await confirmacionVigente(client, negocioId, freshnessMinutes);
    if (!vigente) return false;
    await client.query(
      `INSERT INTO senales_venta (negocio_id, usuario_id, senal) VALUES ($1, $2, 'dejo_de_vender')`,
      [negocioId, usuarioId],
    );
    return true;
  });
}

module.exports = { registrarVendiendo, registrarDejoDeVender };
