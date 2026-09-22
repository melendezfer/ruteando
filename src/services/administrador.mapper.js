// El enum rol_administrador de la base de datos está en español; el
// vocabulario de la API usa inglés — mismo criterio que user.mapper.js
// con `rol_usuario`. Deliberadamente DISTINTO del vocabulario de ese
// archivo ('administrator', para usuarios.rol): 'admin'/'super_admin'
// no debe poder confundirse nunca con el rol 'administrator' del
// sistema de usuarios normales (Épica 9, /admin/*) — son dos conceptos
// separados a propósito (ver la migración panel-admin-base), y usar el
// mismo string para los dos habría sido la clase de ambigüedad que este
// archivo existe para evitar.
const ADMIN_ROLE_DB_TO_API = {
  administrador: 'admin',
  administrador_maestro: 'super_admin',
};

const ADMIN_ROLE_API_TO_DB = {
  admin: 'administrador',
  super_admin: 'administrador_maestro',
};

function toApiAdministrator(row) {
  return {
    id: row.id,
    fullName: row.nombre_completo,
    email: row.correo,
    role: ADMIN_ROLE_DB_TO_API[row.rol],
    createdAt: row.fecha_creacion,
    active: row.activo,
  };
}

module.exports = { ADMIN_ROLE_DB_TO_API, ADMIN_ROLE_API_TO_DB, toApiAdministrator };
