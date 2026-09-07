const { toApiUser, ROLE_API_TO_DB } = require('../../src/services/user.mapper');

describe('user.mapper', () => {
  it('convierte una fila de la base de datos (español) al contrato User (inglés)', () => {
    const row = {
      id: 'uuid-1',
      nombre_completo: 'Ana Prueba',
      correo: 'ana@example.com',
      telefono: '3001234567',
      rol: 'vendedor',
      foto_perfil_url: null,
      fecha_creacion: '2026-01-01T00:00:00.000Z',
      activo: true,
    };

    expect(toApiUser(row)).toEqual({
      id: 'uuid-1',
      fullName: 'Ana Prueba',
      email: 'ana@example.com',
      phone: '3001234567',
      role: 'vendor',
      profilePhotoUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      active: true,
    });
  });

  it('mapea los tres roles de registro permitidos de inglés a español', () => {
    expect(ROLE_API_TO_DB.consumer).toBe('consumidor');
    expect(ROLE_API_TO_DB.vendor).toBe('vendedor');
    expect(ROLE_API_TO_DB.administrator).toBe('administrador');
  });
});
