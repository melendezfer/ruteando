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

class TooManyRequestsError extends ProblemDetailsError {
  constructor(detail = 'Demasiadas solicitudes, intente de nuevo más tarde') {
    super({ status: 429, title: 'Límite de solicitudes excedido', detail });
    this.name = 'TooManyRequestsError';
  }
}

// RF-018: login()/refresh() lo lanzan cuando faltan consentimientos
// obligatorios. type distinguible (no el about:blank por defecto) para
// que un cliente pueda diferenciar este 403 de "no tiene permisos sobre
// este recurso" — son situaciones distintas que requieren una reacción
// distinta del cliente (mostrar el aviso de privacidad, no un error
// genérico). missingConsentTypes es la única razón para sobrescribir
// toProblemDetails() en vez de pasar un campo por el constructor de la
// base: ningún otro error del proyecto necesita una extensión propia.
class ConsentRequiredError extends ProblemDetailsError {
  constructor(missingConsentTypes) {
    super({
      status: 403,
      title: 'Consentimiento requerido',
      detail: 'Debe otorgar los consentimientos obligatorios antes de continuar',
      type: 'https://api.ciudadverdegastronomica.co/errors/consent-required',
    });
    this.name = 'ConsentRequiredError';
    this.missingConsentTypes = missingConsentTypes;
  }

  toProblemDetails() {
    return { ...super.toProblemDetails(), missingConsentTypes: this.missingConsentTypes };
  }
}

module.exports = {
  ProblemDetailsError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  ConsentRequiredError,
};
