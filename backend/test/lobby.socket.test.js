const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const baseConfig = require('../src/config');
const { startSocketTestServer, request, waitFor, nextEvent } = require('../test-utils/server');

const RED = '#e53935';
const BLUE = '#1e88e5';
const GREEN = '#43a047';

/** Expiración corta para no esperar 10 s reales en la prueba. */
const config = { ...baseConfig, lobby: { ...baseConfig.lobby, gameExpirationSeconds: 0.3 } };

const CREATE = { mode: { type: 'time', value: 2 }, theme: 'standard', maxPlayers: 3, color: RED };

describe('eventos lobby:* por Socket.IO', () => {
  let server;

  /**
   * Objetivo: conectar un cliente y hacer login.
   * Entradas: nickname (string).
   * Salidas: socket cliente con sesión iniciada.
   * Restricciones: ninguna.
   */
  async function player(nickname) {
    const client = await server.connect();
    const res = await request(client, 'auth:login', { nickname });
    assert.equal(res.ok, true);
    return client;
  }

  beforeEach(async () => {
    server = await startSocketTestServer({ config });
  });

  afterEach(async () => {
    await server.close();
  });

  test('sin login responde NOT_LOGGED_IN', async () => {
    const client = await server.connect();
    for (const event of ['lobby:list', 'lobby:create', 'lobby:join', 'lobby:leave']) {
      const res = await request(client, event, {});
      assert.equal(res.error.code, 'NOT_LOGGED_IN', event);
    }
  });

  test('payload inválido responde INVALID_DATA', async () => {
    const ana = await player('ana');
    assert.equal((await request(ana, 'lobby:create', null)).error.code, 'INVALID_DATA');
    assert.equal((await request(ana, 'lobby:create', { ...CREATE, maxPlayers: 1 })).error.code, 'INVALID_DATA');
  });

  test('crear una partida avisa a todos los clientes con lobby:update', async () => {
    const ana = await player('ana');
    const beto = await player('beto');
    const carla = await player('carla');
    const updates = [nextEvent(ana, 'lobby:update'), nextEvent(beto, 'lobby:update'), nextEvent(carla, 'lobby:update')];

    const res = await request(ana, 'lobby:create', CREATE);
    assert.equal(res.ok, true);

    for (const update of await Promise.all(updates)) {
      assert.deepEqual(update.games.map((g) => g.code), [res.game.code]);
    }
    const list = await request(carla, 'lobby:list', {});
    assert.deepEqual(list.games, [res.game]);
  });

  test('los clientes sin login no reciben lobby:update', async () => {
    const anon = await server.connect();
    let received = false;
    anon.on('lobby:update', () => { received = true; });
    const ana = await player('ana');
    const update = nextEvent(ana, 'lobby:update');
    await request(ana, 'lobby:create', CREATE);
    await update;
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(received, false);
  });

  test('unirse bloquea el color y avisa a la sala con lobby:room', async () => {
    const ana = await player('ana');
    const beto = await player('beto');
    const carla = await player('carla');
    const { game } = await request(ana, 'lobby:create', CREATE);

    const roomForAna = nextEvent(ana, 'lobby:room');
    const joined = await request(beto, 'lobby:join', { code: game.code, color: BLUE });
    assert.deepEqual(joined.game.usedColors, [RED, BLUE]);
    assert.deepEqual((await roomForAna).game.usedColors, [RED, BLUE]);

    const repeated = await request(carla, 'lobby:join', { code: game.code, color: BLUE });
    assert.equal(repeated.error.code, 'COLOR_TAKEN');

    const roomForBeto = nextEvent(beto, 'lobby:room');
    const full = await request(carla, 'lobby:join', { code: game.code, color: GREEN });
    assert.equal(full.game.status, 'full');
    assert.equal((await roomForBeto).game.status, 'full');
  });

  test('la partida se cancela sola al expirar y avisa a sus jugadores', async () => {
    const ana = await player('ana');
    const beto = await player('beto');
    const { game } = await request(ana, 'lobby:create', CREATE);
    await request(beto, 'lobby:join', { code: game.code, color: BLUE });

    const [cancelA, cancelB] = await Promise.all([
      nextEvent(ana, 'lobby:cancelled'),
      nextEvent(beto, 'lobby:cancelled')
    ]);
    assert.deepEqual(cancelA, { code: game.code, reason: 'expired' });
    assert.deepEqual(cancelB, { code: game.code, reason: 'expired' });
    assert.deepEqual((await request(ana, 'lobby:list', {})).games, []);
    assert.equal((await request(ana, 'lobby:create', CREATE)).ok, true);
  });

  test('lobby:leave libera el color', async () => {
    const ana = await player('ana');
    const beto = await player('beto');
    const { game } = await request(ana, 'lobby:create', CREATE);
    await request(beto, 'lobby:join', { code: game.code, color: BLUE });

    const roomForAna = nextEvent(ana, 'lobby:room');
    assert.deepEqual(await request(beto, 'lobby:leave', { code: game.code }), { ok: true });
    assert.deepEqual((await roomForAna).game.usedColors, [RED]);
    assert.equal((await request(beto, 'lobby:leave', { code: game.code })).error.code, 'GAME_NOT_FOUND');
  });

  test('al desconectarse, el jugador sale de la partida y libera su color', async () => {
    const ana = await player('ana');
    const beto = await player('beto');
    const { game } = await request(ana, 'lobby:create', CREATE);
    await request(beto, 'lobby:join', { code: game.code, color: BLUE });

    beto.close();
    await waitFor(() => server.deps.lobby.get(game.code).players.size === 1);
    assert.equal(server.deps.lobby.roomCodeOf('beto'), null);
  });

  test('si el creador se desconecta solo, la partida desaparece de la lista', async () => {
    const ana = await player('ana');
    const beto = await player('beto');
    const seen = [];
    beto.on('lobby:update', ({ games }) => seen.push(games.length));
    await request(ana, 'lobby:create', CREATE);
    await waitFor(() => seen.includes(1));
    ana.close();
    await waitFor(() => seen.at(-1) === 0);
    assert.deepEqual(server.deps.lobby.list(), []);
  });
});
