const { randomUUID } = require('crypto');

/**
 * Partida en juego. Por ahora solo guarda sus datos básicos;
 * el ciclo de movimiento (movesPerSecond) se agrega en el motor del juego.
 */
class Game {

    /**
     * Objetivo: crear una partida.
     * Entradas: modo ({ type: 'time' | 'length', value }), playersCount (número de jugadores).
     * Salidas: instancia de Game activa.
     * Restricciones: ninguna.
     */
    constructor(modo, playersCount) {
        this.id = randomUUID();
        this.active = true;
        this.modo = modo;
        this.playersCount = playersCount;
    }

    set_active() {
        this.active = !this.active;
    }

    get_active() {
        return this.active;
    }
}

module.exports = { Game };
