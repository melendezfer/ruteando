const pool = require('../config/db');

/**
 * Todo o nada: usuario + negocio + consentimiento registro_asistido +
 * código de reclamo en una sola transacción (mismo patrón que
 * fotos.repository.js#crearConOrdenSiguiente) — si algo falla a mitad de
 * camino, no debe quedar un vendedor sin negocio, o un negocio sin
 * consentimiento, o un código de reclamo para un usuario que en realidad
 * no llegó a crearse.
 *
 * contrasena_establecida_en se deja fuera del INSERT a propósito (queda
 * NULL, el comportamiento por defecto de la columna) — es la señal que
 * usa reemitirTokenReclamo() para saber que esta cuenta todavía no fue
 * reclamada (ver migración usuarios-registro-asistido).
 */
async function crearVendedorNegocioYConsentimiento({
  nombreCompleto,
  correo,
  telefono,
  contrasenaHash,
  categoriaId,
  nombreNegocio,
  descripcionNegocio,
  telefonoContacto,
  textoVersion,
  codigoHash,
  expiraEn,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: usuarioRows } = await client.query(
      `INSERT INTO usuarios (nombre_completo, correo, telefono, contrasena_hash, rol)
       VALUES ($1, $2, $3, $4, 'vendedor')
       RETURNING *`,
      [nombreCompleto, correo ?? null, telefono ?? null, contrasenaHash],
    );
    const usuario = usuarioRows[0];

    const { rows: negocioRows } = await client.query(
      `INSERT INTO negocios (usuario_id, categoria_id, nombre, descripcion, telefono_contacto)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        usuario.id,
        categoriaId,
        nombreNegocio,
        descripcionNegocio ?? null,
        telefonoContacto ?? null,
      ],
    );
    const negocio = negocioRows[0];

    await client.query(
      `INSERT INTO consentimientos (usuario_id, negocio_id, tipo, otorgado_por_terceros, texto_version)
       VALUES ($1, $2, 'registro_asistido', true, $3)`,
      [usuario.id, negocio.id, textoVersion],
    );

    await client.query(
      `INSERT INTO codigos_recuperacion (usuario_id, codigo_hash, expira_en)
       VALUES ($1, $2, $3)`,
      [usuario.id, codigoHash, expiraEn],
    );

    await client.query('COMMIT');
    return { usuario, negocio };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { crearVendedorNegocioYConsentimiento };
