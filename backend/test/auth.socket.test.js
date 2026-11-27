const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startSocketTestServer, request, waitFor } = require('../test-utils/server');

describe('eventos auth:* por Socket.IO', () => {
  let server;

  beforeEach(async () => {
    server = await startSocketTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  test('auth:check informa si el nickname está libre, ocupado o es inválido', async () => {
    const a = await server.connect();
    const b = await server.connect();
    assert.deepEqual(await request(b, 'auth:check', { nickname: 'ana' }), { ok: true, available: true });
    await request(a, 'auth:login', { nickname: 'ana' });
    assert.deepEqual(await request(b, 'auth:check', { nickname: 'ANA' }),
      { ok: true, available: false, reason: 'NICKNAME_TAKEN' });
    assert.deepEqual(await request(b, 'auth:check', { nickname: 'a' }),
      { ok: true, available: false, reason: 'INVALID_DATA' });
  });

  test('dos pestañas con el mismo nick: la segunda es rechazada', async () => {
    const tab1 = await server.connect();
    const tab2 = await server.connect();
    assert.deepEqual(await request(tab1, 'auth:login', { nickname: 'ana' }), { ok: true, nickname: 'ana' });
    const res = await request(tab2, 'auth:login', { nickname: 'ana' });
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'NICKNAME_TAKEN');
  });

  test('al cerrar la primera pestaña el nick vuelve a estar disponible', async () => {
    const tab1 = await server.connect();
    const tab2 = await server.connect();
    await request(tab1, 'auth:login', { nickname: 'ana' });
    tab1.close();
    await waitFor(async () => (await request(tab2, 'auth:check', { nickname: 'ana' })).available);
    assert.deepEqual(await request(tab2, 'auth:login', { nickname: 'ana' }), { ok: true, nickname: 'ana' });
  });

  test('un socket no puede iniciar sesión dos veces', async () => {
    const client = await server.connect();
    await request(client, 'auth:login', { nickname: 'ana' });
    const res = await request(client, 'auth:login', { nickname: 'beto' });
    assert.equal(res.ok, false);
    assert.equal(server.deps.registry.check('beto').available, true);
  });

  test('payloads inválidos responden INVALID_DATA sin tumbar el servidor', async () => {
    const client = await server.connect();
    for (const payload of [null, 'ana', 42, ['ana']]) {
      const res = await request(client, 'auth:login', payload);
      assert.equal(res.error.code, 'INVALID_DATA');
    }
    client.emit('auth:login', { nickname: 'sinack' }); // sin callback: no debe fallar
    client.emit('auth:check');
    await waitFor(() => server.deps.registry.check('sinack').available === false);
    assert.equal((await request(client, 'auth:check', { nickname: 'otro' })).ok, true);
  });
});
