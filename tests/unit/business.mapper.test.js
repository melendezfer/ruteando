const {
  toApiBusiness,
  toApiLocation,
  toApiScheduleDay,
  LOCATION_TYPE_API_TO_DB,
  DAY_API_TO_DB,
} = require('../../src/services/business.mapper');

describe('toApiBusiness', () => {
  it('mapea una fila de negocios (español) al contrato Business (inglés)', () => {
    const row = {
      id: 'b-1',
      usuario_id: 'u-1',
      categoria_id: 2,
      nombre: 'Salchipapas Doña Ana',
      descripcion: 'Las mejores del barrio',
      estado: 'pendiente',
      telefono_contacto: '3001112233',
      fecha_creacion: '2026-01-01T00:00:00.000Z',
      fecha_actualizacion: '2026-01-02T00:00:00.000Z',
    };

    expect(toApiBusiness(row)).toEqual({
      id: 'b-1',
      ownerId: 'u-1',
      categoryId: 2,
      name: 'Salchipapas Doña Ana',
      description: 'Las mejores del barrio',
      status: 'pending',
      contactPhone: '3001112233',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });
});

describe('toApiLocation', () => {
  it('mapea tipo, coordenadas y es_actual -> isCurrent', () => {
    const row = {
      id: 'l-1',
      negocio_id: 'b-1',
      tipo: 'puesto',
      direccion_referencia: 'Frente al parque',
      latitud: 4.5789,
      longitud: -74.217,
      es_actual: true,
      fecha_creacion: '2026-01-01T00:00:00.000Z',
    };

    expect(toApiLocation(row)).toEqual({
      id: 'l-1',
      businessId: 'b-1',
      type: 'stall',
      referenceAddress: 'Frente al parque',
      latitude: 4.5789,
      longitude: -74.217,
      isCurrent: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('toApiScheduleDay', () => {
  it('trunca los segundos que devuelve pg (HH:MM:SS -> HH:MM)', () => {
    const row = {
      dia: 'lunes',
      hora_apertura: '08:00:00',
      hora_cierre: '18:00:00',
      cerrado: false,
    };
    expect(toApiScheduleDay(row)).toEqual({
      day: 'monday',
      openTime: '08:00',
      closeTime: '18:00',
      closed: false,
    });
  });

  it('deja pasar null en horas cuando el día está cerrado', () => {
    const row = { dia: 'domingo', hora_apertura: null, hora_cierre: null, cerrado: true };
    expect(toApiScheduleDay(row)).toEqual({
      day: 'sunday',
      openTime: null,
      closeTime: null,
      closed: true,
    });
  });
});

describe('mapeos inversos (API -> DB)', () => {
  it('LOCATION_TYPE_API_TO_DB cubre los 6 tipos de ubicación', () => {
    expect(LOCATION_TYPE_API_TO_DB).toEqual({
      fixed: 'fija',
      mobile: 'movil',
      stall: 'puesto',
      storefront: 'local',
      home: 'desde_casa',
      temporary: 'temporal',
    });
  });

  it('DAY_API_TO_DB cubre los 7 días', () => {
    expect(Object.keys(DAY_API_TO_DB)).toHaveLength(7);
    expect(DAY_API_TO_DB.monday).toBe('lunes');
    expect(DAY_API_TO_DB.sunday).toBe('domingo');
  });
});
