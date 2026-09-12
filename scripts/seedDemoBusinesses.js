#!/usr/bin/env node
/**
 * Siembra 5 negocios de comida callejera "de demostración" en Ciudad
 * Verde, Soacha, para poder ver el mapa poblado con datos realistas
 * durante desarrollo manual — a diferencia de scripts/seedLoadTest.js
 * (miles de filas sintéticas anónimas para medir rendimiento), este
 * script crea un puñado curado, con nombre/categoría/foto/WhatsApp
 * propios y distancias/estados deliberados, pensado para explorarse a
 * ojo en el mapa y no para benchmarking. Por eso es un script aparte en
 * vez de una extensión de seedLoadTest.js.
 *
 * Cada negocio tiene su propia cuenta de vendedor (no un dueño
 * compartido) con contraseña real (argon2, "password123") y los dos
 * consentimientos obligatorios ya otorgados, para poder iniciar sesión
 * como cualquiera de ellos y probar el lado del vendedor (verificación
 * de teléfono, interruptor de ubicación exacta, etc.) sin pasar por el
 * flujo de registro completo cada vez.
 *
 * telefono_verificado = true se fija directamente (se salta el flujo
 * real de OTP por SMS, a propósito — ver CLAUDE.md, verificación de
 * teléfono) porque sin esto ningún negocio aparece en
 * GET /businesses ni /businesses/nearby desde la Épica de verificación
 * de teléfono. mostrar_ubicacion_exacta = true también es deliberado:
 * así el mapa muestra la coordenada calculada tal cual, no la versión
 * redondeada a ~111 m de "zona aproximada" — para que las distancias
 * pedidas (200 m, 900 m, 3 km...) se puedan verificar a ojo.
 *
 * El horario de cada negocio se calcula respecto al día de HOY en hora
 * de Bogotá (momentoActualBogota, mismo helper que ya usa
 * disponibilidad.service.js): los negocios marcados "cerrado ahora"
 * quedan cerrados específicamente hoy (el resto de la semana con horario
 * normal 08:00–20:00), y los "abierto ahora" quedan 00:00–23:59 todos
 * los días — mismo truco que ya usa seedLoadTest.js para garantizar
 * "abierto ahora" sin depender de la hora exacta en que se corra el
 * script.
 *
 * Datos claramente de prueba, fáciles de borrar antes de un piloto real:
 *   node scripts/seedDemoBusinesses.js --clean
 *
 * Uso:
 *   NODE_ENV=development node scripts/seedDemoBusinesses.js [--clean]
 */
require('../src/config/env');
const argon2 = require('argon2');
const pool = require('../src/config/db');
const { momentoActualBogota } = require('../src/services/disponibilidad.service');
const { ORDEN_DIAS_DB } = require('../src/services/business.mapper');

// Bug real encontrado y corregido (ver CLAUDE.md, "Corrección del centro
// de siembra de demo"): (4.578, -74.217) es el centroide genérico del
// municipio completo de Soacha (cae en Ubaté/Comuna San Humberto, cerca
// de Cazucá/San Mateo), NO el barrio Ciudad Verde — verificado por
// geocodificación inversa (Nominatim/OSM) antes de corregirlo, no una
// suposición. Coordenada real de Ciudad Verde, verificada contra
// Wikipedia (4°36′06″N 74°12′53″O) y confirmada por geocodificación
// inversa como "Avenida Calle 33, Ciudad Verde, Comuna La Despensa,
// Soacha".
const CENTRO = { lat: 4.6083, lng: -74.2188 }; // Ciudad Verde, Soacha (barrio, no el municipio)
const CONTRASENA_DEMO = 'password123';
const TEXTO_VERSION_CONSENTIMIENTO = '1.0';

// Desplazamiento plano simple (suficiente a esta escala, <5 km): para un
// rumbo dado en grados (0 = norte, sentido horario) y una distancia en
// metros, calcula el punto destino a partir de CENTRO. 111320 m ≈ 1° de
// latitud; se corrige la longitud por cos(latitud) porque los meridianos
// se acercan entre sí al alejarse del ecuador.
function desplazar(distanciaM, rumboGrados) {
  const rad = (rumboGrados * Math.PI) / 180;
  const deltaLat = (distanciaM * Math.cos(rad)) / 111320;
  const deltaLng =
    (distanciaM * Math.sin(rad)) / (111320 * Math.cos((CENTRO.lat * Math.PI) / 180));
  return { lat: CENTRO.lat + deltaLat, lng: CENTRO.lng + deltaLng };
}

const { hoyDb } = momentoActualBogota();

