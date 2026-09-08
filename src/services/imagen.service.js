const sharp = require('sharp');
const { ValidationError } = require('../errors');
const {
  PHOTO_ALLOWED_SHARP_FORMATS,
  PHOTO_MAX_DIMENSION_PX,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_INPUT_PIXELS,
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

  // metadata() solo lee el encabezado (no decodifica los píxeles), así que
  // un archivo pequeño puede declarar dimensiones enormes y decodificar a
  // cientos de MB en RAM al procesarlo ("bomba de descompresión"). Cortar
  // aquí por dimensiones declaradas, antes de intentar decodificar de
  // verdad, evita gastar esa memoria en un archivo que de todos modos se
  // va a rechazar.
  const pixeles = (metadata.width || 0) * (metadata.height || 0);
  if (pixeles === 0 || pixeles > PHOTO_MAX_INPUT_PIXELS) {
    throw new ValidationError('La imagen tiene dimensiones demasiado grandes para procesarse');
  }

  let procesado;
  try {
    // limitInputPixels es la red de seguridad real (Sharp la aplica al
    // decodificar, no solo al leer el encabezado) — por si algún formato
    // reporta metadata.width/height de forma distinta a lo que termina
    // decodificando.
    procesado = await sharp(buffer, { limitInputPixels: PHOTO_MAX_INPUT_PIXELS })
      .rotate() // aplica la orientación EXIF antes de redimensionar
      .resize({
        width: PHOTO_MAX_DIMENSION_PX,
        height: PHOTO_MAX_DIMENSION_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: PHOTO_JPEG_QUALITY })
      .toBuffer();
  } catch {
    throw new ValidationError('No se pudo procesar la imagen');
  }

  return { buffer: procesado, contentType: 'image/jpeg', extension: 'jpg' };
}

module.exports = { procesar };
