/**
 * Eventos lobby:* (crear partidas, unirse, salir y avisos a los clientes).
 */
const { EVENTS, ERROR_CODES } = require('../protocol/events');
const { safeAck, errorResponse, isPlainObject, INVALID } = require('./respond');

/** Room de Socket.IO con todos los clientes que ya iniciaron sesión. */
const AUTHENTICATED_ROOM = 'authenticated';

/**
 * Objetivo: reenviar a los clientes los cambios del lobby.
 * Entradas: io (servidor de Socket.IO), lobby (Lobby).
 * Salidas: ninguna.
 * Restricciones: llamar una sola vez por servidor.
 */
function broadcastLobbyChanges(io, lobby) {
  lobby.on('update', () => {
    io.to(AUTHENTICATED_ROOM).emit(EVENTS.LOBBY_UPDATE, { games: lobby.list() });
  });

  lobby.on('room', (game) => {
    io.to(game.code).emit(EVENTS.LOBBY_ROOM, { game });
  });

  lobby.on('cancelled', ({ code, reason }) => {
    io.to(code).emit(EVENTS.LOBBY_CANCELLED, { code, reason });
    io.in(code).socketsLeave(code);
  });
}

/**
 * Objetivo: registrar los eventos lobby:* de un socket.
 * Entradas: socket (socket de Socket.IO), lobby (Lobby compartido).
 * Salidas: ninguna.
 * Restricciones: todos los eventos requieren haber hecho auth:login (socket.data.nickname).
 */
function registerLobbyHandlers(socket, lobby) {
  /**
   * Objetivo: envolver un manejador para validar el payload y exigir sesión.
   * Entradas: handler (función (nickname, payload, reply)).
   * Salidas: función (payload, ack) para socket.on.
   * Restricciones: responde NOT_LOGGED_IN o INVALID_DATA sin llamar al handler.
   */
  const withSession = (handler) => (payload, ack) => {
    const reply = safeAck(ack);
    const { nickname } = socket.data;
    if (!nickname) return reply(errorResponse(ERROR_CODES.NOT_LOGGED_IN, 'Primero elige un nickname'));
    if (!isPlainObject(payload)) return reply(INVALID);
    return handler(nickname, payload, reply);
  };

  /**
   * Objetivo: devolver la lista de partidas en espera.
   * Entradas: payload {}, ack.
   * Salidas: ack({ ok: true, games }).
   * Restricciones: requiere sesión.
   */
  socket.on(EVENTS.LOBBY_LIST, withSession((nickname, payload, reply) => (
    reply({ ok: true, games: lobby.list() })
  )));

  /**
   * Objetivo: crear una partida y unir al creador.
   * Entradas: payload { mode, theme, maxPlayers, color }, ack.
   * Salidas: ack({ ok: true, game }) o error.
   * Restricciones: requiere sesión; el socket entra a la room de la partida.
   */
  socket.on(EVENTS.LOBBY_CREATE, withSession((nickname, payload, reply) => {
    const result = lobby.create(nickname, payload);
    if (!result.ok) return reply(errorResponse(result.code, result.message));
    socket.join(result.game.code);
    return reply({ ok: true, game: result.game });
  }));

  /**
   * Objetivo: unir al jugador a una partida en espera con un color.
   * Entradas: payload { code, color }, ack.
   * Salidas: ack({ ok: true, game }) o error.
   * Restricciones: requiere sesión; el socket entra a la room de la partida.
   */
  socket.on(EVENTS.LOBBY_JOIN, withSession((nickname, payload, reply) => {
    const result = lobby.join(nickname, payload);
    if (!result.ok) return reply(errorResponse(result.code, result.message));
    socket.join(result.game.code);
    return reply({ ok: true, game: result.game });
  }));

  /**
   * Objetivo: sacar al jugador de su partida en espera.
   * Entradas: payload { code }, ack.
   * Salidas: ack({ ok: true }) o error GAME_NOT_FOUND.
   * Restricciones: requiere sesión; code debe ser la partida donde está el jugador.
   */
  socket.on(EVENTS.LOBBY_LEAVE, withSession((nickname, payload, reply) => {
    const current = lobby.roomCodeOf(nickname);
    const code = typeof payload.code === 'string' ? payload.code.trim().toUpperCase() : null;
    if (!current || (code && code !== current)) {
      return reply(errorResponse(ERROR_CODES.GAME_NOT_FOUND, 'No estás en esa partida'));
    }
    socket.leave(current);
    lobby.leave(nickname);
    return reply({ ok: true });
  }));
}

/**
 * Objetivo: sacar del lobby a un jugador que se desconectó.
 * Entradas: socket (socket que se desconecta), lobby (Lobby).
 * Salidas: ninguna.
 * Restricciones: llamar antes de liberar el nickname.
 */
function handleLobbyDisconnect(socket, lobby) {
  const { nickname } = socket.data;
  if (nickname && lobby.roomCodeOf(nickname)) lobby.leave(nickname);
}

module.exports = {
  AUTHENTICATED_ROOM,
  broadcastLobbyChanges,
  registerLobbyHandlers,
  handleLobbyDisconnect
};
