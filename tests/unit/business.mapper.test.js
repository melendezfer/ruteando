const {
  toApiBusiness,
  toApiLocation,
  toApiScheduleDay,
  toApiBusinessProfile,
  toApiReview,
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
      latitude: null,
      longitude: null,
      distanceMeters: null,
    });
  });

  it('embebe latitude/longitude/distanceMeters cuando la fila viene de una consulta con join de ubicación (listar/cercanos)', () => {
    const row = {
      id: 'b-1',
      usuario_id: 'u-1',
      categoria_id: 2,
      nombre: 'Salchipapas Doña Ana',
      descripcion: null,
      estado: 'activo',
      telefono_contacto: null,
      fecha_creacion: '2026-01-01T00:00:00.000Z',
      fecha_actualizacion: '2026-01-01T00:00:00.000Z',
      latitud: '4.5789',
      longitud: '-74.217',
      distancia_m: '532.108',
    };

    const resultado = toApiBusiness(row);

    expect(resultado.latitude).toBe(4.5789);
    expect(resultado.longitude).toBe(-74.217);
    expect(resultado.distanceMeters).toBe(532.108);
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

describe('toApiBusinessProfile', () => {
  const negocio = {
    id: 'b-1',
    usuario_id: 'u-1',
    categoria_id: 2,
    nombre: 'Salchipapas Doña Ana',
    descripcion: null,
    estado: 'activo',
    telefono_contacto: '3001112233',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    fecha_actualizacion: '2026-01-01T00:00:00.000Z',
  };

  it('compone Business + ubicación/horario/menú/fotos/reseñas, con location null cuando no hay ubicación', () => {
    const resultado = toApiBusinessProfile({
      negocio,
      ubicacion: null,
      horario: [],
      productos: [],
      fotos: [],
      agregadoResenas: { promedio: null, total: 0 },
    });

    expect(resultado).toMatchObject({ id: 'b-1', name: 'Salchipapas Doña Ana' });
    expect(resultado.location).toBeNull();
    expect(resultado.schedule).toEqual([]);
    expect(resultado.products).toEqual([]);
    expect(resultado.photos).toEqual([]);
    expect(resultado.averageRating).toBeNull();
    expect(resultado.reviewCount).toBe(0);
  });

  it('mapea location/schedule/products/photos cuando sí existen', () => {
    const ubicacion = {
      id: 'l-1',
      negocio_id: 'b-1',
      tipo: 'puesto',
      direccion_referencia: null,
      latitud: 4.5789,
      longitud: -74.217,
      es_actual: true,
      fecha_creacion: '2026-01-01T00:00:00.000Z',
    };
    const horario = [
      { dia: 'lunes', hora_apertura: '08:00:00', hora_cierre: '18:00:00', cerrado: false },
    ];
    const productos = [
      {
        id: 'p-1',
        negocio_id: 'b-1',
        categoria_id: null,
        nombre: 'Salchipapa',
        descripcion: null,
        precio: '5000.00',
        disponible: true,
        fecha_creacion: '2026-01-01T00:00:00.000Z',
      },
    ];
    const fotos = [
      {
        id: 'f-1',
        negocio_id: 'b-1',
        producto_id: null,
        tipo: 'negocio',
        url: 'https://example.com/f-1.jpg',
        orden_visualizacion: 0,
        fecha_creacion: '2026-01-01T00:00:00.000Z',
      },
    ];

    const resultado = toApiBusinessProfile({
      negocio,
      ubicacion,
      horario,
      productos,
      fotos,
      agregadoResenas: { promedio: 4.5, total: 3 },
    });

    expect(resultado.location).toMatchObject({ id: 'l-1', type: 'stall' });
    expect(resultado.schedule).toEqual([
      { day: 'monday', openTime: '08:00', closeTime: '18:00', closed: false },
    ]);
    expect(resultado.products).toMatchObject([{ id: 'p-1', name: 'Salchipapa', price: 5000 }]);
    expect(resultado.photos).toMatchObject([{ id: 'f-1', type: 'business' }]);
    expect(resultado.averageRating).toBe(4.5);
    expect(resultado.reviewCount).toBe(3);
  });
});

describe('toApiReview', () => {
  it('mapea una fila de resenas (español) al contrato Review (inglés)', () => {
    const row = {
      id: 'r-1',
      negocio_id: 'b-1',
      usuario_id: 'u-1',
      calificacion: 4,
      comentario: 'Muy bueno',
      estado_moderacion: 'pendiente',
      fecha_creacion: '2026-01-01T00:00:00.000Z',
    };

    expect(toApiReview(row)).toEqual({
      id: 'r-1',
      businessId: 'b-1',
      userId: 'u-1',
      rating: 4,
      comment: 'Muy bueno',
      moderationStatus: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('mapea los 3 estados de moderación', () => {
    const base = {
      id: 'r-1',
      negocio_id: 'b-1',
      usuario_id: 'u-1',
      calificacion: 5,
      comentario: null,
      fecha_creacion: '2026-01-01T00:00:00.000Z',
    };
    expect(toApiReview({ ...base, estado_moderacion: 'pendiente' }).moderationStatus).toBe(
      'pending',
    );
    expect(toApiReview({ ...base, estado_moderacion: 'aprobada' }).moderationStatus).toBe(
      'approved',
    );
    expect(toApiReview({ ...base, estado_moderacion: 'rechazada' }).moderationStatus).toBe(
      'rejected',
    );
  });
});
