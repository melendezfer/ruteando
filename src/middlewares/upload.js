const multer = require('multer');
const { ValidationError } = require('../errors');
const { PHOTO_MAX_SIZE_BYTES, PHOTO_ALLOWED_MIME_TYPES } = require('../config/constants');

/**
 * Filtro rápido por el Content-Type que declara el cliente — solo para
 * cortar temprano lo obviamente equivocado. No es la verificación real de
 * seguridad #7: esa pasa por Sharp en imagen.service.js, que decodifica el
 * buffer y compara el formato detectado, no el declarado.
 */
function fileFilter(req, file, cb) {
  if (!PHOTO_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new ValidationError(`Tipo de archivo no permitido: ${file.mimetype}`));
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_SIZE_BYTES, files: 1 },
  fileFilter,
});

/**
 * Envuelve upload.single('file') para traducir los errores de Multer
 * (ej. MulterError LIMIT_FILE_SIZE) al formato RFC 9457 del resto de la
 * API — sin esto, errorHandler.js los trataría como 500 genérico, porque
 * no son instancias de ProblemDetailsError.
 */
function uploadSingleFoto(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) {
      if (!req.file) {
        return next(new ValidationError('No se envió ningún archivo en el campo "file"'));
      }
      return next();
    }
    if (err instanceof ValidationError) {
      return next(err);
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new ValidationError(
          `El archivo supera el tamaño máximo permitido (${PHOTO_MAX_SIZE_BYTES} bytes)`,
        ),
      );
    }
    return next(new ValidationError('No se pudo procesar el archivo subido'));
  });
}

module.exports = { uploadSingleFoto };
