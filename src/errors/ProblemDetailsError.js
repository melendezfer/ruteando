/**
 * Error base para respuestas conformes a RFC 9457 (Problem Details).
 * Los servicios/controladores de cada épica deben lanzar esta clase (o una
 * subclase) en vez de errores genéricos, para que el error handler central
 * (src/middlewares/errorHandler.js) pueda serializarlos correctamente.
 */
class ProblemDetailsError extends Error {
  constructor({ status, title, detail, type = 'about:blank', instance }) {
    super(detail || title);
    this.name = 'ProblemDetailsError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type;
    this.instance = instance;
  }

  toProblemDetails() {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance: this.instance,
    };
  }
}

module.exports = ProblemDetailsError;
