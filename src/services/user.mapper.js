// El enum rol_usuario de la base de datos está en español (Documento 07);
// el schema User de openapi.yaml usa inglés. Este es el único lugar que
// conoce ambos vocabularios — nunca mezclarlos en otro archivo.
const ROLE_DB_TO_API = {
  consumidor: 'consumer',
  vendedor: 'vendor',
  administrador: 'administrator',
};

const ROLE_API_TO_DB = {
  consumer: 'consumidor',
  vendor: 'vendedor',
  administrator: 'administrador',
};

function toApiUser(row) {
  return {
    id: row.id,
    fullName: row.nombre_completo,
    email: row.correo,
    phone: row.telefono,
    role: ROLE_DB_TO_API[row.rol],
    profilePhotoUrl: row.foto_perfil_url,
    createdAt: row.fecha_creacion,
    active: row.activo,
  };
}

module.exports = { ROLE_DB_TO_API, ROLE_API_TO_DB, toApiUser };
