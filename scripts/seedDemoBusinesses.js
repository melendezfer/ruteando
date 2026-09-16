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
 * entregaPropia mezclado a propósito (3 en true, 2 en false) — campo
 * nuevo sin RF asociado (ver CLAUDE.md, "Hace domicilios propios"): la
 * mezcla es lo que permite verificar a ojo, en el mismo mapa, que la
 * etiqueta del perfil público aparece para unos negocios y no para
 * otros, sin tener que sembrar datos aparte para probarlo.
 *
 * higieneAutodeclarada (sello de higiene autodeclarada, ver CLAUDE.md)
 * también mezclado (3 en true, 2 en false) y deliberadamente
 * independiente del patrón de entregaPropia — dos negocios llevan las
 * dos insignias a la vez (Arepas Doña Rosa, Empanadas El Fogón), uno
 * lleva solo el sello de higiene sin domicilios (Perros El Parche), y
 * los otros dos llevan como mucho una sola de las dos — así se puede
 * verificar a ojo que ambas insignias conviven en el mismo perfil sin
 * pisarse, y que cada una aparece/desaparece de forma independiente.
 *
 * Expansión de alcance (ver CLAUDE.md sección 31): además de los 5
 * negocios gastronómicos originales, se suman 3 negocios NO
 * gastronómicos — uno por cada categoría nueva sembrada por la
 * migración `categorias-tipo-comercio-no-gastronomico`
 * (`categoriaTipo`/`productos` en cada entrada de NEGOCIOS, ambos
 * opcionales y con default 'alimentos'/[] para no tener que tocar las 5
 * entradas de comida): una costurera (servicios, sin fotos en su
 * catálogo — demuestra que el catálogo de "Servicios" no fuerza foto) y
 * una asesoría legal básica (servicios), ambas con `entregaPropia`/
 * `higieneAutodeclarada` en false a propósito (ninguna de las dos
 * aplica a un servicio: no hay "domicilio del producto" ni "higiene en
 * la preparación de alimentos" que declarar), y una artesana (bienes,
 * con foto y precio en cada ítem, como pidió el usuario explícitamente
 * de ejemplo). Cada negocio nuevo lleva 2-3 ítems de catálogo propios
 * (`productos`, insertados directo en la tabla `productos` — y `fotos`
 * para los que llevan foto) para que la sección de contenido del perfil
 * (Menú/Productos/Servicios, catalog-label.ts) se pueda probar con datos
 * reales, no solo con el estado vacío.
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
 * "Zonas de aglomeración" (ver CLAUDE.md sección 32, sin RF asociado):
 * las distancias/rumbos de 4 negocios se REACOMODARON (no se tocaron sus
 * ids/slugs/categorías/fotos, solo su posición) para formar dos zonas
 * reales y claramente distintas — GET /businesses/zones usa
 * ST_ClusterDBSCAN con eps=200m/minpoints=3
 * (ZONE_RADIUS_METERS/ZONE_MIN_BUSINESSES en src/config/constants.js), y
 * las posiciones originales (repartidas en 5 rumbos distintos desde el
 * centro, pensadas para "Cerca de ti" y no para clustering) casi nunca
 * quedaban a menos de 200m entre sí:
 *
 * - **Zona norte (alta variedad, rumbo 0°, 150-250m)**: Costuras y
 *   Arreglos María (150m, sin cambios), Asesoría Legal Rápida (movida de
 *   200m@90° a 180m@0°), Artesanías Telar Andino (movida de 500m@180° a
 *   220m@0°) y Arepas Doña Rosa (250m, sin cambios) — 4 negocios a
 *   ≤100m entre sí, 4 categorías distintas (Arepas, Costura y
 *   sastrería, Servicios legales básicos, Artesanías).
 * - **Zona este (baja variedad, rumbo 90°, 300-350m)**: Salchipapas Doña
 *   Nury (nueva, misma categoría que Perros El Parche —
 *   "Perros calientes y salchipapas"), Jugos Frutti Verde (movida de
 *   1400m@270° a 320m@90°) y Perros El Parche (350m, sin cambios) — 3
 *   negocios a ≤50m entre sí, pero solo 2 categorías distintas (dos de
 *   los tres son el mismo rubro) — a propósito, para poder comparar
 *   contra la zona norte.
 * - Dulces La Abuela (900m@180°) y Empanadas El Fogón (3000m@160°)
 *   quedan sin cambios, deliberadamente aislados (sin suficientes
 *   vecinos cerca para formar zona) — siguen siendo pines individuales
 *   en el mapa, no todo negocio tiene por qué estar en una zona.
 *
 * Todas las distancias nuevas quedan por debajo del máximo ya verificado
 * por geocodificación inversa en el mismo rumbo (sección 25 de
 * CLAUDE.md: 0° seguro hasta 250m, 90° seguro hasta 350m) — un punto más
 * cerca del centro sobre un rayo ya confirmado dentro de Soacha no
 * necesita una nueva verificación (mismo criterio ya aplicado con las 3
 * categorías no gastronómicas, sección 31). Verificado además a mano con
 * `ST_ClusterDBSCAN` contra la base de desarrollo antes de escribir este
 * comentario — no solo calculado en teoría.
 *
 * `movilidad` (ambulante/local_fijo, ver CLAUDE.md — sin RF asociado):
 * los 5 negocios de comida quedan 'ambulante' (coherente con el público
 * objetivo original, Documento 08 "Don Alirio" — vendedor de comida
 * callejera) y los 3 no gastronómicos (Costuras, Asesoría Legal,
 * Artesanías) quedan 'local_fijo' (un taller/oficina/puesto de
 * artesanías es plausiblemente un punto fijo en la vida real, a
 * diferencia de un carrito de comida) — excepto Empanadas El Fogón,
 * marcado 'local_fijo' a propósito pese a ser comida: ya estaba
 * aislado del resto (3km, sin nada cerca con qué confundirse en el
 * mapa), así que es el punto más claro para comparar a ojo la forma
 * "gota" (fija) contra el "círculo con carrito" (ambulante) del resto,
 * sin depender de acercar el zoom para separar un cluster.
 *
 * Datos de demo completos, sin valores genéricos ni vacíos (petición
 * directa del usuario, sin RF asociado): hasta acá, los 6 negocios de
 * comida (Arepas, Perros, Salchipapas, Dulces, Jugos, Empanadas)
 * quedaban con 0 ítems de catálogo — solo los 3 no gastronómicos
 * (Costuras/Asesoría/Artesanías) tenían menú, y ninguno de los 9
 * negocios tenía `descripcion` en sus productos ni una
 * `direccion_referencia` específica (todos compartían el mismo texto
 * calculado "Cerca de Ciudad Verde, Soacha (~X m del centro)"). Se
 * agregó un menú real de 3-4 ítems a cada negocio de comida (recetas y
 * precios distintos incluso entre los dos de "Perros calientes y
 * salchipapas", que comparten categoría pero no catálogo — a propósito,
 * dos vendedores reales no tienen exactamente el mismo menú), una
 * `descripcion` a cada producto de los 9 negocios (antes ninguno la
 * tenía — mostraban "Este ítem todavía no tiene descripción"), y una
 * `direccionReferencia` propia por negocio (calle/carrera + un punto de
 * referencia plausible en Ciudad Verde) en vez del texto genérico. Sigue
 * habiendo una mezcla deliberada de `disponible: true/false` y de
 * productos con/sin foto en cada negocio — eso ya estaba bien pensado
 * desde antes (ver comentarios de `entregaPropia`/`higieneAutodeclarada`
 * arriba) y no hacía falta tocarlo.
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
    entregaPropia: true,
    higieneAutodeclarada: true,
    movilidad: 'ambulante',
    direccionReferencia: 'Carrera 38 con Calle 33, frente al parque de Ciudad Verde',
    productos: [
      {
        nombre: 'Arepa de queso',
        descripcion: 'Arepa asada en parrilla de carbón, rellena de queso campesino derretido.',
        precio: 4000,
        disponible: true,
        foto: true,
      },
      {
        nombre: 'Arepa de choclo con queso',
        descripcion: 'Arepa dulce de choclo tierno, con queso por dentro y por encima.',
        precio: 5000,
        disponible: true,
      },
      {
        nombre: 'Arepa boyacense',
        descripcion: 'Arepa dulce con queso, receta típica de la región boyacense.',
        precio: 4500,
        disponible: true,
      },
      {
        nombre: 'Arepa con chicharrón',
        descripcion: 'Arepa rellena de chicharrón crocante y queso derretido.',
        precio: 7000,
        disponible: false,
      },
    ],
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
    entregaPropia: false,
    higieneAutodeclarada: true,
    movilidad: 'ambulante',
    direccionReferencia: 'Calle 34 Sur, al lado de la cancha sintética',
    productos: [
      {
        nombre: 'Perro clásico',
        descripcion: 'Salchicha, papitas, salsas de la casa y queso rallado.',
        precio: 6000,
        disponible: true,
        foto: true,
      },
      {
        nombre: 'Perro especial',
        descripcion: 'Con todo: salchicha doble, tocineta, queso fundido y maíz tierno.',
        precio: 8500,
        disponible: true,
      },
      {
        nombre: 'Salchipapa sencilla',
        descripcion: 'Papas fritas con trozos de salchicha y salsas al gusto.',
        precio: 7000,
        disponible: true,
      },
      {
        nombre: 'Combo perro + salchipapa',
        descripcion: 'Un perro clásico más una salchipapa sencilla, para compartir.',
        precio: 12000,
        disponible: false,
      },
    ],
  },
  {
    // Nuevo, sin RF asociado (ver CLAUDE.md sección 32) — mismo rumbo y
    // categoría que Perros El Parche a propósito: completa la "zona
    // este" a 3 negocios mutuamente cercanos (eps=200m), pero repitiendo
    // categoría en vez de sumar una nueva, para que esa zona tenga
    // MENOS variedad que la "zona norte" y así se pueda demostrar la
    // comparación entre zonas.
    slug: 'salchipapas-dona-nury',
    nombre: 'Salchipapas Doña Nury',
    descripcion: 'Salchipapas y perros calientes, porciones grandes para compartir.',
    categoria: 'Perros calientes y salchipapas',
    correo: 'demo-salchipapas-dona-nury@ruteando.test',
    nombreDueno: 'Nury Esperanza Baquero',
    telefono: '3001110009',
    // Mismo rumbo que Perros El Parche/Jugos Frutti Verde (90°/este,
    // verificado a 350m), a ~20-50m de ambos.
    distanciaM: 300,
    rumbo: 90,
    cerradoHoy: false,
    entregaPropia: false,
    higieneAutodeclarada: false,
    movilidad: 'ambulante',
    direccionReferencia: 'Carrera 37 con Calle 34, frente al centro comercial',
    // Menú distinto al de Perros El Parche (misma categoría, pero cada
    // vendedora tiene sus propias recetas/precios) — a propósito, para
    // no repetir el mismo catálogo entre los dos negocios de la "zona
    // este" (ver CLAUDE.md sección 32).
    productos: [
      {
        nombre: 'Salchipapa sencilla',
        descripcion: 'Papa criolla frita con salchicha y salsas de la casa.',
        precio: 6500,
        disponible: true,
        foto: true,
      },
      {
        nombre: 'Salchipapa mixta',
        descripcion: 'Con carne desmechada, salchicha y tocineta.',
        precio: 9000,
        disponible: true,
      },
      {
        nombre: 'Perro caliente sencillo',
        descripcion: 'Salchicha, papitas y salsas clásicas.',
        precio: 5500,
        disponible: true,
      },
    ],
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
    entregaPropia: true,
    higieneAutodeclarada: false,
    movilidad: 'ambulante',
    direccionReferencia: 'Diagonal 40, cerca al colegio de Ciudad Verde',
    productos: [
      {
        nombre: 'Oblea sencilla',
        descripcion: 'Con arequipe y queso rallado.',
        precio: 3000,
        disponible: true,
        foto: true,
      },
      {
        nombre: 'Oblea especial',
        descripcion: 'Arequipe, queso, mermelada de mora y crema de leche.',
        precio: 6000,
        disponible: true,
      },
      {
        nombre: 'Cocadas (unidad)',
        descripcion: 'Cocada de coco rallado, receta de toda la vida.',
        precio: 2500,
        disponible: true,
      },
      {
        nombre: 'Brevas con arequipe (x3)',
        descripcion: 'Brevas caladas, rellenas de arequipe casero.',
        precio: 5000,
        disponible: false,
      },
    ],
  },
  {
    slug: 'jugos-frutti-verde',
    nombre: 'Jugos Frutti Verde',
    descripcion: 'Jugos naturales en agua o leche, fruta fresca del día.',
    categoria: 'Jugos naturales',
    correo: 'demo-jugos-frutti-verde@ruteando.test',
    nombreDueno: 'Marcela Pinzón',
    telefono: '3001110004',
    // Reacomodado para la "zona este" de baja variedad (ver CLAUDE.md
    // sección 32) — antes 1400m@270°(oeste), aislado; ahora sobre el
    // mismo rumbo que Perros El Parche (90°/este, verificado a 350m),
    // más cerca del centro (320m < 350m), a ~30m de Perros.
    distanciaM: 320,
    rumbo: 90,
    cerradoHoy: false,
    entregaPropia: false,
    higieneAutodeclarada: false,
    movilidad: 'ambulante',
    direccionReferencia: 'Carrera 37B, junto al supermercado',
    productos: [
      {
        nombre: 'Jugo de mora en agua',
        descripcion: 'Mora fresca licuada, sin conservantes.',
        precio: 4000,
        disponible: true,
        foto: true,
      },
      {
        nombre: 'Jugo de lulo en leche',
        descripcion: 'Lulo maduro con leche entera, bien frío.',
        precio: 5500,
        disponible: true,
      },
      {
        nombre: 'Jugo de mango biche',
        descripcion: 'Mango verde con limón y una pizca de sal.',
        precio: 4500,
        disponible: true,
      },
      {
        nombre: 'Limonada de coco',
        descripcion: 'Limonada natural con crema de coco.',
        precio: 6000,
        disponible: false,
      },
    ],
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
    entregaPropia: true,
    higieneAutodeclarada: true,
    // El único negocio de comida sembrado como 'local_fijo' (los demás
    // son 'ambulante', mismo criterio que el resto del seed — mezclado
    // a propósito, no todo uno u otro) — ya estaba aislado del resto
    // (3km, sin nada cerca con qué confundirse en el mapa), así que es
    // el punto más claro para ver a ojo la forma "gota" (fija) junto a
    // las "círculo con carrito" (ambulante) del resto.
    movilidad: 'local_fijo',
    direccionReferencia: 'Calle 24A Bis, barrio Camilo Torres II',
    productos: [
      {
        nombre: 'Empanada de carne',
        descripcion: 'Masa de maíz frita, rellena de carne guisada con papa.',
        precio: 2500,
        disponible: true,
        foto: true,
      },
      {
        nombre: 'Empanada de pollo',
        descripcion: 'Pollo desmechado guisado, masa dorada y crocante.',
        precio: 2500,
        disponible: true,
      },
      {
        nombre: 'Empanada mixta',
        descripcion: 'Carne y pollo en la misma empanada, para los indecisos.',
        precio: 3000,
        disponible: true,
      },
      {
        nombre: 'Empanada de papa (vegetariana)',
        descripcion: 'Rellena de papa criolla guisada con hogao.',
        precio: 2000,
        disponible: false,
      },
    ],
  },
  // --- Negocios NO gastronómicos (expansión de alcance, CLAUDE.md sección 31) ---
  {
    slug: 'costuras-arreglos-maria',
    nombre: 'Costuras y Arreglos María',
    descripcion: 'Arreglos de ropa, bastillas y confección a la medida, en el mismo barrio.',
    categoria: 'Costura y sastrería',
    categoriaTipo: 'servicios',
    correo: 'demo-costuras-arreglos-maria@ruteando.test',
    nombreDueno: 'María Elena Cárdenas',
    telefono: '3001110006',
    // Mismo rumbo que Arepas Doña Rosa (0°/norte, verificado dentro de
    // Ciudad Verde a 250 m) pero más cerca del centro (150 m < 250 m) —
    // un punto sobre un rayo ya verificado como seguro, sin necesitar
    // una nueva geocodificación inversa para esta distancia menor.
    distanciaM: 150,
    rumbo: 0,
    cerradoHoy: false,
    entregaPropia: false, // no aplica: es un servicio, no hay producto que entregar a domicilio
    higieneAutodeclarada: false, // no aplica: no es manejo de alimentos
    // Los 3 negocios no gastronómicos quedan como 'local_fijo' a
    // propósito (taller de costura, oficina de asesoría, puesto de
    // artesanías — los tres plausibles como un punto fijo en la vida
    // real, a diferencia de los de comida callejera) — mismo criterio
    // que entregaPropia/higieneAutodeclarada acá: "no aplica" tanto
    // como una elección real.
    movilidad: 'local_fijo',
    direccionReferencia: 'Carrera 38 #33-12, local 2',
    // Catálogo de "Servicios" (ver catalog-label.ts) — sin fotos a
    // propósito, para demostrar que el catálogo no fuerza una foto por
    // ítem cuando la categoría es de servicios.
    productos: [
      {
        nombre: 'Arreglo de bastilla o dobladillo',
        descripcion: 'Ajuste de largo en pantalones, faldas o vestidos, listo el mismo día.',
        precio: 8000,
        disponible: true,
      },
      {
        nombre: 'Ajuste de prenda (entalle)',
        descripcion: 'Entalle de camisas, pantalones o vestidos a tu medida exacta.',
        precio: 15000,
        disponible: true,
      },
      {
        nombre: 'Confección a la medida',
        descripcion: 'Prenda hecha desde cero, según tus medidas y el diseño que quieras.',
        precio: 60000,
        disponible: false,
      },
    ],
  },
  {
    slug: 'asesoria-legal-rapida',
    nombre: 'Asesoría Legal Rápida',
    descripcion: 'Consultas y trámites legales básicos, en lenguaje claro y sin tecnicismos.',
    categoria: 'Servicios legales básicos',
    categoriaTipo: 'servicios',
    correo: 'demo-asesoria-legal-rapida@ruteando.test',
    nombreDueno: 'Javier Andrés Suárez',
    telefono: '3001110007',
    // Reacomodado para la "zona norte" de alta variedad (ver CLAUDE.md
    // sección 32) — antes 200m@90°(este); ahora sobre el mismo rumbo que
    // Costuras y Arreglos María/Arepas Doña Rosa (0°/norte, verificado a
    // 250m), a ~30-100m de sus otros 3 miembros.
    distanciaM: 180,
    rumbo: 0,
    cerradoHoy: false,
    entregaPropia: false,
    higieneAutodeclarada: false,
    movilidad: 'local_fijo',
    direccionReferencia: 'Calle 33 con Carrera 38, segundo piso',
    productos: [
      {
        nombre: 'Consulta legal básica (30 min)',
        descripcion: 'Orientación inicial sobre tu caso, en lenguaje claro y sin tecnicismos.',
        precio: 25000,
        disponible: true,
      },
      {
        nombre: 'Redacción de derecho de petición',
        descripcion: 'Redacción y revisión de un derecho de petición formal.',
        precio: 40000,
        disponible: true,
      },
      {
        nombre: 'Revisión de contrato de arrendamiento',
        descripcion: 'Revisión de cláusulas antes de firmar, para evitar sorpresas.',
        precio: 35000,
        disponible: true,
      },
    ],
  },
  {
    slug: 'artesanias-telar-andino',
    nombre: 'Artesanías Telar Andino',
    descripcion: 'Mochilas, manillas y tejidos hechos a mano en telar tradicional.',
    categoria: 'Artesanías',
    categoriaTipo: 'productos',
    correo: 'demo-artesanias-telar-andino@ruteando.test',
    nombreDueno: 'Lucía Fernanda Quiroga',
    telefono: '3001110008',
    // Reacomodado para la "zona norte" de alta variedad (ver CLAUDE.md
    // sección 32) — antes 500m@180°(sur), aislado; ahora sobre el mismo
    // rumbo que Costuras y Arreglos María/Arepas Doña Rosa (0°/norte,
    // verificado a 250m), a ~30-70m de sus otros 3 miembros.
    distanciaM: 220,
    rumbo: 0,
    cerradoHoy: true,
    entregaPropia: false,
    higieneAutodeclarada: false,
    movilidad: 'local_fijo',
    direccionReferencia: 'Carrera 38, frente a la iglesia de Ciudad Verde',
    // Catálogo de "Productos" (ver catalog-label.ts) — con foto en cada
    // ítem, como pidió el usuario explícitamente de ejemplo ("productos
    // con foto y precio para un artesano").
    productos: [
      {
        nombre: 'Mochila tejida en telar',
        descripcion: 'Mochila wayúu tradicional, tejida a mano en telar vertical.',
        precio: 55000,
        disponible: true,
        foto: true,
      },
      {
        nombre: 'Manilla de macramé',
        descripcion: 'Manilla ajustable, tejida en hilo encerado de colores.',
        precio: 12000,
        disponible: true,
        foto: true,
      },
      {
        nombre: 'Cuadro decorativo tejido',
        descripcion: 'Tapiz decorativo con diseños andinos, ideal para pared.',
        precio: 38000,
        disponible: false,
        foto: true,
      },
    ],
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

    // `tipo` (ver migración categorias-tipo-comercio-no-gastronomico,
    // CLAUDE.md sección 31) se manda explícito en vez de confiar en el
    // default de la columna ('alimentos') — así este script sigue
    // etiquetando bien las categorías nuevas aunque algún día se corra
    // contra una base donde esa migración insertó la categoría de otra
    // forma (defensivo, no depende del orden migración->seed).
    const categoria = await pool.query(
      `INSERT INTO categorias (nombre, tipo) VALUES ($1, $2)
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo
       RETURNING id`,
      [n.categoria, n.categoriaTipo ?? 'alimentos'],
    );
    const categoriaId = categoria.rows[0].id;

    const negocio = await pool.query(
      `INSERT INTO negocios (usuario_id, categoria_id, nombre, descripcion, estado, telefono_contacto, telefono_verificado, entrega_propia, higiene_autodeclarada, movilidad)
       VALUES ($1, $2, $3, $4, 'activo', $5, true, $6, $7, $8)
       RETURNING id`,
      [
        usuarioId,
        categoriaId,
        n.nombre,
        n.descripcion,
        n.telefono,
        n.entregaPropia,
        n.higieneAutodeclarada,
        n.movilidad ?? 'ambulante',
      ],
    );
    const negocioId = negocio.rows[0].id;

    await pool.query(
      `INSERT INTO ubicaciones (negocio_id, tipo, direccion_referencia, punto, es_actual, mostrar_ubicacion_exacta)
       VALUES ($1, 'puesto', $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, true, true)`,
      [
        negocioId,
        // Referencia específica por negocio (no el genérico "~X m del
        // centro" de antes) — pedido explícito del usuario ("nada
        // genérico"): son solo texto libre mostrado al usuario, no
        // afectan la coordenada real (`punto`, ya verificada por rumbo/
        // distancia, ver comentario de cabecera) ni ninguna consulta.
        n.direccionReferencia ?? `Cerca de Ciudad Verde, Soacha (~${n.distanciaM} m del centro)`,
        punto.lng,
        punto.lat,
      ],
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

    // Ítems de catálogo (expansión de alcance, CLAUDE.md sección 31;
    // menús completos para los 6 negocios de comida agregados después —
    // ver CLAUDE.md, "datos de demo completos" — antes de eso, los 6
    // negocios gastronómicos originales no llevaban ningún ítem).
    // `productos` sigue siendo opcional en la forma del objeto (no todo
    // negocio necesita llevarlo), pero ya no hay ninguno en `NEGOCIOS`
    // sin su propio catálogo. `descripcion` (nueva) evita el estado
    // "Este ítem todavía no tiene descripción" que mostraba cada
    // producto sembrado hasta ahora. Cada ítem con `foto: true` suma
    // también una fila en `fotos` (tipo='producto'), mismo placeholder
    // externo que ya usa la foto de negocio de arriba, con una semilla
    // distinta por producto para que no sea la misma imagen repetida.
    for (const [indice, p] of (n.productos ?? []).entries()) {
      const producto = await pool.query(
        `INSERT INTO productos (negocio_id, nombre, descripcion, precio, disponible)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [negocioId, p.nombre, p.descripcion ?? null, p.precio, p.disponible],
      );
      const productoId = producto.rows[0].id;

      if (p.foto) {
        await pool.query(
          `INSERT INTO fotos (producto_id, tipo, url)
           VALUES ($1, 'producto', $2)`,
          [productoId, `https://picsum.photos/seed/${n.slug}-${indice}/600/600`],
        );
      }
    }

    resumen.push({
      nombre: n.nombre,
      categoria: n.categoria,
      categoriaTipo: n.categoriaTipo ?? 'alimentos',
      distanciaM: n.distanciaM,
      estadoAhora: n.cerradoHoy ? 'cerrado hoy' : 'abierto ahora',
      entregaPropia: n.entregaPropia,
      higieneAutodeclarada: n.higieneAutodeclarada,
      movilidad: n.movilidad ?? 'ambulante',
      catalogoItems: (n.productos ?? []).length,
      correo: n.correo,
      whatsapp: n.telefono,
    });
  }

  console.log('Actualizando estadísticas (ANALYZE)...');
  await pool.query('ANALYZE negocios, ubicaciones, horarios, fotos, productos, consentimientos');

  console.log('\n=== Negocios de demo sembrados (Ciudad Verde, Soacha) ===\n');
  for (const r of resumen) {
    console.log(
      `- ${r.nombre} [${r.categoria} · ${r.categoriaTipo}] — ~${r.distanciaM} m, ${r.estadoAhora}, ` +
        `${r.entregaPropia ? 'hace domicilios propios' : 'sin domicilios propios'}, ` +
        `${r.higieneAutodeclarada ? 'con sello de higiene' : 'sin sello de higiene'}, ` +
        `${r.movilidad === 'local_fijo' ? 'local fijo' : 'ambulante'}, ` +
        `${r.catalogoItems} ítem(s) de catálogo\n` +
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
