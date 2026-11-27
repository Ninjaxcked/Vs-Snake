const { describe, test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const baseConfig = require('../src/config');
const { Lobby, randomGameCode } = require('../src/lobby/Lobby');

const RED = '#e53935';
const BLUE = '#1e88e5';
const GREEN = '#43a047';

/** Configuración de prueba: gameExpirationSeconds = 10, como pide el plan. */
const config = { ...baseConfig, lobby: { ...baseConfig.lobby, gameExpirationSeconds: 10 } };

/**
 * Objetivo: datos válidos para crear una partida.
 * Entradas: overrides (campos a reemplazar).
 * Salidas: objeto para Lobby.create.
 * Restricciones: ninguna.
 */
function createData(overrides = {}) {
  return { mode: { type: 'time', value: 2 }, theme: 'standard', maxPlayers: 3, color: RED, ...overrides };
}

describe('Lobby', () => {
  let lobby;
  let events;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-25T10:00:00Z') });
    lobby = new Lobby({ config });
    events = [];
    lobby.on('update', () => events.push(['update']));
    lobby.on('room', (game) => events.push(['room', game.code]));
    lobby.on('cancelled', (info) => events.push(['cancelled', info]));
  });

  afterEach(() => {
    lobby.dispose();
    mock.timers.reset();
  });

  describe('crear partida', () => {
    test('genera un código y deja al creador unido con su color', () => {
      const res = lobby.create('ana', createData());
      assert.equal(res.ok, true);
      assert.match(res.game.code, /^[A-Z0-9]{6}$/);
      assert.deepEqual(res.game.players, [{ nickname: 'ana', color: RED }]);
      assert.deepEqual(res.game.usedColors, [RED]);
      assert.equal(res.game.creator, 'ana');
      assert.equal(res.game.status, 'waiting');
      assert.equal(res.game.expiresAt, '2026-11-25T10:00:10.000Z');
      assert.deepEqual(events, [['update']]);
      assert.deepEqual(lobby.list(), [res.game]);
    });

    test('acepta modo por largo y temática fruitMix', () => {
      const res = lobby.create('ana', createData({ mode: { type: 'length', value: 20 }, theme: 'fruitMix' }));
      assert.equal(res.ok, true);
      assert.deepEqual(res.game.mode, { type: 'length', value: 20 });
      assert.equal(res.game.theme, 'fruitMix');
    });

    const invalid = {
      'sin modo': { mode: undefined },
      'tipo desconocido': { mode: { type: 'score', value: 5 } },
      'tiempo 0': { mode: { type: 'time', value: 0 } },
      'tiempo 11': { mode: { type: 'time', value: 11 } },
      'tiempo decimal': { mode: { type: 'time', value: 1.5 } },
      'tiempo como texto': { mode: { type: 'time', value: '2' } },
      'largo 4': { mode: { type: 'length', value: 4 } },
      'largo 101': { mode: { type: 'length', value: 101 } },
      'temática inválida': { theme: 'retro' },
      '1 jugador': { maxPlayers: 1 },
      '9 jugadores': { maxPlayers: 9 },
      'color fuera de la paleta': { color: '#000000' },
      'sin color': { color: undefined }
    };
    for (const [name, overrides] of Object.entries(invalid)) {
      test(`rechaza ${name}`, () => {
        const res = lobby.create('ana', createData(overrides));
        assert.equal(res.ok, false);
        assert.equal(res.code, 'INVALID_DATA');
        assert.equal(lobby.list().length, 0);
      });
    }

    test('mínimo 2 jugadores', () => {
      assert.equal(lobby.create('ana', createData({ maxPlayers: 2 })).ok, true);
    });

    test('no deja crear si el jugador ya está en otra partida', () => {
      lobby.create('ana', createData());
      assert.equal(lobby.create('ana', createData()).code, 'ALREADY_IN_GAME');
    });

    test('los códigos no se repiten entre partidas en espera', () => {
      const codes = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
      const fixed = new Lobby({ config, generateCode: () => codes.shift() });
      assert.equal(fixed.create('ana', createData()).game.code, 'AAAAAA');
      assert.equal(fixed.create('beto', createData()).game.code, 'BBBBBB');
      fixed.dispose();
    });

    test('randomGameCode genera 6 caracteres A-Z0-9', () => {
      for (let i = 0; i < 50; i += 1) assert.match(randomGameCode(), /^[A-Z0-9]{6}$/);
    });
  });

  describe('unirse', () => {
    let code;

    beforeEach(() => {
      code = lobby.create('ana', createData()).game.code;
      events.length = 0;
    });

    test('une al jugador con su color y avisa', () => {
      const res = lobby.join('beto', { code, color: BLUE });
      assert.equal(res.ok, true);
      assert.deepEqual(res.game.usedColors, [RED, BLUE]);
      assert.deepEqual(events, [['room', code], ['update']]);
      assert.equal(lobby.roomCodeOf('beto'), code);
    });

    test('acepta el código en minúsculas y con espacios', () => {
      assert.equal(lobby.join('beto', { code: ` ${code.toLowerCase()} `, color: BLUE }).ok, true);
    });

    test('un color repetido es rechazado', () => {
      const res = lobby.join('beto', { code, color: RED });
      assert.equal(res.code, 'COLOR_TAKEN');
      assert.equal(lobby.join('beto', { code, color: RED.toUpperCase() }).code, 'COLOR_TAKEN');
      assert.equal(lobby.get(code).players.size, 1);
    });

    test('al completarse queda en estado full y rechaza a más jugadores', () => {
      lobby.join('beto', { code, color: BLUE });
      const res = lobby.join('carla', { code, color: GREEN });
      assert.equal(res.game.status, 'full');
      assert.equal(lobby.join('dani', { code, color: '#fdd835' }).code, 'GAME_FULL');
    });

    test('errores: partida inexistente, código o color inválido, ya está en una partida', () => {
      assert.equal(lobby.join('beto', { code: 'ZZZZZZ', color: BLUE }).code, 'GAME_NOT_FOUND');
      assert.equal(lobby.join('beto', { code: 'abc', color: BLUE }).code, 'INVALID_DATA');
      assert.equal(lobby.join('beto', { code, color: 'azul' }).code, 'INVALID_DATA');
      assert.equal(lobby.join('ana', { code, color: BLUE }).code, 'ALREADY_IN_GAME');
    });
  });

  describe('salir', () => {
    test('libera el color del jugador', () => {
      const { code } = lobby.create('ana', createData()).game;
      lobby.join('beto', { code, color: BLUE });
      assert.equal(lobby.leave('beto').ok, true);
      assert.deepEqual(lobby.get(code).toSummary().usedColors, [RED]);
      assert.equal(lobby.join('carla', { code, color: BLUE }).ok, true);
    });

    test('si la partida queda vacía se cancela', () => {
      const { code } = lobby.create('ana', createData()).game;
      events.length = 0;
      lobby.leave('ana');
      assert.equal(lobby.get(code), null);
      assert.deepEqual(events, [['cancelled', { code, reason: 'empty', players: [] }], ['update']]);
    });

    test('salir sin estar en una partida da error', () => {
      assert.equal(lobby.leave('nadie').code, 'GAME_NOT_FOUND');
    });
  });

  describe('expiración (gameExpirationSeconds = 10)', () => {
    test('la partida se cancela sola a los 10 segundos', () => {
      const { code } = lobby.create('ana', createData()).game;
      lobby.join('beto', { code, color: BLUE });
      events.length = 0;

      mock.timers.tick(9999);
      assert.notEqual(lobby.get(code), null);

      mock.timers.tick(1);
      assert.equal(lobby.get(code), null);
      assert.deepEqual(events, [
        ['cancelled', { code, reason: 'expired', players: ['ana', 'beto'] }],
        ['update']
      ]);
      assert.equal(lobby.roomCodeOf('ana'), null);
      assert.equal(lobby.create('ana', createData()).ok, true);
    });

    test('una partida cancelada por vaciarse no vuelve a avisar al expirar', () => {
      lobby.create('ana', createData());
      lobby.leave('ana');
      events.length = 0;
      mock.timers.tick(10000);
      assert.deepEqual(events, []);
    });

    test('una partida que empezó ya no expira', () => {
      const { code } = lobby.create('ana', createData({ maxPlayers: 2 })).game;
      lobby.join('beto', { code, color: BLUE });
      const started = lobby.start(code);
      assert.equal(started.status, 'full');
      events.length = 0;
      mock.timers.tick(10000);
      assert.deepEqual(events, []);
      assert.equal(lobby.roomCodeOf('ana'), null);
    });

    test('no se puede empezar una partida incompleta', () => {
      const { code } = lobby.create('ana', createData()).game;
      assert.equal(lobby.start(code), null);
      assert.notEqual(lobby.get(code), null);
    });
  });
});
