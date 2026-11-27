/**
 * Rutas REST de la API (/api/*). El formato de cada respuesta está en docs/protocolo.md.
 */
const express = require('express');
const { isValidGameCode } = require('../protocol/gameCode');
const { ERROR_CODES } = require('../protocol/events');

/**
 * Objetivo: crear el router con los endpoints REST.
 * Entradas: options.repository (objeto con getRanking() y getGameStats(code)),
 *           options.config (configuración cargada de config.json).
 * Salidas: express.Router listo para montarse en /api.
 * Restricciones: repository no puede ser nulo.
 */
function createApiRouter({ repository, config }) {
  const router = express.Router();

  /**
   * Objetivo: verificar que el servidor está en línea.
   * Entradas: petición GET /api/health.
   * Salidas: JSON { status: 'ok' }.
   * Restricciones: ninguna.
   */
  router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  /**
   * Objetivo: entregar al cliente los parámetros que necesita para armar sus formularios.
   * Entradas: petición GET /api/config.
   * Salidas: JSON PublicConfig (temáticas, paleta de colores, límites de jugadores, etc.).
   * Restricciones: no expone parámetros internos del servidor.
   */
  router.get('/config', (req, res) => {
    res.json({
      themes: config.themes,
      colorPalette: config.colorPalette,
      minPlayers: config.lobby.minPlayers,
      maxPlayers: config.lobby.maxPlayers,
      gameExpirationSeconds: config.lobby.gameExpirationSeconds,
      startKey: config.lobby.startKey,
      startCountdownSeconds: config.lobby.startCountdownSeconds,
      gameModes: config.gameModes
    });
  });

  /**
   * Objetivo: obtener el historial de ganadores de las partidas jugadas.
   * Entradas: petición GET /api/ranking.
   * Salidas: JSON con un arreglo de RankingEntry (más reciente primero).
   * Restricciones: ninguna.
   */
  router.get('/ranking', (req, res) => {
    res.json(repository.getRanking());
  });

  /**
   * Objetivo: obtener las estadísticas de una partida terminada.
   * Entradas: petición GET /api/games/:id/stats, donde :id es el código de la partida.
   * Salidas: 200 con GameResult; 400 si el código no tiene formato válido; 404 si no existe.
   * Restricciones: el código se acepta en minúsculas y se convierte a mayúsculas.
   */
  router.get('/games/:id/stats', (req, res) => {
    const code = String(req.params.id).toUpperCase();
    if (!isValidGameCode(code)) {
      return res.status(400).json({
        error: { code: ERROR_CODES.INVALID_DATA, message: 'Código de partida inválido' }
      });
    }
    const stats = repository.getGameStats(code);
    if (!stats) {
      return res.status(404).json({
        error: { code: ERROR_CODES.GAME_NOT_FOUND, message: 'La partida no existe' }
      });
    }
    return res.json(stats);
  });

  return router;
}

module.exports = { createApiRouter };
