/**
 * Utilidades para responder eventos de Socket.IO con el formato de docs/protocolo.md.
 */
const { ERROR_CODES } = require('../protocol/events');

/**
 * Objetivo: obtener un callback seguro para responder a un evento.
 * Entradas: ack (lo que llegó como último argumento del evento).
 * Salidas: función que envía la respuesta, o que no hace nada si el cliente no mandó callback.
 * Restricciones: ninguna.
 */
function safeAck(ack) {
  return typeof ack === 'function' ? ack : () => {};
}

/**
 * Objetivo: construir una respuesta de error.
 * Entradas: code (uno de ERROR_CODES), message (texto para el usuario).
 * Salidas: { ok: false, error: { code, message } }.
 * Restricciones: ninguna.
 */
function errorResponse(code, message) {
  return { ok: false, error: { code, message } };
}

/**
 * Objetivo: verificar que el payload de un evento sea un objeto.
 * Entradas: payload (cualquier valor).
 * Salidas: true si es un objeto simple (no null ni arreglo).
 * Restricciones: ninguna.
 */
function isPlainObject(payload) {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

/** Respuesta estándar para datos inválidos. */
const INVALID = errorResponse(ERROR_CODES.INVALID_DATA, 'Datos inválidos');

module.exports = { safeAck, errorResponse, isPlainObject, INVALID };
