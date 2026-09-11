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
  missingConsentTypes?: unknown;
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

/**
 * ConsentRequiredProblem.missingConsentTypes (POST /auth/login, 403) —
 * leído de forma defensiva en vez de tipado contra el schema generado,
 * mismo criterio que el resto de este archivo (ver comentario de
 * cabecera): openapi-fetch tipa `error` como la unión de los cuerpos de
 * TODAS las respuestas de error declaradas para la operación (acá,
 * también Unauthorized, que no trae este campo), así que acceder
 * directo exige un cast en el sitio de llamada de todas formas.
 */
export function getMissingConsentTypes(
  errorBody: unknown,
): ("data_processing" | "terms_conditions")[] {
  if (!isProblemDetailsLike(errorBody) || !Array.isArray(errorBody.missingConsentTypes)) return [];
  return errorBody.missingConsentTypes.filter(
    (type): type is "data_processing" | "terms_conditions" =>
      type === "data_processing" || type === "terms_conditions",
  );
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
  // 409: el texto completo ("...inicia sesión") lo arma register/page.tsx
  // con un <Link> real al final — acá solo la primera mitad, la que no
  // depende de JSX.
  if (status === 409) return "Ya existe una cuenta con este correo.";
  if (status === 422) return "Revisa los datos del formulario.";
  return GENERIC_ERROR;
}

export function getNetworkErrorMessage(): string {
  return "No pudimos conectar con el servidor. Verifica tu conexión e intenta de nuevo.";
}

/**
 * POST /businesses, PATCH /businesses/{id}, PUT .../location,
 * PUT .../schedule (Épica F5) — las cuatro comparten la misma forma de
 * error (401 sesión vencida, 403 no-dueño, 404 negocio borrado a mitad
 * del asistente, 422 datos inválidos), así que un solo mapeo alcanza
 * para las tres pantallas del asistente de registro.
 */
export function getBusinessFormErrorMessage(status: number | undefined): string {
  if (status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.";
  if (status === 403) return "No tienes permiso para editar este negocio.";
  if (status === 404) return "No encontramos este negocio. Puede que ya no exista.";
  if (status === 422) return "Revisa los datos del formulario.";
  return GENERIC_ERROR;
}

/** POST /auth/assisted-registration (Épica F5, RF-018, PR #11). */
export function getAssistedRegistrationErrorMessage(status: number | undefined): string {
  if (status === 403) return "Solo un administrador puede hacer un registro asistido.";
  if (status === 409) return "Ya existe una cuenta con ese correo.";
  if (status === 422) return "Revisa los datos del formulario.";
  return GENERIC_ERROR;
}

/** POST /businesses/{businessId}/phone-verification — enviar/reenviar el código. */
export function getSendPhoneCodeErrorMessage(status: number | undefined): string {
  if (status === 422) return "Este negocio todavía no tiene un teléfono de contacto registrado.";
  if (status === 429) return "Espera unos minutos antes de pedir otro código.";
  return GENERIC_ERROR;
}

/** POST /businesses/{businessId}/phone-verification/confirm. */
export function getConfirmPhoneCodeErrorMessage(status: number | undefined): string {
  if (status === 401) return "Código incorrecto o vencido — revísalo o pide uno nuevo.";
  if (status === 429) return "Demasiados intentos fallidos — solicita un código nuevo.";
  return GENERIC_ERROR;
}
