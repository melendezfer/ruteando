/**
 * Traduce un ProblemDetails (RFC 9457, ver openapi.yaml) a un mensaje en
 * lenguaje simple para mostrar en un formulario — nunca el `detail`
 * crudo del backend ni un stack trace (CLAUDE.md sección 13, "mensajes de
 * error en lenguaje simple" del pie de página de la Épica F1).
 *
 * No se tipa contra el schema generado a propósito: algunas respuestas
 * de error en openapi.yaml no declaran un cuerpo (ej. 409 de
 * /auth/register, `content?: never`) aunque el backend sí devuelve
 * ProblemDetails real en tiempo de ejecución — mapear por status primero
 * y leer el cuerpo de forma defensiva evita depender de esa
 * inconsistencia del contrato.
 */

type ProblemDetailsLike = {
  detail?: string;
  errors?: { field?: string; message?: string }[];
};

function isProblemDetailsLike(value: unknown): value is ProblemDetailsLike {
  return typeof value === "object" && value !== null;
}

export function getFieldErrors(errorBody: unknown): Record<string, string> {
  if (!isProblemDetailsLike(errorBody) || !Array.isArray(errorBody.errors)) return {};
  const result: Record<string, string> = {};
  for (const issue of errorBody.errors) {
    if (issue.field && issue.message) result[issue.field] = issue.message;
  }
  return result;
}

const GENERIC_ERROR = "Algo salió mal. Intenta de nuevo en un momento.";

export function getLoginErrorMessage(status: number | undefined): string {
  if (status === 401) return "Correo o contraseña incorrectos.";
  if (status === 403) {
    return "Antes de entrar, necesitas aceptar el tratamiento de datos y los términos y condiciones.";
  }
  if (status === 422) return "Revisa el correo y la contraseña ingresados.";
  return GENERIC_ERROR;
}

export function getRegisterErrorMessage(status: number | undefined): string {
  if (status === 409) return "Ya existe una cuenta con ese correo.";
  if (status === 422) return "Revisa los datos del formulario.";
  return GENERIC_ERROR;
}

export function getNetworkErrorMessage(): string {
  return "No pudimos conectar con el servidor. Verifica tu conexión e intenta de nuevo.";
}
