const pino = require('pino');
const env = require('./env');

// No hay una variable LOG_LEVEL en el Documento 14 sección 1.4 — el nivel
// se deriva de NODE_ENV. JEST_WORKER_ID lo define Jest, no nuestra app;
// se usa solo para silenciar logs durante pruebas, no como config propia.
const isTestRun = Boolean(process.env.JEST_WORKER_ID);
const level = isTestRun ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug';

const logger = pino({
  level,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

module.exports = logger;
