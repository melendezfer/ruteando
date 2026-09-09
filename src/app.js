const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./config/logger');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Render y Railway terminan TLS y reenvían a través de un único proxy
// inverso hasta el contenedor — confiar en "1 hop" (no en `true`, que
// confiaría en cualquier cantidad de saltos y permitiría spoofear
// X-Forwarded-For) hace que req.ip sea la IP real del cliente. Sin esto,
// req.ip sería siempre la IP del proxy y cualquier límite por IP (ver
// reporteNegocio.service.js) sería global en vez de por cliente.
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(pinoHttp({ logger }));

// CORS_ORIGIN ya se validaba como obligatoria en env.js desde la Épica 1,
// pero nunca se aplicaba — sin este middleware, cualquier frontend real
// (Épica F1, en un origen distinto al del backend) queda bloqueado por el
// propio navegador al llamar a la API, sin importar que el request en sí
// llegue bien al servidor. `credentials: true` no es necesario para el
// esquema actual (Bearer en el header, no cookies) pero se deja
// habilitado desde ya para no tener que revisar esto de nuevo cuando la
// sección 13 de CLAUDE.md migre /auth/refresh a una cookie httpOnly.
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
