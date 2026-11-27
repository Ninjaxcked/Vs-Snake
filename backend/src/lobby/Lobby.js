/**
 * Lobby: administra las partidas en espera (GameRoom), sus jugadores, colores y expiración.
 * No conoce Socket.IO; avisa de los cambios con eventos:
 *   'update'    ()                          la lista de partidas cambió.
 *   'room'      (GameSummary)               cambió una partida (jugadores, colores, cupo).
 *   'cancelled' ({ code, reason, players }) una partida se canceló ('expired' | 'empty').
 */
const { EventEmitter } = require('events');
const { randomInt } = require('crypto');
const { GameRoom } = require('./GameRoom');
const { ERROR_CODES } = require('../protocol/events');
const { isValidGameCode } = require('../protocol/gameCode');

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;

/**
 * Objetivo: generar un código de partida aleatorio.
 * Entradas: ninguna.
 * Salidas: string de 6 caracteres A-Z0-9.
 * Restricciones: puede repetirse; Lobby verifica que sea único.
 */
function randomGameCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Objetivo: construir una respuesta de error del Lobby.
 * Entradas: code (uno de ERROR_CODES), message (texto para el usuario).
 * Salidas: { ok: false, code, message }.
 * Restricciones: ninguna.
 */
function fail(code, message) {
  return { ok: false, code, message };
}

/**
 * Objetivo: verificar que un valor sea un entero dentro de un rango.
 * Entradas: value (cualquier valor), min, max (enteros).
 * Salidas: true si min <= value <= max y es entero.
 * Restricciones: ninguna.
 */
function isIntInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

class Lobby extends EventEmitter {
  /**
   * Objetivo: crear el lobby.
   * Entradas: options.config (configuración de config.json),
   *           options.generateCode (opcional, para pruebas).
   * Salidas: instancia de Lobby sin partidas.
   * Restricciones: llamar dispose() al apagar el servidor para detener los temporizadores.
   */
  constructor({ config, generateCode = randomGameCode }) {
    super();
    this.config = config;
    this.generateCode = generateCode;
    this.rooms = new Map(); // code -> GameRoom
    this.roomOfPlayer = new Map(); // nickname -> code
  }

  /**
   * Objetivo: listar las partidas en espera.
   * Entradas: ninguna.
   * Salidas: arreglo de GameSummary, de la más antigua a la más nueva.
   * Restricciones: no incluye partidas que ya empezaron.
   */
  list() {
    return [...this.rooms.values()].map((room) => room.toSummary());
  }

  /**
   * Objetivo: obtener una partida en espera por su código.
   * Entradas: code (string).
   * Salidas: GameRoom o null.
   * Restricciones: ninguna.
   */
  get(code) {
    return this.rooms.get(code) ?? null;
  }

  /**
   * Objetivo: saber en qué partida en espera está un jugador.
   * Entradas: nickname (string).
   * Salidas: código de la partida o null.
   * Restricciones: ninguna.
   */
  roomCodeOf(nickname) {
    return this.roomOfPlayer.get(nickname) ?? null;
  }

  /**
   * Objetivo: validar los datos para crear una partida.
   * Entradas: data { mode: { type, value }, theme, maxPlayers, color }.
   * Salidas: null si son válidos, o un mensaje de error.
   * Restricciones: los límites salen de config.json.
   */
  validateCreate(data) {
    const { mode, theme, maxPlayers, color } = data;
    const { gameModes, themes, lobby, colorPalette } = this.config;
    if (typeof mode !== 'object' || mode === null) return 'Falta el tipo de partida';
    if (mode.type === 'time') {
      const { minMinutes, maxMinutes } = gameModes.time;
      if (!isIntInRange(mode.value, minMinutes, maxMinutes)) {
        return `El tiempo debe ser un entero entre ${minMinutes} y ${maxMinutes} minutos`;
      }
    } else if (mode.type === 'length') {
      const { minTarget, maxTarget } = gameModes.length;
      if (!isIntInRange(mode.value, minTarget, maxTarget)) {
        return `El largo debe ser un entero entre ${minTarget} y ${maxTarget}`;
      }
    } else {
      return 'El tipo de partida debe ser "time" o "length"';
    }
    if (!themes.includes(theme)) return 'Temática inválida';
    if (!isIntInRange(maxPlayers, lobby.minPlayers, lobby.maxPlayers)) {
      return `El número de jugadores debe estar entre ${lobby.minPlayers} y ${lobby.maxPlayers}`;
    }
    if (!this.isPaletteColor(color)) return 'Color inválido';
    return null;
  }

  /**
   * Objetivo: saber si un color pertenece a la paleta del juego.
   * Entradas: color (cualquier valor).
   * Salidas: true si está en config.colorPalette.
   * Restricciones: no distingue mayúsculas.
   */
  isPaletteColor(color) {
    return typeof color === 'string'
      && this.config.colorPalette.some((c) => c.toLowerCase() === color.toLowerCase());
  }

