/**
 * Formato de los códigos de partida: 6 caracteres, letras mayúsculas y dígitos (ej. "K7Q2ZD").
 */
const GAME_CODE_PATTERN = /^[A-Z0-9]{6}$/;

/**
 * Objetivo: verificar si un texto tiene el formato de código de partida.
 * Entradas: code (cualquier valor).
 * Salidas: true si es un string con el formato válido, false si no.
 * Restricciones: no verifica que la partida exista.
 */
function isValidGameCode(code) {
  return typeof code === 'string' && GAME_CODE_PATTERN.test(code);
}

module.exports = { GAME_CODE_PATTERN, isValidGameCode };
