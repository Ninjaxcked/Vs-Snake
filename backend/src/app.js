/**
 * Construcción de la aplicación Express (API REST).
 * Se separa de server.js para poder probarla sin abrir Socket.IO.
 */
const express = require('express');
const cors = require('cors');
const config = require('./config');

/**
 * Objetivo: crear la aplicación Express con sus middlewares y rutas.
 * Entradas: ninguna.
 * Salidas: instancia de Express lista para montarse en un servidor HTTP.
 * Restricciones: ninguna.
 */
function createApp() {
  const app = express();
  app.use(cors({ origin: config.server.corsOrigin }));
  app.use(express.json());

  /**
   * Objetivo: verificar que el servidor está en línea.
   * Entradas: petición GET /api/health.
   * Salidas: JSON { status: 'ok' }.
   * Restricciones: ninguna.
   */
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

module.exports = { createApp };
