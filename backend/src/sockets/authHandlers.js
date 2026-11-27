/**
 * Eventos auth:* (identificación del jugador con un nickname único).
 */
const { EVENTS } = require('../protocol/events');
const { safeAck, errorResponse, isPlainObject, INVALID } = require('./respond');

/**
 * Objetivo: registrar los eventos auth:check y auth:login de un socket.
 * Entradas: socket (socket de Socket.IO), registry (PlayerRegistry compartido),
 *           options.onLogin (opcional; se llama con el nickname tras un login exitoso).
 * Salidas: ninguna.
 * Restricciones: el nickname se libera en el evento disconnect (ver sockets/index.js).
 */
function registerAuthHandlers(socket, registry, { onLogin = () => {} } = {}) {
  /**
   * Objetivo: decir si un nickname está libre mientras el usuario escribe.
   * Entradas: payload { nickname }, ack.
   * Salidas: ack({ ok: true, available, reason? }).
   * Restricciones: no reserva el nickname.
   */
  socket.on(EVENTS.AUTH_CHECK, (payload, ack) => {
    const reply = safeAck(ack);
    if (!isPlainObject(payload)) return reply(INVALID);
    return reply({ ok: true, ...registry.check(payload.nickname) });
  });

  /**
   * Objetivo: iniciar sesión reservando el nickname para este socket.
   * Entradas: payload { nickname }, ack.
   * Salidas: ack({ ok: true, nickname }) o ack({ ok: false, error }).
   * Restricciones: un socket solo puede iniciar sesión una vez.
   */
  socket.on(EVENTS.AUTH_LOGIN, (payload, ack) => {
    const reply = safeAck(ack);
    if (!isPlainObject(payload)) return reply(INVALID);
    const result = registry.register(socket.id, payload.nickname);
    if (!result.ok) return reply(errorResponse(result.code, result.message));
    socket.data.nickname = result.nickname;
    onLogin(result.nickname);
    return reply({ ok: true, nickname: result.nickname });
  });
}

module.exports = { registerAuthHandlers };
