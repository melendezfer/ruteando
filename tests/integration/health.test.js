const request = require('supertest');
const app = require('../../src/app');

describe('GET /health', () => {
  it('responde 200 y confirma que el servidor está en pie', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('ruta inexistente', () => {
  it('responde 404 en formato RFC 9457 Problem Details', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 404, title: 'No encontrado' });
  });
});
