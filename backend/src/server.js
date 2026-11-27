/**
 * Punto de entrada del servidor de juego Vs Snake.
 * Expone la API REST (Express) y el canal de tiempo real (Socket.IO).
 */
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const config = require('./config');
const { createApp } = require('./app');
const { setupSockets } = require('./sockets');
const { GameRepository } = require('./repositories/GameRepository');

// La ruta de la base de datos se puede cambiar con DB_PATH (por ejemplo, un disco persistente en Render).
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', config.database.path);
const repository = new GameRepository(dbPath);

const app = createApp({ repository });
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.server.corsOrigin }
});

setupSockets(io, { repository });

/**
 * Objetivo: apagar el servidor cerrando la base de datos de forma ordenada.
 * Entradas: ninguna.
 * Salidas: ninguna (termina el proceso).
 * Restricciones: se llama con Ctrl+C (SIGINT) o cuando el hosting detiene el proceso (SIGTERM).
 */
function shutdown() {
  io.close();
  repository.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const PORT = process.env.PORT || config.server.port;
httpServer.listen(PORT, () => {
  console.log(`Servidor Vs Snake escuchando en el puerto ${PORT}`);
});