const NEGOCIOS = [
  {
    slug: 'arepas-dona-rosa',
    nombre: "Arepas Doña Rosa",
    descripcion: 'Arepas de choclo y queso recién hechas en parrilla de carbón.',
    categoria: 'Arepas',
    correo: 'demo-arepas-dona-rosa@ruteando.test',
    nombreDueno: 'Rosa Delia Gómez',
    telefono: '3001110001',
    distanciaM: 250,
    rumbo: 0, // norte
    cerradoHoy: false,
  },
  {
    slug: 'perros-el-parche',
    nombre: 'Perros El Parche',
    descripcion: 'Perros calientes y salchipapas al estilo soachuno, con todas las salsas.',
    categoria: 'Perros calientes y salchipapas',
    correo: 'demo-perros-el-parche@ruteando.test',
    nombreDueno: 'Jhon Fredy Ruiz',
    telefono: '3001110002',
    distanciaM: 350,
    rumbo: 90, // este
    cerradoHoy: false,
  },
  {
    slug: 'dulces-la-abuela',
    nombre: 'Dulces La Abuela',
    descripcion: 'Obleas, cocadas y postres caseros de siempre.',
    categoria: 'Dulces y postres',
    correo: 'demo-dulces-la-abuela@ruteando.test',
    nombreDueno: 'Ana Lucía Torres',
    telefono: '3001110003',
    distanciaM: 900,
    rumbo: 180, // sur
    cerradoHoy: true,
  },
  {
    slug: 'jugos-frutti-verde',
    nombre: 'Jugos Frutti Verde',
    descripcion: 'Jugos naturales en agua o leche, fruta fresca del día.',
    categoria: 'Jugos naturales',
    correo: 'demo-jugos-frutti-verde@ruteando.test',
    nombreDueno: 'Marcela Pinzón',
    telefono: '3001110004',
    distanciaM: 1400,
    rumbo: 270, // oeste
    cerradoHoy: false,
  },
  {
    slug: 'empanadas-el-fogon',
    nombre: 'Empanadas El Fogón',
    descripcion: 'Empanadas de carne, pollo y mixtas, fritas al momento.',
    categoria: 'Empanadas',
    correo: 'demo-empanadas-el-fogon@ruteando.test',
    nombreDueno: 'Carlos Alberto Mesa',
    telefono: '3001110005',
    distanciaM: 3000,
    // 45° (noreste) cruzaba a Bosa (Bogotá D.C.) con el centro corregido
    // — verificado por geocodificación inversa antes de correr el reseed,
    // no algo que se hubiera notado a ojo en el mapa. Ciudad Verde limita
    // al oriente/noreste con Bosa (río Tunjuelo, quebrada Tibaníca, ver
    // CLAUDE.md), así que 3 km en esa dirección exacta ya no cae en
    // Soacha. 160° (sursureste) sí resuelve dentro de Soacha ("Comuna San
    // Humberto"), lejos del río/humedal que bordea el sur/suroccidente.
    rumbo: 160, // sursureste (evita Bosa, Bogotá — ver CLAUDE.md)
    cerradoHoy: true,
  },
];

async function limpiar() {
  const correos = NEGOCIOS.map((n) => n.correo);
  const usuarios = await pool.query('SELECT id FROM usuarios WHERE correo = ANY($1)', [correos]);
  const usuarioIds = usuarios.rows.map((r) => r.id);

  if (usuarioIds.length > 0) {
    // consentimientos.usuario_id es ON DELETE SET NULL (no cascade) —
    // hay que borrarlos explícitamente antes de borrar los usuarios, o
    // quedarían huérfanos con usuario_id = NULL en vez de desaparecer.
    await pool.query('DELETE FROM consentimientos WHERE usuario_id = ANY($1)', [usuarioIds]);
    // negocios sí cascadea a ubicaciones/horarios/fotos/productos/etc.
    await pool.query('DELETE FROM negocios WHERE usuario_id = ANY($1)', [usuarioIds]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarioIds]);
  }

  console.log(`Datos de demo eliminados (${usuarioIds.length} negocio(s)/cuenta(s)).`);
}

