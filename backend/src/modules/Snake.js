/** Cambio de posición de cada dirección válida. */
const DIRECTIONS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 }
};

/**
 * Representacion de un jugador en la partida.
 * Guarda la posicion, direccion, estado (detenida o congelada) y estadisticas de la serpiente.
 */
class Snake {

    /**
     * Objetivo: crear una serpiente con estadisticas iniciales.
     * Entradas: id (identificador unico del jugador), playerName (nombre del jugador),
     *           color (color elegido por el jugador), head ({ x, y } posicion de la cabeza),
     *           direction ('up' | 'down' | 'left' | 'right'), length (largo inicial).
     * Salidas: instancia de Snake; el cuerpo se arma detras de la cabeza.
     * Restricciones: direction debe ser una de DIRECTIONS.
     */
    constructor(id, playerName, color, head, direction, length = 1) {
        this.id = id;
        this.playerName = playerName;
        this.color = color;
        this.active = true;
        this.stunned = false;   // congelada por veneno
        this.waiting = false;   // detenida despues de un choque
        this.directionName = direction;
        this.nextDirectionName = direction;
        this.direction = DIRECTIONS[direction];
        this.nextDirection = this.direction;
        // Construye el cuerpo con el largo y la posicion actual.
        this.body = Array.from({ length }, (_, i) => ({
            x: head.x - this.direction.x * i,
            y: head.y - this.direction.y * i
        }));
        this.score = 0;
        this.foodEaten = 0;
        this.poisonEaten = 0;
        this.collisions = 0;
        this.lastCollision = null;
    }

    /**
     * Retorna el primer segmento de la serpiente.
     *
     * @returns {{x: number, y: number}}
     */
    get head() {
        return this.body[0];
    }

    /**
     * retorna el largo de la serpiente.
     *
     * @returns {number}
     */
    getLength() {
        return this.body.length;
    }

    /**
     * Agrega un segmento nuevo como cabeza.
     *
     * @param {{x: number, y: number}} cell - Posicion de la nueva cabeza.
     */
    increaseLength(cell) {
        this.body.unshift(cell);
    }

    /**
     * Recorta la cola de la serpiente.
     * Siempre queda al menos la cabeza, para que la serpiente siga en el tablero.
     */
    decreaseLength() {
        if (this.body.length > 1) this.body.pop();
    }

    /**
     * Objetivo: cambiar la direccion de la serpiente (se aplica en el siguiente movimiento).
     * Entradas: key ('up' | 'down' | 'left' | 'right').
     * Salidas: true si se acepto el cambio.
     * Restricciones: se ignora si la direccion no es valida, si la serpiente esta congelada
     *                o si es un giro de 180° y la serpiente mide mas de 1. Si estaba detenida
     *                por un choque, una direccion valida la vuelve a mover.
     */
    setDirection(key) {
        const change = Object.prototype.hasOwnProperty.call(DIRECTIONS, key) ? DIRECTIONS[key] : null;
        if (!change || !this.active || this.stunned) return false;
        const opposite = change.x === -this.direction.x && change.y === -this.direction.y;
        if (opposite && this.body.length > 1) return false;
        this.nextDirection = change;
        this.nextDirectionName = key;
        this.waiting = false;
        return true;
    }

    /**
     * Calcula la siguiente posicion de la cabeza sin moverla.
     * Usa la misma direccion que aplicara move(), para que los choques
     * se calculen sobre la celda a la que de verdad se va a mover.
     *
     * @returns {{x: number, y: number}}
     */
    calculateNextMovement() {
        if (!this.canMove()) { return { ...this.head }; }
        return {
            x: this.head.x + this.nextDirection.x,
            y: this.head.y + this.nextDirection.y
        };
    }

    /**
     * Avanza el cuerpo de la serpiente una celda.
     * Si la serpiente no debe crecer remueve la cola.
     *
     * @param {boolean} growTail - Si debe mantener la cola (crece hacia adelante).
     */
    move(growTail = false) {
        if (!this.canMove()) return;
        this.direction = this.nextDirection;
        this.directionName = this.nextDirectionName;
        this.increaseLength({
            x: this.head.x + this.direction.x,
            y: this.head.y + this.direction.y
        });

        if (!growTail) {
            this.decreaseLength();
        }
    }

    /**
     * Indica si la serpiente puede moverse en este turno.
     *
     * @returns {boolean} false si esta congelada o detenida por un choque.
     */
    canMove() {
        return this.active && !this.stunned && !this.waiting;
    }

    /**
     * Comprueba si un punto esta ocupado por el cuerpo de la serpiente.
     *
     * @param {{x: number, y: number}} position - Punto.
     * @param {boolean} skipHead - Si ignora la cabeza.
     * @returns {boolean}
     */
    isOccupied(position, skipHead = false) {
        const cells = skipHead ? this.body.slice(1) : this.body;
        return cells.some(cell => cell.x === position.x && cell.y === position.y);
    }

    /**
     * Quita segmentos de la cola.
     * Siempre deja al menos la cabeza.
     *
     * @param {number} amount - segmentos a quitar.
     * @returns {number} segmentos que se quitaron de verdad.
     */
    applyPenalty(amount) {
        const penalty = Math.max(0, Math.floor(amount));
        const removed = Math.min(penalty, this.body.length - 1);
        if (removed > 0) this.body.splice(-removed, removed);
        return removed;
    }

    /**
     * Detiene la serpiente despues de un choque, hasta que el jugador
     * elija una direccion con setDirection().
     */
    resetMovement() {
        this.waiting = true;
    }

    /**
     * Objetivo: registrar un choque en las estadisticas de la serpiente.
     * Entradas: info ({ type: 'wall' | 'self' | 'snake' | 'headOn', with: id de la otra serpiente o null }).
     * Salidas: ninguna.
     * Restricciones: ninguna.
     */
    recordCollision(info) {
        this.collisions += 1;
        this.lastCollision = { ...info };
    }

    /**
     * Suma una comida a las estadisticas.
     *
     * @param {number} points - puntos que da la comida.
     */
    eatFood(points = 1) {
        this.score += points;
        this.foodEaten += 1;
    }

    /**
     * Objetivo: aplicar el efecto de comer veneno.
     * Entradas: lengthPenalty (segmentos que pierde, por defecto 1).
     * Salidas: segmentos que se quitaron.
     * Restricciones: la serpiente queda congelada hasta que se llame recover().
     */
    eatPoison(lengthPenalty = 1) {
        this.poisonEaten += 1;
        this.stun();
        return this.applyPenalty(lengthPenalty);
    }

    /** Congela la serpiente: no se mueve ni acepta direcciones. */
    stun() {
        this.stunned = true;
    }

    /** Descongela la serpiente. */
    recover() {
        this.stunned = false;
    }

    /**
     * Objetivo: datos de la serpiente para enviar al cliente.
     * Entradas: ninguna.
     * Salidas: objeto plano con posicion, estado y estadisticas.
     * Restricciones: ninguna.
     */
    toJSON() {
        return {
            id: this.id,
            playerName: this.playerName,
            color: this.color,
            direction: this.directionName,
            body: this.body,
            active: this.active,
            stopped: this.waiting,
            frozen: this.stunned,
            score: this.score,
            foodEaten: this.foodEaten,
            poisonEaten: this.poisonEaten,
            collisions: this.collisions,
            lastCollision: this.lastCollision
        };
    }
}

module.exports = { Snake, DIRECTIONS };
