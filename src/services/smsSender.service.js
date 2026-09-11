const logger = require('../config/logger');

/**
 * Envío de SMS (verificación de teléfono de vendedores) — mismo tipo de
 * gap que el correo de RF-003 (CLAUDE.md sección 10) y el push de
 * disponibilidad en tiempo real (push.service.js): sin proveedor de SMS
 * elegido todavía (piloto, sin costo de por medio), así que en vez de
 * enviar un SMS real, el código se registra en el log estructurado. El
 * resto del sistema (verificacionTelefono.service.js) llama esta función
 * sin saber que no hay envío real detrás — cuando se conecte un
 * proveedor de verdad, ese es el único código que cambia.
 *
 * TODO(verificación de teléfono): cuando se elija un proveedor de SMS
 * (ej. Twilio, Labsmobile — cualquiera con cobertura en Colombia y
 * cobro por SMS enviado, no por plan mensual fijo, dado el volumen bajo
 * esperado durante el piloto), reemplazar el cuerpo de esta función por
 * la llamada real a su SDK/API y quitar el log del código completo (no
 * debe quedar en logs de producción, igual que el enlace de recuperación
 * de RF-003) — mismo patrón que firebaseClient.js/push.service.js: un
 * cliente configurable en src/config/, null hasta tener credenciales
 * reales, con esta función usándolo si existe y degradando a este log si
 * no.
 */
async function enviarCodigo({ telefono, codigo }) {
  logger.info(
    { telefono, codigo },
    'TODO(verificación de teléfono): envío de SMS real pendiente de proveedor — código generado',
  );
}

module.exports = { enviarCodigo };