async function sembrar() {
  const contrasenaHash = await argon2.hash(CONTRASENA_DEMO);
  const resumen = [];

  for (const n of NEGOCIOS) {
    const punto = desplazar(n.distanciaM, n.rumbo);

    const usuario = await pool.query(
      `INSERT INTO usuarios (nombre_completo, correo, telefono, contrasena_hash, rol)
       VALUES ($1, $2, $3, $4, 'vendedor')
       ON CONFLICT (correo) DO UPDATE SET
         nombre_completo = EXCLUDED.nombre_completo,
         contrasena_hash = EXCLUDED.contrasena_hash
       RETURNING id`,
      [n.nombreDueno, n.correo, n.telefono, contrasenaHash],
    );
    const usuarioId = usuario.rows[0].id;

    // Ambos consentimientos obligatorios (RF-018), otorgados directamente
    // por SQL para no tener que pasar por /consents solo para poder
    // iniciar sesión sin que el ConsentRequiredModal bloquee al vendedor.
    await pool.query(
      `INSERT INTO consentimientos (usuario_id, tipo, texto_version)
       VALUES ($1, 'tratamiento_datos', $2), ($1, 'terminos_condiciones', $2)`,
      [usuarioId, TEXTO_VERSION_CONSENTIMIENTO],
    );

    const categoria = await pool.query(
      `INSERT INTO categorias (nombre) VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id`,
      [n.categoria],
    );
    const categoriaId = categoria.rows[0].id;

    const negocio = await pool.query(
      `INSERT INTO negocios (usuario_id, categoria_id, nombre, descripcion, estado, telefono_contacto, telefono_verificado)
       VALUES ($1, $2, $3, $4, 'activo', $5, true)
       RETURNING id`,
      [usuarioId, categoriaId, n.nombre, n.descripcion, n.telefono],
    );
    const negocioId = negocio.rows[0].id;

    await pool.query(
      `INSERT INTO ubicaciones (negocio_id, tipo, direccion_referencia, punto, es_actual, mostrar_ubicacion_exacta)
       VALUES ($1, 'puesto', $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, true, true)`,
      [negocioId, `Cerca de Ciudad Verde, Soacha (~${n.distanciaM} m del centro)`, punto.lng, punto.lat],
    );

    // Horario: hoy (hoyDb) según si el negocio debe verse "cerrado ahora";
    // el resto de la semana con horario normal para que no quede
    // eternamente cerrado ni eternamente abierto.
    const filasHorario = ORDEN_DIAS_DB.map((dia) => {
      if (dia === hoyDb && n.cerradoHoy) {
        return { dia, cerrado: true, apertura: null, cierre: null };
      }
      if (n.cerradoHoy) {
        return { dia, cerrado: false, apertura: '08:00', cierre: '20:00' };
      }
      // "abierto ahora" garantizado todos los días, mismo truco que seedLoadTest.js
      return { dia, cerrado: false, apertura: '00:00', cierre: '23:59' };
    });

    for (const f of filasHorario) {
      await pool.query(
        `INSERT INTO horarios (negocio_id, dia, hora_apertura, hora_cierre, cerrado)
         VALUES ($1, $2, $3, $4, $5)`,
        [negocioId, f.dia, f.apertura, f.cierre, f.cerrado],
      );
    }

    // Foto de relleno vía servicio externo de placeholders (evita tocar
    // el pipeline real de subida/compresión/S3, fuera del alcance de este
    // script).
    await pool.query(
      `INSERT INTO fotos (negocio_id, tipo, url)
       VALUES ($1, 'negocio', $2)`,
      [negocioId, `https://picsum.photos/seed/${n.slug}/900/600`],
    );

    resumen.push({
      nombre: n.nombre,
      categoria: n.categoria,
      distanciaM: n.distanciaM,
      estadoAhora: n.cerradoHoy ? 'cerrado hoy' : 'abierto ahora',
      correo: n.correo,
      whatsapp: n.telefono,
    });
  }

  console.log('Actualizando estadísticas (ANALYZE)...');
  await pool.query('ANALYZE negocios, ubicaciones, horarios, fotos, consentimientos');

  console.log('\n=== Negocios de demo sembrados (Ciudad Verde, Soacha) ===\n');
  for (const r of resumen) {
    console.log(
      `- ${r.nombre} [${r.categoria}] — ~${r.distanciaM} m, ${r.estadoAhora}\n` +
        `    login: ${r.correo} / ${CONTRASENA_DEMO}    WhatsApp: ${r.whatsapp}`,
    );
  }
  console.log(
    '\nDatos claramente de prueba (correos @ruteando.test) — para borrarlos:\n' +
      '  node scripts/seedDemoBusinesses.js --clean\n',
  );
}

async function main() {
  const args = process.argv.slice(2);
  const limpiarSolo = args.includes('--clean');

  if (limpiarSolo) {
    await limpiar();
  } else {
    await limpiar(); // idempotente: nunca duplica si se corre dos veces
    await sembrar();
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
