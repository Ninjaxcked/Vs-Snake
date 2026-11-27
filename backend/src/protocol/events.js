/**
 * Nombres de los eventos de Socket.IO entre cliente y servidor.
 * La descripción de cada evento (qué envía y qué recibe) está en docs/protocolo.md.
 * IMPORTANTE: frontend/src/protocol/events.js debe tener exactamente los mismos valores
 * (la prueba test/protocol.test.js lo verifica).
 */
const EVENTS = Object.freeze({
  // Identificación del jugador
  AUTH_CHECK: 'auth:check',
  AUTH_LOGIN: 'auth:login',

  // Lobby y partidas en espera
  LOBBY_LIST: 'lobby:list',
  LOBBY_CREATE: 'lobby:create',
  LOBBY_JOIN: 'lobby:join',
  LOBBY_LEAVE: 'lobby:leave',
  LOBBY_UPDATE: 'lobby:update',
  LOBBY_ROOM: 'lobby:room',
  LOBBY_CANCELLED: 'lobby:cancelled',

  // Juego
  GAME_ENTER: 'game:enter',
  GAME_READY: 'game:ready',
  GAME_COUNTDOWN: 'game:countdown',
  GAME_START: 'game:start',
  GAME_DIRECTION: 'game:direction',
  GAME_STATE: 'game:state',
  GAME_OVER: 'game:over'
});

/** Direcciones válidas que el cliente puede enviar en game:direction. */
const DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right']);

/** Códigos de error que el servidor devuelve en las respuestas { ok: false, error }. */
const ERROR_CODES = Object.freeze({
  INVALID_DATA: 'INVALID_DATA',
  NOT_LOGGED_IN: 'NOT_LOGGED_IN',
  NICKNAME_TAKEN: 'NICKNAME_TAKEN',
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  GAME_FULL: 'GAME_FULL',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED',
  COLOR_TAKEN: 'COLOR_TAKEN',
  ALREADY_IN_GAME: 'ALREADY_IN_GAME'
});

module.exports = { EVENTS, DIRECTIONS, ERROR_CODES };
