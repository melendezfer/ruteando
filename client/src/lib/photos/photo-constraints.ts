/**
 * Carga de fotos desde el frontend (sin épica asignada hasta ahora — ver
 * CLAUDE.md), consumiendo POST /businesses/{businessId}/photos y
 * POST /products/{productId}/photos (Épica 3 del backend). Estas
 * constantes DUPLICAN a propósito PHOTO_MAX_SIZE_BYTES/
 * PHOTO_ALLOWED_MIME_TYPES de src/config/constants.js (backend) — mismo
 * criterio ya usado con ZONE_RADIUS_METERS (sección 32 de CLAUDE.md):
 * frontend y backend son dos codebases separadas sin paquete compartido.
 * Esta copia es solo para dar feedback INMEDIATO en el navegador antes
 * de gastar una subida completa — el backend sigue siendo la única
 * verificación real (Sharp decodifica el archivo y compara el formato
 * detectado, no el declarado; regla de seguridad #7), nunca se confía
 * en este chequeo del lado del cliente como si fuera suficiente por sí
 * solo.
 */

export const PHOTO_MAX_SIZE_BYTES = 8 * 1024 * 1024;

export const PHOTO_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validatePhotoFile(file: File): string | null {
  if (!PHOTO_ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Formato no permitido — usa una foto JPEG, PNG o WEBP.";
  }
  if (file.size > PHOTO_MAX_SIZE_BYTES) {
    const maxMb = Math.round(PHOTO_MAX_SIZE_BYTES / (1024 * 1024));
    return `La foto pesa demasiado — el máximo es ${maxMb} MB.`;
  }
  return null;
}
