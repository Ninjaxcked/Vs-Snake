/**
 * Utilidades compartidas por las pruebas de la API REST y de Socket.IO.
 */
const http = require('http');
const { Server } = require('socket.io');
const { io: connectClient } = require('socket.io-client');
const { setupSockets } = require('../src/sockets');

/**
 * Objetivo: levantar una aplicación Express en un puerto libre para probarla.
 * Entradas: app (instancia de Express).
 * Salidas: promesa con { baseUrl, close }, donde close() apaga el servidor.
 * Restricciones: usar close() al terminar cada prueba para liberar el puerto.
 */
function startTestServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

/**
 * Objetivo: levantar un servidor de Socket.IO con los eventos del juego en un puerto libre.
 * Entradas: options (se pasan a setupSockets).
 * Salidas: promesa con { url, deps, connect, close }. connect() abre un cliente ya conectado;
 *          close() desconecta los clientes y apaga el servidor.
 * Restricciones: usar close() al terminar cada prueba.
 */
function startSocketTestServer(options) {
  return new Promise((resolve) => {
    const httpServer = http.createServer();
    const io = new Server(httpServer);
    const deps = setupSockets(io, options);
    const clients = [];
    httpServer.listen(0, () => {
      const url = `http://127.0.0.1:${httpServer.address().port}`;
      resolve({
        url,
        deps,
        connect: () => new Promise((done, fail) => {
          const client = connectClient(url, { transports: ['websocket'], forceNew: true });
          clients.push(client);
          client.once('connect', () => done(client));
          client.once('connect_error', fail);
        }),
        close: () => new Promise((done) => {
          clients.forEach((client) => client.close());
          io.close(() => {
            deps.lobby.dispose();
            done();
          });
        })
      });
    });
  });
}

/**
 * Objetivo: emitir un evento y esperar la respuesta del servidor.
 * Entradas: client (socket cliente), event (nombre), payload (datos).
 * Salidas: promesa con la respuesta del servidor.
 * Restricciones: falla si el servidor no responde en 2 segundos.
 */
function request(client, event, payload) {
  return client.timeout(2000).emitWithAck(event, payload);
}

/**
 * Objetivo: esperar hasta que una condición asíncrona se cumpla.
 * Entradas: condition (función async que devuelve boolean), timeoutMs (máximo de espera).
 * Salidas: promesa que se resuelve cuando la condición es verdadera.
 * Restricciones: falla si no se cumple a tiempo.
 */
async function waitFor(condition, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('La condición no se cumplió a tiempo');
}

/**
 * Objetivo: esperar el próximo evento que el servidor envíe a un cliente.
 * Entradas: client (socket cliente), event (nombre), timeoutMs (máximo de espera).
 * Salidas: promesa con los datos del evento.
 * Restricciones: falla si el evento no llega a tiempo.
 */
function nextEvent(client, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(event, onEvent);
      reject(new Error(`No llegó el evento ${event}`));
    }, timeoutMs);
    function onEvent(data) {
      clearTimeout(timer);
      resolve(data);
    }
    client.once(event, onEvent);
  });
}

module.exports = { startTestServer, startSocketTestServer, request, waitFor, nextEvent };
