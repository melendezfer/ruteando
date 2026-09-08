// Prueba de carga de GET /businesses/nearby (RF-009/010/011, Épica 4 —
// ver CLAUDE.md sección 6). Correr con k6 (https://k6.io) contra un
// servidor con datos sembrados por scripts/seedLoadTest.js — sin eso,
// la prueba mide contra una tabla casi vacía y el resultado no dice nada
// real.
//
//   npm run seed:loadtest
//   npm run dev   (en otra terminal)
//   npm run loadtest
//
// O con Docker, si no tienes k6 instalado:
//   docker run --rm -i --network host \
//     -v "$(pwd)/scripts:/scripts" grafana/k6 run /scripts/loadtest-nearby.js
//
// Umbrales (thresholds): SON UN SUPUESTO MÍO, no un requisito citado de
// ningún documento — no hay un RNF de rendimiento documentado en este
// repositorio para este endpoint. Ajustar si aparece un número real.
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Centro de Ciudad Verde, Soacha — mismo punto que usa scripts/seedLoadTest.js.
const CENTRO = { lat: 4.578, lng: -74.217 };

export const options = {
  scenarios: {
    busqueda_cercania: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 50 }, // sube a 50 usuarios concurrentes
        { duration: '30s', target: 50 }, // sostiene
        { duration: '10s', target: 0 }, // baja
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

// Variación pequeña alrededor del centro — simula usuarios repartidos
// por el barrio, no todos exactamente en el mismo punto (que además
// dejaría cachear el mismo plan de ejecución de forma poco realista).
function puntoAleatorioCercaDelCentro() {
  return {
    lat: CENTRO.lat + (Math.random() - 0.5) * 0.02,
    lng: CENTRO.lng + (Math.random() - 0.5) * 0.02,
  };
}

const ESCENARIOS_DE_FILTRO = [
  () => '',
  () => '&openNow=true',
  () => '&priceMin=1000&priceMax=10000',
  () => '&q=Producto',
];

export default function () {
  const { lat, lng } = puntoAleatorioCercaDelCentro();
  const filtro = ESCENARIOS_DE_FILTRO[Math.floor(Math.random() * ESCENARIOS_DE_FILTRO.length)]();
  const url = `${BASE_URL}/businesses/nearby?lat=${lat}&lng=${lng}&radiusKm=2&limit=20${filtro}`;

  const res = http.get(url);

  check(res, {
    'status es 200': (r) => r.status === 200,
    'body tiene data[]': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).data);
      } catch {
        return false;
      }
    },
  });
}
