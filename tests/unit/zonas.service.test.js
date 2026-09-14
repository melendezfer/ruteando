const { agruparEnZonas } = require('../../src/services/zonas.service');

const NOMBRES = new Map([
  [1, 'Arepas'],
  [2, 'Costura y sastrería'],
  [3, 'Jugos naturales'],
]);

describe('agruparEnZonas', () => {
  it('agrupa filas del mismo cluster_id en una zona, con conteo y centroide correctos', () => {
    const filas = [
      { categoria_id: 1, latitud: 4.61, longitud: -74.21, distancia_m: 100, cluster_id: 0 },
      { categoria_id: 2, latitud: 4.611, longitud: -74.211, distancia_m: 150, cluster_id: 0 },
      { categoria_id: 1, latitud: 4.609, longitud: -74.209, distancia_m: 50, cluster_id: 0 },
    ];

    const zonas = agruparEnZonas(filas, NOMBRES);

    expect(zonas).toHaveLength(1);
    expect(zonas[0]).toMatchObject({
      id: 0,
      businessCount: 3,
      categoryCount: 2, // "Arepas" (x2) y "Costura y sastrería" (x1)
      distanceMeters: 50, // el miembro MÁS cercano, no el promedio
    });
    // Centroide = promedio simple de lat/lng de los 3 miembros.
    expect(zonas[0].centerLatitude).toBeCloseTo((4.61 + 4.611 + 4.609) / 3, 10);
    expect(zonas[0].centerLongitude).toBeCloseTo((-74.21 + -74.211 + -74.209) / 3, 10);
  });

  it('ordena las categorías por conteo descendente dentro de cada zona', () => {
    const filas = [
      { categoria_id: 1, latitud: 4.61, longitud: -74.21, distancia_m: 10, cluster_id: 0 },
      { categoria_id: 1, latitud: 4.61, longitud: -74.21, distancia_m: 20, cluster_id: 0 },
      { categoria_id: 3, latitud: 4.61, longitud: -74.21, distancia_m: 30, cluster_id: 0 },
    ];

    const zonas = agruparEnZonas(filas, NOMBRES);

    expect(zonas[0].categories).toEqual([
      { categoryId: 1, categoryName: 'Arepas', count: 2 },
      { categoryId: 3, categoryName: 'Jugos naturales', count: 1 },
    ]);
  });

  it('descarta las filas con cluster_id null ("ruido" de DBSCAN) — no forman zona', () => {
    const filas = [
      { categoria_id: 1, latitud: 4.61, longitud: -74.21, distancia_m: 10, cluster_id: 0 },
      { categoria_id: 2, latitud: 4.62, longitud: -74.22, distancia_m: 500, cluster_id: null },
    ];

    const zonas = agruparEnZonas(filas, NOMBRES);

    expect(zonas).toHaveLength(1);
    expect(zonas[0].businessCount).toBe(1);
  });

  it('devuelve [] cuando ninguna fila tiene cluster_id (todo es ruido, sin zonas)', () => {
    const filas = [{ categoria_id: 1, latitud: 4.61, longitud: -74.21, distancia_m: 10, cluster_id: null }];
    expect(agruparEnZonas(filas, NOMBRES)).toEqual([]);
  });

  it('separa clusters distintos en zonas distintas y ordena el resultado por distancia ascendente', () => {
    const filas = [
      // cluster_id 5: la zona más LEJANA (distancia mínima 300).
      { categoria_id: 1, latitud: 4.61, longitud: -74.21, distancia_m: 300, cluster_id: 5 },
      { categoria_id: 2, latitud: 4.611, longitud: -74.211, distancia_m: 320, cluster_id: 5 },
      { categoria_id: 3, latitud: 4.612, longitud: -74.212, distancia_m: 310, cluster_id: 5 },
      // cluster_id 2: la zona más CERCANA (distancia mínima 40).
      { categoria_id: 1, latitud: 4.6, longitud: -74.2, distancia_m: 40, cluster_id: 2 },
      { categoria_id: 1, latitud: 4.601, longitud: -74.201, distancia_m: 45, cluster_id: 2 },
      { categoria_id: 2, latitud: 4.602, longitud: -74.202, distancia_m: 60, cluster_id: 2 },
    ];

    const zonas = agruparEnZonas(filas, NOMBRES);

    expect(zonas).toHaveLength(2);
    expect(zonas[0].id).toBe(2);
    expect(zonas[0].distanceMeters).toBe(40);
    expect(zonas[1].id).toBe(5);
    expect(zonas[1].distanceMeters).toBe(300);
  });

  it('categoryName queda null si el id no resuelve en el mapa (categoría borrada/desconocida)', () => {
    const filas = [
      { categoria_id: 999, latitud: 4.61, longitud: -74.21, distancia_m: 10, cluster_id: 0 },
      { categoria_id: 999, latitud: 4.61, longitud: -74.21, distancia_m: 20, cluster_id: 0 },
      { categoria_id: 999, latitud: 4.61, longitud: -74.21, distancia_m: 30, cluster_id: 0 },
    ];
    const zonas = agruparEnZonas(filas, new Map());
    expect(zonas[0].categories).toEqual([{ categoryId: 999, categoryName: null, count: 3 }]);
  });
});
