const sharp = require('sharp');
const { ValidationError } = require('../errors');
const {
  PHOTO_ALLOWED_SHARP_FORMATS,
  PHOTO_MAX_DIMENSION_PX,
  PHOTO_JPEG_QUALITY,
} = require('../config/constants');

/**
 * Verificación real de tipo MIME (regla de seguridad #7): no confía en el
 * Content-Type que declaró el cliente (eso ya se filtró rápido en
 * src/middlewares/upload.js) — decodifica el buffer con Sharp y usa el
 * formato que Sharp detectó de verdad. Si no es una imagen decodificable,
 * o es un formato fuera de la lista permitida (ej. alguien renombra un
 * .svg a .jpg), se rechaza aquí, sin llegar nunca al almacenamiento.
 *
 * De paso recomprime y siempre reescribe como JPEG — normaliza el
 * formato de salida sin importar cuál haya sido el de entrada.
 */
async function procesar(buffer) {
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ValidationError('El archivo no es una imagen válida');
  }

  if (!PHOTO_ALLOWED_SHARP_FORMATS.includes(metadata.format)) {
    throw new ValidationError(
      `Formato de imagen no permitido: ${metadata.format || 'desconocido'}`,
    );
  }

  const procesado = await sharp(buffer)
    .rotate() // aplica la orientación EXIF antes de redimensionar
    .resize({
      width: PHOTO_MAX_DIMENSION_PX,
      height: PHOTO_MAX_DIMENSION_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: PHOTO_JPEG_QUALITY })
    .toBuffer();

  return { buffer: procesado, contentType: 'image/jpeg', extension: 'jpg' };
}

module.exports = { procesar };
