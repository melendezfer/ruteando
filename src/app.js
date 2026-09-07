const express = require('express');
const pinoHttp = require('pino-http');

const logger = require('./config/logger');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

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
