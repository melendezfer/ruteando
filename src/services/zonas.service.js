const negociosRepo = require('../repositories/negocios.repository');
const categoriasRepo = require('../repositories/categorias.repository');

/**
 * "Zonas de aglomeración" (ver CLAUDE.md sección 32) — agrupa las filas
 * crudas de negocios.repository.js#clusterizar (una por negocio, con el
 * cluster_id que le asignó ST_ClusterDBSCAN) en zonas: conteo, centroide
 * (promedio simple de lat/lng de los miembros — aproximación razonable a
 * esta escala, agrupaciones de ~200m, mismo criterio que el resto del
 * proyecto para distancias cortas) y el resumen de variedad que pide
 * GET /businesses/zones (sin RF asociado).
 *
 * Función pura (sin acceso a datos) a propósito — separada de
 * buscarCercanas() de abajo para poder probarla con filas de prueba
 * hechas a mano, sin mockear el repositorio ni tocar la base de datos
 * (mismo criterio que disponibilidad.service.js#estaAbiertoAhora o
 * business.mapper.js: la lógica pura se prueba con datos de prueba
 * directos; lo que sí toca la base solo se prueba contra una real, en
 * integración).
 *
 * Los negocios con cluster_id null ("ruido" para DBSCAN, sin suficientes
 * vecinos cerca) se descartan acá — no forman zona, siguen siendo pines
 * individuales en el mapa, pero no entran al resultado.
 */
function agruparEnZonas(filas, nombrePorCategoria) {
  const miembrosPorCluster = new Map();
  for (const fila of filas) {
    if (fila.cluster_id == null) continue;
    if (!miembrosPorCluster.has(fila.cluster_id)) {
      miembrosPorCluster.set(fila.cluster_id, []);
    }
    miembrosPorCluster.get(fila.cluster_id).push(fila);
  }

  const zonas = [];
  for (const [clusterId, miembros] of miembrosPorCluster) {
    const conteoPorCategoria = new Map();
    for (const miembro of miembros) {
      const actual = conteoPorCategoria.get(miembro.categoria_id) ?? 0;
      conteoPorCategoria.set(miembro.categoria_id, actual + 1);
    }

    const categories = [...conteoPorCategoria.entries()]
      .map(([categoryId, count]) => ({
        categoryId,
        categoryName: nombrePorCategoria.get(categoryId) ?? null,
        count,
      }))
      // Más presente primero — es lo que un consumidor esperaría ver
      // arriba al mirar "qué hay en esta zona".
      .sort((a, b) => b.count - a.count);

    zonas.push({
      id: clusterId,
      centerLatitude:
        miembros.reduce((suma, m) => suma + Number(m.latitud), 0) / miembros.length,
      centerLongitude:
        miembros.reduce((suma, m) => suma + Number(m.longitud), 0) / miembros.length,
      businessCount: miembros.length,
      categoryCount: categories.length,
      categories,
      // Distancia al miembro MÁS CERCANO de la zona (no al centroide) —
      // es la distancia real que alguien caminaría para llegar a esa
      // zona, el centroide en sí puede no tener ningún negocio.
      distanceMeters: Math.min(...miembros.map((m) => Number(m.distancia_m))),
    });
  }

  zonas.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return zonas;
}

async function buscarCercanas({ lat, lng, radiusKm }) {
  const filas = await negociosRepo.clusterizar({ lat, lng, radiusKm });
  const categorias = await categoriasRepo.listar();
  const nombrePorCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));

  return agruparEnZonas(filas, nombrePorCategoria);
}

module.exports = { buscarCercanas, agruparEnZonas };