  /**
   * Objetivo: generar un código que no use otra partida en espera.
   * Entradas: ninguna.
   * Salidas: código único.
   * Restricciones: lanza error si no logra uno válido (no debería pasar).
   */
  uniqueCode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = this.generateCode();
      if (isValidGameCode(code) && !this.rooms.has(code)) return code;
    }
    throw new Error('No se pudo generar un código de partida único');
  }

  /**
   * Objetivo: crear una partida; el creador queda unido con el color que eligió.
   * Entradas: nickname (creador), data { mode, theme, maxPlayers, color }.
   * Salidas: { ok: true, game: GameSummary } o { ok: false, code, message }.
   * Restricciones: el jugador no puede estar en otra partida. Inicia el temporizador de expiración.
   */
  create(nickname, data) {
    if (this.roomOfPlayer.has(nickname)) {
      return fail(ERROR_CODES.ALREADY_IN_GAME, 'Ya estás en otra partida');
    }
    const error = this.validateCreate(data);
    if (error) return fail(ERROR_CODES.INVALID_DATA, error);

    const expirationMs = this.config.lobby.gameExpirationSeconds * 1000;
    const room = new GameRoom({
      code: this.uniqueCode(),
      creator: nickname,
      theme: data.theme,
      mode: data.mode,
      maxPlayers: data.maxPlayers,
      expiresAt: new Date(Date.now() + expirationMs)
    });
    room.addPlayer(nickname, this.paletteColor(data.color));
    room.expirationTimer = setTimeout(() => this.cancel(room.code, 'expired'), expirationMs);
    room.expirationTimer.unref?.();

    this.rooms.set(room.code, room);
    this.roomOfPlayer.set(nickname, room.code);
    this.emit('update');
    return { ok: true, game: room.toSummary() };
  }

  /**
   * Objetivo: obtener el color tal como está escrito en la paleta.
   * Entradas: color (string válido de la paleta, en cualquier capitalización).
   * Salidas: el color de config.colorPalette.
   * Restricciones: el color debe estar en la paleta.
   */
  paletteColor(color) {
    return this.config.colorPalette.find((c) => c.toLowerCase() === color.toLowerCase());
  }

  /**
   * Objetivo: unir a un jugador a una partida en espera con un color.
   * Entradas: nickname (string), data { code, color }.
   * Salidas: { ok: true, game: GameSummary } o { ok: false, code, message }.
   * Restricciones: la partida debe existir y tener cupo; el color debe estar libre.
   */
  join(nickname, data) {
    const code = typeof data.code === 'string' ? data.code.trim().toUpperCase() : '';
    if (!isValidGameCode(code)) return fail(ERROR_CODES.INVALID_DATA, 'Código de partida inválido');
    if (!this.isPaletteColor(data.color)) return fail(ERROR_CODES.INVALID_DATA, 'Color inválido');

    const room = this.rooms.get(code);
    if (!room) return fail(ERROR_CODES.GAME_NOT_FOUND, 'La partida no existe o ya expiró');
    if (this.roomOfPlayer.has(nickname)) {
      return fail(ERROR_CODES.ALREADY_IN_GAME, 'Ya estás en una partida');
    }
    if (room.isFull()) return fail(ERROR_CODES.GAME_FULL, 'La partida ya está completa');
    if (room.isColorTaken(data.color)) return fail(ERROR_CODES.COLOR_TAKEN, 'Ese color ya está en uso');

    room.addPlayer(nickname, this.paletteColor(data.color));
    this.roomOfPlayer.set(nickname, code);
    this.emit('room', room.toSummary());
    this.emit('update');
    return { ok: true, game: room.toSummary() };
  }

  /**
   * Objetivo: sacar a un jugador de su partida en espera (por salir o desconectarse).
   * Entradas: nickname (string).
   * Salidas: { ok: true, code } o { ok: false, code, message } si no estaba en ninguna.
   * Restricciones: si la partida queda vacía, se cancela con motivo 'empty'.
   */
  leave(nickname) {
    const code = this.roomOfPlayer.get(nickname);
    if (!code) return fail(ERROR_CODES.GAME_NOT_FOUND, 'No estás en ninguna partida');
    const room = this.rooms.get(code);
    room.removePlayer(nickname);
    this.roomOfPlayer.delete(nickname);

    if (room.players.size === 0) {
      this.cancel(code, 'empty');
    } else {
      this.emit('room', room.toSummary());
      this.emit('update');
    }
    return { ok: true, code };
  }

  /**
   * Objetivo: cancelar una partida en espera y liberar a sus jugadores.
   * Entradas: code (string), reason ('expired' | 'empty').
   * Salidas: true si la partida existía.
   * Restricciones: ninguna.
   */
  cancel(code, reason) {
    const room = this.rooms.get(code);
    if (!room) return false;
    room.clearExpiration();
    const players = [...room.players.keys()];
    players.forEach((nickname) => this.roomOfPlayer.delete(nickname));
    this.rooms.delete(code);
    this.emit('cancelled', { code, reason, players });
    this.emit('update');
    return true;
  }

  /**
   * Objetivo: sacar del lobby una partida completa que va a empezar (la usa A7).
   * Entradas: code (string).
   * Salidas: GameSummary de la partida, o null si no existe o no está completa.
   * Restricciones: detiene la expiración; los jugadores dejan de contar como "en espera".
   */
  start(code) {
    const room = this.rooms.get(code);
    if (!room || !room.isFull()) return null;
    room.clearExpiration();
    room.players.forEach((_, nickname) => this.roomOfPlayer.delete(nickname));
    this.rooms.delete(code);
    this.emit('update');
    return room.toSummary();
  }

  /**
   * Objetivo: detener todos los temporizadores (al apagar el servidor o en pruebas).
   * Entradas: ninguna.
   * Salidas: ninguna.
   * Restricciones: el lobby no debe usarse después.
   */
  dispose() {
    this.rooms.forEach((room) => room.clearExpiration());
    this.rooms.clear();
    this.roomOfPlayer.clear();
    this.removeAllListeners();
  }
}

module.exports = { Lobby, randomGameCode };
