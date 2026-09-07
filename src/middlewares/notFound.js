const { NotFoundError } = require('../errors');

function notFound(req, res, next) {
  next(new NotFoundError(`No existe la ruta ${req.method} ${req.originalUrl}`));
}

module.exports = notFound;
