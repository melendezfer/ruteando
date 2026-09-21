const {
  toApiBusiness,
  toApiLocation,
  toApiScheduleDay,
  toApiBusinessProfile,
  toApiReview,
  toApiReviewFeedback,
  aproximarCoordenada,
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
      telefono_verificado: true,
      entrega_propia: true,
      higiene_autodeclarada: true,
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
      phoneVerified: true,
      ownDelivery: true,
      hygieneSelfDeclared: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      latitude: null,
      longitude: null,
      distanceMeters: null,
      matchType: null,
      matchedProducts: null,
      matchedCategory: null,
      matchedOfferType: null,
      rejectionReason: null,
      availabilityConfirmedAt: null,
    });
  });

  it('availabilityConfirmedAt viaja cuando la fila trae disponibilidad_confirmada_en (listar/cercanos con LEFT JOIN LATERAL fresco)', () => {
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
      disponibilidad_confirmada_en: '2026-01-01T12:00:00.000Z',
    };

    expect(toApiBusiness(row).availabilityConfirmedAt).toBe('2026-01-01T12:00:00.000Z');
  });

  it('embebe latitude/longitude/distanceMeters exactos cuando la fila viene de un join con mostrar_ubicacion_exacta=true (listar/cercanos)', () => {
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
      mostrar_ubicacion_exacta: true,
    };

    const resultado = toApiBusiness(row);

    expect(resultado.latitude).toBe(4.5789);
    expect(resultado.longitude).toBe(-74.217);
    expect(resultado.distanceMeters).toBe(532.108);
  });

  it('"zona aproximada" (default, mostrar_ubicacion_exacta false/ausente): redondea latitude/longitude, nunca distanceMeters', () => {
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
      latitud: '4.578912',
      longitud: '-74.216543',
      distancia_m: '532.108',
      // mostrar_ubicacion_exacta ausente a propósito — así queda
      // undefined, igual que una fila que nunca hizo join con
      // ubicaciones (crear/obtener/actualizar/cerrar).
    };

    const resultado = toApiBusiness(row);

    expect(resultado.latitude).toBe(4.579);
    expect(resultado.longitude).toBe(-74.217);
    // La distancia real de la búsqueda nunca se aproxima — solo el pin.
    expect(resultado.distanceMeters).toBe(532.108);
  });

  // Búsqueda por texto (RF-010/011): distinguir por qué coincidió un
  // negocio con `q` (sin RF asociado — ver CLAUDE.md). `nombre_coincide`
  // y `productos_coincidentes` son lo que negocios.repository.js#listar/
  // cercanos calculan vía columnaNombreCoincide()/
  // lateralProductosCoincidentes() cuando hubo `q`.
  describe('matchType / matchedProducts (búsqueda por texto)', () => {
    const filaBase = {
      id: 'b-1',
      usuario_id: 'u-1',
      categoria_id: 2,
      nombre: 'Arepas Doña Rosa',
      descripcion: null,
      estado: 'activo',
      telefono_contacto: null,
      fecha_creacion: '2026-01-01T00:00:00.000Z',
      fecha_actualizacion: '2026-01-01T00:00:00.000Z',
    };

    it('sin búsqueda de texto (nombre_coincide ausente): matchType y matchedProducts quedan null', () => {
      const resultado = toApiBusiness(filaBase);
      expect(resultado.matchType).toBeNull();
      expect(resultado.matchedProducts).toBeNull();
    });

    it('coincidió solo por el nombre del negocio: matchType="business_name", sin productos', () => {
      const resultado = toApiBusiness({
        ...filaBase,
        nombre_coincide: true,
        productos_coincidentes: null,
      });
      expect(resultado.matchType).toBe('business_name');
      expect(resultado.matchedProducts).toBeNull();
    });

    it('coincidió solo por un producto: matchType="product", con el/los producto(s)', () => {
      const resultado = toApiBusiness({
        ...filaBase,
        nombre_coincide: false,
        productos_coincidentes: [
          { nombre: 'Arepa de queso', precio: '5000.00', disponible: true },
        ],
      });
      expect(resultado.matchType).toBe('product');
      expect(resultado.matchedProducts).toEqual([
        { name: 'Arepa de queso', price: 5000, available: true },
      ]);
    });

    it('coincidió por el nombre del negocio Y por un producto: matchType="both"', () => {
      const resultado = toApiBusiness({
        ...filaBase,
        nombre_coincide: true,
        productos_coincidentes: [
          { nombre: 'Arepa de queso', precio: '5000.00', disponible: true },
          { nombre: 'Arepa con todo', precio: '7000.00', disponible: false },
        ],
      });
      expect(resultado.matchType).toBe('both');
      expect(resultado.matchedProducts).toEqual([
        { name: 'Arepa de queso', price: 5000, available: true },
        { name: 'Arepa con todo', price: 7000, available: false },
      ]);
    });

    // Fase 5 (búsqueda por familia, sección 50): hubo `q` pero el
    // negocio no calificó ni por nombre ni por producto — antes de esta
    // fase esta combinación nunca ocurría de verdad (la única forma de
    // calificar con `q` era nombre o producto), así que el bug latente
    // (caía en 'product' por el `else` implícito) nunca se manifestaba.
    it('hubo q pero ni el nombre ni un producto coincidieron (calificó por categoría): matchType queda null, no "product"', () => {
      const resultado = toApiBusiness({
        ...filaBase,
        nombre_coincide: false,
        productos_coincidentes: null,
      });
      expect(resultado.matchType).toBeNull();
      expect(resultado.matchedProducts).toBeNull();
    });
  });

  // Búsqueda por familia (Fase 5, sin RF asociado — ver CLAUDE.md sección
  // 50): `categoria_coincide` es independiente de matchType — un negocio
  // puede coincidir por categoría Y por nombre/producto a la vez.
  describe('matchedCategory (búsqueda por familia)', () => {
    const filaBase = {
      id: 'b-1',
      usuario_id: 'u-1',
      categoria_id: 2,
      nombre: 'Farmacia Central',
      descripcion: null,
      estado: 'activo',
      telefono_contacto: null,
      fecha_creacion: '2026-01-01T00:00:00.000Z',
      fecha_actualizacion: '2026-01-01T00:00:00.000Z',
    };

    it('sin búsqueda de texto: matchedCategory queda null', () => {
      expect(toApiBusiness(filaBase).matchedCategory).toBeNull();
    });

    it('coincidió por categoría (nombre literal o alias), no por nombre ni producto', () => {
      const resultado = toApiBusiness({
        ...filaBase,
        nombre_coincide: false,
        productos_coincidentes: null,
        categoria_coincide: true,
      });
      expect(resultado.matchedCategory).toBe(true);
      expect(resultado.matchType).toBeNull();
    });

    it('coincidió por categoría Y por nombre a la vez — las dos señales conviven', () => {
      const resultado = toApiBusiness({
        ...filaBase,
        nombre_coincide: true,
        productos_coincidentes: null,
        categoria_coincide: true,
      });
      expect(resultado.matchedCategory).toBe(true);
      expect(resultado.matchType).toBe('business_name');
    });

    it('hubo q pero la categoría no coincidió: matchedCategory=false', () => {
      const resultado = toApiBusiness({
        ...filaBase,
        nombre_coincide: true,
        productos_coincidentes: null,
        categoria_coincide: false,
      });
      expect(resultado.matchedCategory).toBe(false);
    });
  });
});

