/**
 * Módulo de configuración del servidor.
 */
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'config.json');

/**
 * Objetivo: cargar los parámetros configurables del juego desde config.json.
 * Entradas: ninguna (lee el archivo backend/config/config.json).
 * Salidas: objeto con la configuración.
 * Restricciones: el archivo debe existir y contener JSON válido; si no, lanza error.
 */
function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

module.exports = loadConfig();
