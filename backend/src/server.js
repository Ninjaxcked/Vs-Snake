/**
 * Punto de entrada del servidor de juego Vs Snake.
 * Expone la API REST (Express) y el canal de tiempo real (Socket.IO).
 */
const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const { createApp } = require('./app');

const app = createApp();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.server.corsOrigin }
});

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || config.server.port;
httpServer.listen(PORT, () => {
  console.log(`Servidor Vs Snake escuchando en el puerto ${PORT}`);
});
