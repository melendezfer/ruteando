const ProblemDetailsError = require('./ProblemDetailsError');

class ValidationError extends ProblemDetailsError {
  constructor(detail, extra = {}) {
    super({ status: 422, title: 'Error de validación', detail, ...extra });
    this.name = 'ValidationError';
  }
}

class UnauthorizedError extends ProblemDetailsError {
  constructor(detail = 'Token de acceso faltante o inválido') {
    super({ status: 401, title: 'No autenticado', detail });
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends ProblemDetailsError {
  constructor(detail = 'No tiene permisos sobre este recurso') {
    super({ status: 403, title: 'No autorizado', detail });
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends ProblemDetailsError {
  constructor(detail = 'Recurso no encontrado') {
    super({ status: 404, title: 'No encontrado', detail });
    this.name = 'NotFoundError';
  }
}

class ConflictError extends ProblemDetailsError {
  constructor(detail = 'El recurso ya existe o entra en conflicto con el estado actual') {
    super({ status: 409, title: 'Conflicto', detail });
    this.name = 'ConflictError';
  }
}

module.exports = {
  ProblemDetailsError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
