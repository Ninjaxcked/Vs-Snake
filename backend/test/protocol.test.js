const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { EVENTS, DIRECTIONS, ERROR_CODES } = require('../src/protocol/events');

const FRONTEND_EVENTS = path.join(__dirname, '..', '..', 'frontend', 'src', 'protocol', 'events.js');

/**
 * Objetivo: obtener las constantes exportadas por el archivo de eventos del frontend.
 * Entradas: ninguna (lee frontend/src/protocol/events.js).
 * Salidas: objeto { EVENTS, DIRECTIONS, ERROR_CODES } del frontend.
 * Restricciones: el archivo solo debe contener exportaciones de constantes literales.
 */
function loadFrontendProtocol() {
  const source = fs.readFileSync(FRONTEND_EVENTS, 'utf-8').replace(/export const /g, 'exports.');
  const exportsObj = {};
  new Function('exports', source)(exportsObj);
  return exportsObj;
}

test('los eventos del frontend coinciden con los del backend', () => {
  const front = loadFrontendProtocol();
  assert.deepEqual(front.EVENTS, EVENTS);
  assert.deepEqual(front.DIRECTIONS, DIRECTIONS);
  assert.deepEqual(front.ERROR_CODES, ERROR_CODES);
});

test('cada evento usa uno de los prefijos auth:, lobby: o game:', () => {
  for (const name of Object.values(EVENTS)) {
    assert.match(name, /^(auth|lobby|game):[a-z]+$/);
  }
});

test('no hay nombres de evento repetidos', () => {
  const names = Object.values(EVENTS);
  assert.equal(new Set(names).size, names.length);
});
