/**
 * Conexión de todos los eventos de Socket.IO del servidor.
 */
const { PlayerRegistry } = require('../players/PlayerRegistry');
const { registerAuthHandlers } = require('./authHandlers');

/**
 * Objetivo: configurar los eventos de cada cliente que se conecta.
 * Entradas: io (servidor de Socket.IO), options.registry (opcional; PlayerRegistry compartido).
 * Salidas: objeto { registry } con las dependencias usadas (útil para pruebas).
 * Restricciones: llamar una sola vez por servidor.
 */
function setupSockets(io, { registry = new PlayerRegistry() } = {}) {
  io.on('connection', (socket) => {
    registerAuthHandlers(socket, registry);

    socket.on('disconnect', () => {
      registry.unregister(socket.id);
    });
  });

  return { registry };
}

module.exports = { setupSockets };
