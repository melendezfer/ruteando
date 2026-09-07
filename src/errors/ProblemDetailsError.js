/**
 * Error base para respuestas conformes a RFC 9457 (Problem Details).
 * Los servicios/controladores de cada épica deben lanzar esta clase (o una
 * subclase) en vez de errores genéricos, para que el error handler central
 * (src/middlewares/errorHandler.js) pueda serializarlos correctamente.
 */
class ProblemDetailsError extends Error {
  constructor({ status, title, detail, type = 'about:blank', instance, errors }) {
    super(detail || title);
    this.name = 'ProblemDetailsError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type;
    this.instance = instance;
    this.errors = errors;
  }

  toProblemDetails() {
    const problem = {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance: this.instance,
    };
    if (this.errors) {
      problem.errors = this.errors;
    }
    return problem;
  }
}

module.exports = ProblemDetailsError;
