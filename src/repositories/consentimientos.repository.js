const pool = require('../config/db');

async function crear({ usuarioId, negocioId, tipo, otorgadoPorTerceros, textoVersion, ip }) {
  const { rows } = await pool.query(
    `INSERT INTO consentimientos
       (usuario_id, negocio_id, tipo, otorgado_por_terceros, texto_version, ip_origen)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      usuarioId ?? null,
      negocioId ?? null,
      tipo,
      otorgadoPorTerceros,
      textoVersion,
      usuarioId ? null : (ip ?? null),
    ],
  );
  return rows[0];
}

// Historial completo, no solo el más reciente por tipo — append-only por
// diseño (ver CLAUDE.md): aceptar una versión nueva o "retirar" un
// consentimiento es una fila nueva, nunca se edita ni se borra una
// anterior. Más recientes primero, mismo criterio que el resto del
// proyecto.
async function listarPorUsuario(usuarioId) {
  const { rows } = await pool.query(
    'SELECT * FROM consentimientos WHERE usuario_id = $1 ORDER BY fecha_otorgado DESC',
    [usuarioId],
  );
  return rows;
}

/**
 * RF-018: qué tipos, de los obligatorios, ya otorgó este usuario (al
 * menos una vez, en cualquier momento). Usada por
 * consentimientos.service.js#obtenerTiposObligatoriosFaltantes, que a su
 * vez usa auth.service.js en login()/refresh().
 */
async function tiposObligatoriosOtorgados(usuarioId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT tipo FROM consentimientos
     WHERE usuario_id = $1 AND tipo IN ('tratamiento_datos', 'terminos_condiciones')`,
    [usuarioId],
  );
  return rows.map((r) => r.tipo);
}

module.exports = { crear, listarPorUsuario, tiposObligatoriosOtorgados };
