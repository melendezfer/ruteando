const sharp = require('sharp');
const imagenService = require('../../src/services/imagen.service');
const { ValidationError } = require('../../src/errors');
const { PHOTO_MAX_DIMENSION_PX } = require('../../src/config/constants');

async function pngDeColorSolido(width, height) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer();
}

describe('imagen.service.procesar', () => {
  it('acepta un PNG válido, lo reescribe como JPEG y respeta el límite de dimensión', async () => {
    const original = await pngDeColorSolido(2000, 1000);

    const resultado = await imagenService.procesar(original);

    expect(resultado.contentType).toBe('image/jpeg');
    expect(resultado.extension).toBe('jpg');

    const metadataFinal = await sharp(resultado.buffer).metadata();
    expect(metadataFinal.format).toBe('jpeg');
    expect(metadataFinal.width).toBeLessThanOrEqual(PHOTO_MAX_DIMENSION_PX);
    expect(metadataFinal.height).toBeLessThanOrEqual(PHOTO_MAX_DIMENSION_PX);
  });

  it('no amplía una imagen más pequeña que el límite de dimensión', async () => {
    const original = await pngDeColorSolido(100, 50);

    const resultado = await imagenService.procesar(original);
    const metadataFinal = await sharp(resultado.buffer).metadata();

    expect(metadataFinal.width).toBe(100);
    expect(metadataFinal.height).toBe(50);
  });

  it('rechaza un buffer que no es una imagen (422 vía ValidationError)', async () => {
    const basura = Buffer.from('esto no es una imagen, son bytes cualquiera');
    await expect(imagenService.procesar(basura)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rechaza un SVG aunque el cliente lo declare como image/jpeg — regla de seguridad #7: la verificación es sobre el formato real detectado por Sharp, no sobre lo que declaró el cliente', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>',
    );
    await expect(imagenService.procesar(svg)).rejects.toBeInstanceOf(ValidationError);
  });
});