describe('toApiLocation', () => {
  const row = {
    id: 'l-1',
    negocio_id: 'b-1',
    tipo: 'puesto',
    direccion_referencia: 'Frente al parque',
    latitud: 4.578912,
    longitud: -74.216543,
    es_actual: true,
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    mostrar_ubicacion_exacta: false,
  };

  it('"zona aproximada" (mostrar_ubicacion_exacta=false) redondea la coordenada para un pedido sin dueño', () => {
    expect(toApiLocation(row)).toEqual({
      id: 'l-1',
      businessId: 'b-1',
      type: 'stall',
      referenceAddress: 'Frente al parque',
      latitude: 4.579,
      longitude: -74.217,
      isCurrent: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      showExactLocation: false,
    });
  });

  it('requesterIsOwner: true muestra la coordenada real sin importar mostrar_ubicacion_exacta', () => {
    const resultado = toApiLocation(row, { requesterIsOwner: true });
    expect(resultado.latitude).toBe(4.578912);
    expect(resultado.longitude).toBe(-74.216543);
    // El interruptor en sí se sigue informando tal cual está guardado —
    // "el dueño ve exacto" no es lo mismo que "el negocio eligió exacto".
    expect(resultado.showExactLocation).toBe(false);
  });

  it('mostrar_ubicacion_exacta=true expone la coordenada real incluso sin dueño', () => {
    const filaExacta = { ...row, mostrar_ubicacion_exacta: true };
    const resultado = toApiLocation(filaExacta);
    expect(resultado.latitude).toBe(4.578912);
    expect(resultado.longitude).toBe(-74.216543);
    expect(resultado.showExactLocation).toBe(true);
  });
});

