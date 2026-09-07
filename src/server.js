const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');

app.listen(env.PORT, () => {
  logger.info(`RUTEANDO API escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
});
