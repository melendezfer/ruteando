const express = require('express');
const pinoHttp = require('pino-http');

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
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