describe('aproximarCoordenada', () => {
  it('redondea a 3 decimales (~111m)', () => {
    expect(aproximarCoordenada(4.578912)).toBe(4.579);
    expect(aproximarCoordenada(-74.216543)).toBe(-74.217);
  });

  it('es estable (idempotente) y no cambia un valor ya redondeado', () => {
    expect(aproximarCoordenada(4.579)).toBe(4.579);
  });

  it('deja pasar null tal cual (sin ubicación registrada)', () => {
    expect(aproximarCoordenada(null)).toBeNull();
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
  it('mapea una fila de resenas (español) al contrato Review (inglés), incluida la retroalimentación privada', () => {
    const row = {
      id: 'r-1',
      negocio_id: 'b-1',
      usuario_id: 'u-1',
      calificacion: 4,
      etiquetas: ['buen_precio', 'espera_larga'],
      comentario_privado: 'Muy bueno, pero esperé un rato',
      estado_moderacion: 'pendiente',
      fecha_creacion: '2026-01-01T00:00:00.000Z',
    };

    expect(toApiReview(row)).toEqual({
      id: 'r-1',
      businessId: 'b-1',
      userId: 'u-1',
      rating: 4,
      tags: ['good_price', 'long_wait'],
      privateComment: 'Muy bueno, pero esperé un rato',
      moderationStatus: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('mapea etiquetas vacías/ausentes como []', () => {
    const row = {
      id: 'r-1',
      negocio_id: 'b-1',
      usuario_id: 'u-1',
      calificacion: 5,
      comentario_privado: null,
      estado_moderacion: 'pendiente',
      fecha_creacion: '2026-01-01T00:00:00.000Z',
    };
    expect(toApiReview(row).tags).toEqual([]);
  });

  it('mapea los 3 estados de moderación', () => {
    const base = {
      id: 'r-1',
      negocio_id: 'b-1',
      usuario_id: 'u-1',
      calificacion: 5,
      comentario_privado: null,
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

describe('toApiReviewFeedback', () => {
  it('mapea sin userId ni businessId — anonimizado a propósito', () => {
    const row = {
      id: 'r-1',
      negocio_id: 'b-1',
      usuario_id: 'u-1',
      calificacion: 3,
      etiquetas: ['comida_fria'],
      comentario_privado: 'Llegó tibia',
      estado_moderacion: 'aprobada',
      fecha_creacion: '2026-01-01T00:00:00.000Z',
    };

    expect(toApiReviewFeedback(row)).toEqual({
      id: 'r-1',
      rating: 3,
      tags: ['cold_food'],
      privateComment: 'Llegó tibia',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
