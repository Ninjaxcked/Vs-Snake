/**
 * Registro de los jugadores conectados y sus nicknames.
 * Garantiza que un nickname solo lo use un jugador a la vez (sin distinguir mayúsculas).
 */
const { ERROR_CODES } = require('../protocol/events');

/** Nickname válido: 3 a 15 caracteres entre letras, dígitos, "_" y "-". */
const NICKNAME_PATTERN = /^[A-Za-z0-9_-]{3,15}$/;

class PlayerRegistry {
  /**
   * Objetivo: crear un registro vacío.
   * Entradas: ninguna.
   * Salidas: instancia de PlayerRegistry.
   * Restricciones: ninguna.
   */
  constructor() {
    this.bySocket = new Map(); // socketId -> nickname
    this.byKey = new Map(); // nickname en minúsculas -> socketId
  }

  /**
   * Objetivo: limpiar un nickname recibido del cliente.
   * Entradas: nickname (cualquier valor).
   * Salidas: string sin espacios al inicio ni al final, o null si no es un string.
   * Restricciones: no valida el formato.
   */
  static normalize(nickname) {
    return typeof nickname === 'string' ? nickname.trim() : null;
  }

  /**
   * Objetivo: verificar si un nickname cumple el formato permitido.
   * Entradas: nickname (cualquier valor).
   * Salidas: true si es válido, false si no.
   * Restricciones: no verifica si está en uso.
   */
  static isValid(nickname) {
    const clean = PlayerRegistry.normalize(nickname);
    return clean !== null && NICKNAME_PATTERN.test(clean);
  }

  /**
   * Objetivo: revisar si un nickname se puede usar.
   * Entradas: nickname (cualquier valor).
   * Salidas: { available: true } o { available: false, reason: 'INVALID_DATA' | 'NICKNAME_TAKEN' }.
   * Restricciones: ninguna.
   */
  check(nickname) {
    if (!PlayerRegistry.isValid(nickname)) {
      return { available: false, reason: ERROR_CODES.INVALID_DATA };
    }
    const key = PlayerRegistry.normalize(nickname).toLowerCase();
    if (this.byKey.has(key)) {
      return { available: false, reason: ERROR_CODES.NICKNAME_TAKEN };
    }
    return { available: true };
  }

  /**
   * Objetivo: reservar un nickname para un socket.
   * Entradas: socketId (string), nickname (cualquier valor).
   * Salidas: { ok: true, nickname } o { ok: false, code, message }.
   * Restricciones: un socket solo puede registrarse una vez.
   */
  register(socketId, nickname) {
    if (this.bySocket.has(socketId)) {
      return { ok: false, code: ERROR_CODES.INVALID_DATA, message: 'Ya iniciaste sesión' };
    }
    const status = this.check(nickname);
    if (!status.available) {
      const message = status.reason === ERROR_CODES.NICKNAME_TAKEN
        ? 'Ese nickname ya está en uso'
        : 'El nickname debe tener de 3 a 15 caracteres: letras, dígitos, _ o -';
      return { ok: false, code: status.reason, message };
    }
    const clean = PlayerRegistry.normalize(nickname);
    this.bySocket.set(socketId, clean);
    this.byKey.set(clean.toLowerCase(), socketId);
    return { ok: true, nickname: clean };
  }

  /**
   * Objetivo: liberar el nickname de un socket (por ejemplo, al desconectarse).
   * Entradas: socketId (string).
   * Salidas: el nickname liberado, o null si el socket no tenía uno.
   * Restricciones: ninguna.
   */
  unregister(socketId) {
    const nickname = this.bySocket.get(socketId);
    if (nickname === undefined) return null;
    this.bySocket.delete(socketId);
    this.byKey.delete(nickname.toLowerCase());
    return nickname;
  }

  /**
   * Objetivo: obtener el nickname de un socket.
   * Entradas: socketId (string).
   * Salidas: nickname o null si el socket no ha iniciado sesión.
   * Restricciones: ninguna.
   */
  getNickname(socketId) {
    return this.bySocket.get(socketId) ?? null;
  }

  /**
   * Objetivo: obtener el socket que usa un nickname.
   * Entradas: nickname (string).
   * Salidas: socketId o null si nadie lo usa.
   * Restricciones: no distingue mayúsculas.
   */
  getSocketId(nickname) {
    const clean = PlayerRegistry.normalize(nickname);
    return clean === null ? null : this.byKey.get(clean.toLowerCase()) ?? null;
  }

  /**
   * Objetivo: contar los jugadores con sesión iniciada.
   * Entradas: ninguna.
   * Salidas: número de jugadores.
   * Restricciones: ninguna.
   */
  get size() {
    return this.bySocket.size;
  }
}

module.exports = { PlayerRegistry, NICKNAME_PATTERN };
