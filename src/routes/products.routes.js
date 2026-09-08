const { Router } = require('express');
const controller = require('../controllers/products.controller');
const authenticate = require('../middlewares/authenticate');
const { validateBody, validateUuidParam } = require('../middlewares/validate');
const { uploadSingleFoto } = require('../middlewares/upload');
const { productInputSchema } = require('../validators/product.validators');

const router = Router();

const validarProductId = validateUuidParam('productId');

router.get('/:productId', validarProductId, controller.getOne);
router.patch(
  '/:productId',
  validarProductId,
  authenticate,
  validateBody(productInputSchema),
  controller.update,
);
router.delete('/:productId', validarProductId, authenticate, controller.remove);

router.post(
  '/:productId/photos',
  validarProductId,
  authenticate,
  uploadSingleFoto,
  controller.uploadPhoto,
);

module.exports = router;
