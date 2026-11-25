/**
 * Utilidades compartidas por las pruebas de la API REST.
 */
const http = require('http');

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

module.exports = { startTestServer };
