/**
 * Nombres de los eventos de Socket.IO entre cliente y servidor.
 * La descripción de cada evento (qué envía y qué recibe) está en docs/protocolo.md.
 * IMPORTANTE: debe coincidir exactamente con backend/src/protocol/events.js
 * (la prueba backend/test/protocol.test.js lo verifica).
 */
export const EVENTS = Object.freeze({
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
  GAME_LOADED: 'game:loaded',
  GAME_READY: 'game:ready',
  GAME_COUNTDOWN: 'game:countdown',
  GAME_START: 'game:start',
  GAME_DIRECTION: 'game:direction',
  GAME_STATE: 'game:state',
  GAME_OVER: 'game:over'
});

/** Direcciones válidas que el cliente puede enviar en game:direction. */
export const DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right']);

/** Códigos de error que el servidor devuelve en las respuestas { ok: false, error }. */
export const ERROR_CODES = Object.freeze({
  INVALID_DATA: 'INVALID_DATA',
  NOT_LOGGED_IN: 'NOT_LOGGED_IN',
  NICKNAME_TAKEN: 'NICKNAME_TAKEN',
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  GAME_FULL: 'GAME_FULL',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED',
  COLOR_TAKEN: 'COLOR_TAKEN',
  ALREADY_IN_GAME: 'ALREADY_IN_GAME'
});
