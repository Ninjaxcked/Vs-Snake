/**
 * Construcción de la aplicación Express (API REST).
 * Se separa de server.js para poder probarla sin abrir Socket.IO.
 */
const express = require('express');
const cors = require('cors');
const defaultConfig = require('./config');
const { createApiRouter } = require('./routes/api');
const { InMemoryGameRepository } = require('./repositories/InMemoryGameRepository');

/**
 * Objetivo: crear la aplicación Express con sus middlewares y rutas.
 * Entradas: options.repository (opcional; por defecto un InMemoryGameRepository),
 *           options.config (opcional; por defecto backend/config/config.json).
 * Salidas: instancia de Express lista para montarse en un servidor HTTP.
 * Restricciones: ninguna.
 */
function createApp({ repository = new InMemoryGameRepository(), config = defaultConfig } = {}) {
  const app = express();
  app.use(cors({ origin: config.server.corsOrigin }));
  app.use(express.json());
  app.use('/api', createApiRouter({ repository, config }));
  return app;
}

module.exports = { createApp };
