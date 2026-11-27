/**
 * Conexión de todos los eventos de Socket.IO del servidor.
 */
const defaultConfig = require('../config');
const { PlayerRegistry } = require('../players/PlayerRegistry');
const { Lobby } = require('../lobby/Lobby');
const { InMemoryGameRepository } = require('../repositories/InMemoryGameRepository');
const { registerAuthHandlers } = require('./authHandlers');
const {
  AUTHENTICATED_ROOM,
  broadcastLobbyChanges,
  registerLobbyHandlers,
  handleLobbyDisconnect
} = require('./lobbyHandlers');

/**
 * Objetivo: configurar los eventos de cada cliente que se conecta.
 * Entradas: io (servidor de Socket.IO),
 *           options.config (opcional; por defecto config.json),
 *           options.registry (opcional; PlayerRegistry compartido),
 *           options.lobby (opcional; Lobby compartido),
 *           options.repository (opcional; donde se guardan los resultados al terminar cada partida).
 * Salidas: objeto { registry, lobby, repository } con las dependencias usadas.
 * Restricciones: llamar una sola vez por servidor.
 */
function setupSockets(io, {
  config = defaultConfig,
  registry = new PlayerRegistry(),
  lobby = new Lobby({ config }),
  repository = new InMemoryGameRepository()
} = {}) {
  broadcastLobbyChanges(io, lobby);

  io.on('connection', (socket) => {
    registerAuthHandlers(socket, registry, {
      onLogin: () => socket.join(AUTHENTICATED_ROOM)
    });
    registerLobbyHandlers(socket, lobby);

    socket.on('disconnect', () => {
      handleLobbyDisconnect(socket, lobby);
      registry.unregister(socket.id);
    });
  });

  return { registry, lobby, repository };
}

module.exports = { setupSockets };
