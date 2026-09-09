const { codificar, decodificar, decodificarCursorFechaId } = require('../../src/utils/cursor');
const { ValidationError } = require('../../src/errors');

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

describe('decodificarCursorFechaId', () => {
  const idValido = '01a07d3e-41f0-70c8-bce2-227eaec1dc10';

  it('devuelve null sin cursor', () => {
    expect(decodificarCursorFechaId(undefined)).toBeNull();
    expect(decodificarCursorFechaId('')).toBeNull();
  });

  it('decodifica un cursor válido {fechaCreacion, id}', () => {
    const payload = { fechaCreacion: '2026-01-01T00:00:00.123456Z', id: idValido };
    expect(decodificarCursorFechaId(codificar(payload))).toEqual(payload);
  });

  it('lanza ValidationError con un cursor corrupto (no decodifica a JSON)', () => {
    expect(() => decodificarCursorFechaId('esto-no-es-un-cursor')).toThrow(ValidationError);
  });

  it('lanza ValidationError si fechaCreacion no es una fecha válida', () => {
    const payload = { fechaCreacion: 'no-es-una-fecha', id: idValido };
    expect(() => decodificarCursorFechaId(codificar(payload))).toThrow(ValidationError);
  });

  it('lanza ValidationError si id no es un UUID', () => {
    const payload = { fechaCreacion: '2026-01-01T00:00:00Z', id: 'no-es-un-uuid' };
    expect(() => decodificarCursorFechaId(codificar(payload))).toThrow(ValidationError);
  });
});
