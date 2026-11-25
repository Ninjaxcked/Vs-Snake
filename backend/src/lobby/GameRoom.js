/**
 * Partida en espera: guarda su configuración, sus jugadores y el color de cada uno.
 */

class GameRoom {
  /**
   * Objetivo: crear una partida en espera.
   * Entradas: options { code, creator, theme, mode: { type, value }, maxPlayers, expiresAt (Date) }.
   * Salidas: instancia de GameRoom sin jugadores.
   * Restricciones: los datos ya deben venir validados (ver Lobby).
   */
  constructor({ code, creator, theme, mode, maxPlayers, expiresAt }) {
    this.code = code;
    this.creator = creator;
    this.theme = theme;
    this.mode = { type: mode.type, value: mode.value };
    this.maxPlayers = maxPlayers;
    this.expiresAt = expiresAt;
    this.players = new Map(); // nickname -> color, en orden de llegada
    this.expirationTimer = null;
  }

  /**
   * Objetivo: saber si la partida ya tiene todos sus jugadores.
   * Entradas: ninguna.
   * Salidas: true si está completa.
   * Restricciones: ninguna.
   */
  isFull() {
    return this.players.size >= this.maxPlayers;
  }

  /**
   * Objetivo: saber si un color ya lo eligió otro jugador.
   * Entradas: color (string).
   * Salidas: true si está en uso.
   * Restricciones: compara sin distinguir mayúsculas.
   */
  isColorTaken(color) {
    const wanted = color.toLowerCase();
    return [...this.players.values()].some((used) => used.toLowerCase() === wanted);
  }

  /**
   * Objetivo: saber si un jugador está en esta partida.
   * Entradas: nickname (string).
   * Salidas: true si está.
   * Restricciones: ninguna.
   */
  hasPlayer(nickname) {
    return this.players.has(nickname);
  }

  /**
   * Objetivo: agregar un jugador con su color.
   * Entradas: nickname (string), color (string).
   * Salidas: ninguna.
   * Restricciones: quien llama debe verificar antes cupo y color (ver Lobby.join).
   */
  addPlayer(nickname, color) {
    this.players.set(nickname, color);
  }

  /**
   * Objetivo: quitar un jugador y liberar su color.
   * Entradas: nickname (string).
   * Salidas: true si el jugador estaba en la partida.
   * Restricciones: ninguna.
   */
  removePlayer(nickname) {
    return this.players.delete(nickname);
  }

  /**
   * Objetivo: detener el temporizador de expiración.
   * Entradas: ninguna.
   * Salidas: ninguna.
   * Restricciones: ninguna.
   */
  clearExpiration() {
    clearTimeout(this.expirationTimer);
    this.expirationTimer = null;
  }

  /**
   * Objetivo: obtener la forma pública de la partida (GameSummary de docs/protocolo.md).
   * Entradas: ninguna.
   * Salidas: objeto plano que se puede enviar al cliente.
   * Restricciones: ninguna.
   */
  toSummary() {
    const players = [...this.players].map(([nickname, color]) => ({ nickname, color }));
    return {
      code: this.code,
      creator: this.creator,
      theme: this.theme,
      mode: { ...this.mode },
      maxPlayers: this.maxPlayers,
      players,
      usedColors: players.map((player) => player.color),
      status: this.isFull() ? 'full' : 'waiting',
      expiresAt: this.expiresAt.toISOString()
    };
  }
}

module.exports = { GameRoom };
