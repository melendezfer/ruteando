/**
 * Épica 9 (RF-019/020): aprobar/rechazar negocios pendientes necesita un
 * valor de estado_negocio para "rechazado" que no existía (solo
 * pendiente|activo|suspendido|cerrado) — el borrador de openapi.yaml
 * anterior a esta épica reusaba 'cerrado', pero eso mezclaría "nunca se
 * aprobó" con "estuvo activo y se cerró después". Se agrega 'rechazado'
 * como valor nuevo del enum.
 *
 * motivo_rechazo (nullable) guarda el motivo que el administrador escribe
 * al rechazar (RF-020) — no es un detalle interno de log: es la única
 * forma de que el vendedor dueño del negocio sepa qué corregir antes de
 * volver a intentar (se expone en GET /businesses/{businessId}).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE estado_negocio ADD VALUE 'rechazado';
    ALTER TABLE negocios ADD COLUMN motivo_rechazo TEXT;
  `);
};

/**
 * ALTER TYPE ... ADD VALUE no se puede revertir dentro de una migración
 * (Postgres no soporta DROP VALUE en un enum) — down() queda documentado
 * como no reversible en vez de fingir un rollback que no existe.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = () => {
  throw new Error(
    "No reversible: Postgres no soporta remover un valor de un enum (ALTER TYPE ... DROP VALUE 'rechazado').",
  );
};
