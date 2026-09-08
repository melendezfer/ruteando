const { codificar, decodificar } = require('../../src/utils/cursor');

describe('cursor', () => {
  it('codifica y decodifica de vuelta al mismo objeto', () => {
    const payload = { distanceMeters: 532.1, id: '01a07d3e-41f0-70c8-bce2-227eaec1dc10' };
    expect(decodificar(codificar(payload))).toEqual(payload);
  });

  it('decodificar devuelve null ante un cursor que no es base64url válido', () => {
    expect(decodificar('esto no es un cursor válido !!!')).toBeNull();
  });

  it('decodificar devuelve null ante base64 válido que no contiene JSON', () => {
    const basura = Buffer.from('no soy json', 'utf8').toString('base64url');
    expect(decodificar(basura)).toBeNull();
  });
});
