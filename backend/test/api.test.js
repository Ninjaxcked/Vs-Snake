const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { InMemoryGameRepository } = require('../src/repositories/InMemoryGameRepository');
const { startTestServer } = require('../test-utils/server');

/**
 * Objetivo: construir un GameResult de ejemplo para las pruebas.
 * Entradas: overrides (campos a reemplazar).
 * Salidas: objeto GameResult.
 * Restricciones: ninguna.
 */
function sampleResult(overrides = {}) {
  return {
    code: 'ABC123',
    theme: 'standard',
    mode: { type: 'time', value: 2 },
    isDraw: false,
    winners: ['ana'],
    players: [
      { position: 1, nickname: 'ana', color: '#e53935', length: 9, foodEaten: 8, poisonEaten: 1, collisions: 0 },
      { position: 2, nickname: 'beto', color: '#1e88e5', length: 4, foodEaten: 5, poisonEaten: 2, collisions: 1 }
    ],
    startedAt: '2026-11-24T20:00:00.000Z',
    endedAt: '2026-11-24T20:02:00.000Z',
    ...overrides
  };
}

describe('API REST', () => {
  let repository;
  let server;

  beforeEach(async () => {
    repository = new InMemoryGameRepository();
    server = await startTestServer(createApp({ repository }));
  });

  afterEach(async () => {
    await server.close();
  });

  test('GET /api/ranking sin partidas devuelve un arreglo vacío', async () => {
    const res = await fetch(`${server.baseUrl}/api/ranking`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  });

  test('GET /api/ranking ordena de la más reciente a la más antigua', async () => {
    repository.saveResult(sampleResult({ code: 'OLD111', endedAt: '2026-11-24T10:00:00.000Z' }));
    repository.saveResult(sampleResult({ code: 'NEW222', endedAt: '2026-11-24T12:00:00.000Z' }));
    const body = await (await fetch(`${server.baseUrl}/api/ranking`)).json();
    assert.deepEqual(body.map((entry) => entry.code), ['NEW222', 'OLD111']);
    assert.deepEqual(body[0].winners, [{ nickname: 'ana', color: '#e53935', length: 9 }]);
  });

  test('GET /api/ranking muestra a todos los ganadores en un empate', async () => {
    const result = sampleResult({ isDraw: true, winners: ['ana', 'beto'] });
    result.players[1].length = 9;
    repository.saveResult(result);
    const [entry] = await (await fetch(`${server.baseUrl}/api/ranking`)).json();
    assert.equal(entry.isDraw, true);
    assert.deepEqual(entry.winners.map((w) => w.nickname), ['ana', 'beto']);
  });

  test('GET /api/games/:id/stats devuelve el resultado guardado', async () => {
    repository.saveResult(sampleResult());
    const res = await fetch(`${server.baseUrl}/api/games/abc123/stats`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), sampleResult());
  });

  test('GET /api/games/:id/stats responde 404 si la partida no existe', async () => {
    const res = await fetch(`${server.baseUrl}/api/games/ZZZ999/stats`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'GAME_NOT_FOUND');
  });

  test('GET /api/games/:id/stats responde 400 con un código inválido', async () => {
    const res = await fetch(`${server.baseUrl}/api/games/no-valido/stats`);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'INVALID_DATA');
  });

  test('GET /api/config expone solo los parámetros públicos', async () => {
    const body = await (await fetch(`${server.baseUrl}/api/config`)).json();
    assert.ok(Array.isArray(body.colorPalette));
    assert.ok(body.themes.includes('fruitMix'));
    assert.equal(body.minPlayers, 2);
    assert.equal(body.server, undefined);
  });
});
