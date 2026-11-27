const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { GameRepository } = require('../src/repositories/GameRepository');

/**
 * Objetivo: construir un GameResult de ejemplo para las pruebas.
 * Entradas: overrides (campos a reemplazar).
 * Salidas: objeto GameResult.
 * Restricciones: ninguna.
 */
function sampleResult(overrides = {}) {
  return {
    code: 'ABC123',
    theme: 'fruitMix',
    mode: { type: 'length', value: 15 },
    isDraw: false,
    winners: ['ana'],
    players: [
      { position: 1, nickname: 'ana', color: '#e53935', length: 15, foodEaten: 14, poisonEaten: 1, collisions: 0 },
      { position: 2, nickname: 'beto', color: '#1e88e5', length: 4, foodEaten: 5, poisonEaten: 2, collisions: 1 },
      { position: 3, nickname: 'carla', color: '#43a047', length: 2, foodEaten: 2, poisonEaten: 0, collisions: 3 }
    ],
    startedAt: '2026-11-24T20:00:00.000Z',
    endedAt: '2026-11-24T20:02:00.000Z',
    ...overrides
  };
}

describe('GameRepository (SQLite)', () => {
  let repository;

  beforeEach(() => {
    repository = new GameRepository(':memory:');
  });

  afterEach(() => {
    repository.close();
  });

  test('getGameStats devuelve exactamente el GameResult guardado', () => {
    repository.saveResult(sampleResult());
    assert.deepEqual(repository.getGameStats('ABC123'), sampleResult());
  });

  test('getGameStats devuelve null si la partida no existe', () => {
    assert.equal(repository.getGameStats('ZZZ999'), null);
  });

  test('getRanking ordena de la más reciente a la más antigua', () => {
    repository.saveResult(sampleResult({ code: 'OLD111', endedAt: '2026-11-24T10:00:00.000Z' }));
    repository.saveResult(sampleResult({ code: 'NEW222', endedAt: '2026-11-24T12:00:00.000Z' }));
    repository.saveResult(sampleResult({ code: 'MID333', endedAt: '2026-11-24T11:00:00.000Z' }));
    assert.deepEqual(repository.getRanking().map((entry) => entry.code), ['NEW222', 'MID333', 'OLD111']);
  });

  test('getRanking da ganador, largo, temática, tipo y código', () => {
    repository.saveResult(sampleResult());
    assert.deepEqual(repository.getRanking(), [{
      code: 'ABC123',
      theme: 'fruitMix',
      mode: { type: 'length', value: 15 },
      isDraw: false,
      winners: [{ nickname: 'ana', color: '#e53935', length: 15 }],
      endedAt: '2026-11-24T20:02:00.000Z'
    }]);
  });

  test('en un empate, getRanking muestra a todos los ganadores', () => {
    const result = sampleResult({ isDraw: true, winners: ['ana', 'beto'] });
    result.players[1].length = 15;
    repository.saveResult(result);
    const [entry] = repository.getRanking();
    assert.equal(entry.isDraw, true);
    assert.deepEqual(entry.winners.map((w) => w.nickname), ['ana', 'beto']);
    assert.deepEqual(repository.getGameStats('ABC123').winners, ['ana', 'beto']);
  });

  test('guardar el mismo código reemplaza el resultado anterior', () => {
    repository.saveResult(sampleResult());
    repository.saveResult(sampleResult({ winners: ['beto'], players: sampleResult().players.slice(0, 2) }));
    const stats = repository.getGameStats('ABC123');
    assert.deepEqual(stats.winners, ['beto']);
    assert.equal(stats.players.length, 2);
    assert.equal(repository.getRanking().length, 1);
  });

  test('si un dato es inválido no guarda nada (ni la partida ni los jugadores)', () => {
    const broken = sampleResult();
    broken.players[2].length = null;
    assert.throws(() => repository.saveResult(broken));
    assert.equal(repository.getGameStats('ABC123'), null);
    assert.deepEqual(repository.getRanking(), []);
  });
});

describe('persistencia en archivo', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-snake-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('después de reiniciar (cerrar y volver a abrir), el ranking sigue igual', () => {
    const file = path.join(dir, 'datos', 'vs-snake.sqlite'); // la carpeta no existe todavía
    const first = new GameRepository(file);
    first.saveResult(sampleResult({ code: 'AAA111', endedAt: '2026-11-24T10:00:00.000Z' }));
    first.saveResult(sampleResult({ code: 'BBB222', endedAt: '2026-11-24T11:00:00.000Z' }));
    const before = first.getRanking();
    first.close();

    const second = new GameRepository(file);
    try {
      assert.deepEqual(second.getRanking(), before);
      assert.deepEqual(second.getGameStats('AAA111'), sampleResult({ code: 'AAA111', endedAt: '2026-11-24T10:00:00.000Z' }));
    } finally {
      second.close();
    }
  });
});
