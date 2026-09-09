/**
 * Limitación real, documentada a propósito: sin un cliente que registre
 * un token FCM real, no hay forma de verificar que un push efectivamente
 * suene en un dispositivo. Estas pruebas verifican que push.service.js
 * invoca el SDK de Firebase Admin con el payload correcto (y que se
 * degrada sin lanzar cuando no hay proveedor configurado o el usuario no
 * tiene dispositivos) — nunca que la entrega end-to-end ocurrió.
 */
describe('push.service#enviarAUsuario', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('no lanza y no hace nada si Firebase no está configurado', async () => {
    jest.doMock('../../src/config/firebaseClient', () => null);
    const listarPorUsuario = jest.fn();
    jest.doMock('../../src/repositories/tokensDispositivo.repository', () => ({
      listarPorUsuario,
    }));

    const pushService = require('../../src/services/push.service');
    await expect(
      pushService.enviarAUsuario('user-1', { title: 't', body: 'b', data: {} }),
    ).resolves.toBeUndefined();
    expect(listarPorUsuario).not.toHaveBeenCalled();
  });

  it('no llama al SDK si el usuario no tiene tokens de dispositivo registrados', async () => {
    const send = jest.fn();
    jest.doMock('../../src/config/firebaseClient', () => ({ messaging: () => ({ send }) }));
    jest.doMock('../../src/repositories/tokensDispositivo.repository', () => ({
      listarPorUsuario: jest.fn().mockResolvedValue([]),
    }));

    const pushService = require('../../src/services/push.service');
    await pushService.enviarAUsuario('user-1', { title: 't', body: 'b', data: {} });
    expect(send).not.toHaveBeenCalled();
  });

  it('llama al SDK una vez por cada token registrado, con el payload correcto', async () => {
    const send = jest.fn().mockResolvedValue('mocked-message-id');
    jest.doMock('../../src/config/firebaseClient', () => ({ messaging: () => ({ send }) }));
    jest.doMock('../../src/repositories/tokensDispositivo.repository', () => ({
      listarPorUsuario: jest.fn().mockResolvedValue([
        { id: 't1', token: 'token-uno' },
        { id: 't2', token: 'token-dos' },
      ]),
    }));

    const pushService = require('../../src/services/push.service');
    await pushService.enviarAUsuario('user-1', {
      title: '¿Sigues vendiendo?',
      body: 'Un cliente pregunta',
      data: { type: 'availability_request', requestId: 'r1' },
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({
      token: 'token-uno',
      notification: { title: '¿Sigues vendiendo?', body: 'Un cliente pregunta' },
      data: { type: 'availability_request', requestId: 'r1' },
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ token: 'token-dos' }));
  });

  it('no lanza si el SDK falla para un token puntual (best-effort)', async () => {
    const send = jest.fn().mockRejectedValue(new Error('token inválido o desinstalado'));
    jest.doMock('../../src/config/firebaseClient', () => ({ messaging: () => ({ send }) }));
    jest.doMock('../../src/repositories/tokensDispositivo.repository', () => ({
      listarPorUsuario: jest.fn().mockResolvedValue([{ id: 't1', token: 'token-uno' }]),
    }));

    const pushService = require('../../src/services/push.service');
    await expect(
      pushService.enviarAUsuario('user-1', { title: 't', body: 'b', data: {} }),
    ).resolves.toBeUndefined();
  });
});
