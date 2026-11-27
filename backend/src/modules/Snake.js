
const DIRECTIONS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 }
};

/**
 * Representacion de un jugador en la partida.
 * Guarda la posicion, direccion y demas atributos de la serpiete.
 */
class Snake {

    /**
     * Crea una serpiente con estadisticas iniciales.
     *
     * @param {number|string} id - identificador unico del jugador.
     * @param {string} playerName - Nombre del jugador.
     * @param {string} color - color elejido por el jugador.
     * @param {{x: number, y: number}} head - posicion inicial(cabeza).
     * @param {string} direction - Initial movement direction.
     * @param {number} length - Initial snake length.
     */
    constructor(id, playerName, color, head, direction, length = 1) {
        this.id = id;
        this.playerName = playerName;
        this.color = color;
        this.active = true;
        this.stunned = false;
        this.waiting = false;
        this.respawn = 0;
        this.direction = DIRECTIONS[direction];
        this.nextDirection = this.direction;
        // Construye el cuarpo con el largo y la posicion actual.
        this.body = Array.from({ length }, (_, i) => ({
            x: head.x - this.direction.x * i,
            y: head.y - this.direction.y * i
        }));
        this.score = 0;
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
     * Expande la cabeza de la serpiente.
     *
     * @param {{x: number, y: number}} tail - Position de la celda.
     */
    increaseLength(tail) {
        this.body.unshift(tail);
    }

    /**
     * Recorta la cola de la serpiente.
     */
    decreaseLength() {
        this.body.pop();
    }

    /**
     * Cambia la direccion actual de la serpiente.
     * Evita que se mueva en direccion opuesta.
     * 
     * @param {string} key - direccion llave.
     */
    setDirection(key) {
        const change = DIRECTIONS[key];
        if (!change || !this.active || this.stunned) return false;
        const opposite = change.x === -this.direction.x && change.y === -this.direction.y;
        if (opposite) return false;
        this.nextDirection = change;
        this.waiting = false;
        return true;
    }

    /**
     * Calcula la siguiente posicion de la cabeza sin moverla.
     *
     * @returns {{x: number, y: number}}
     */
    calculateNextMovement() {
        if (!this.canMove()) { return { ...this.head }; }
        const position = this.direction || this.nextDirection;
        return {
            x: this.head.x + position.x,
            y: this.head.y + position.y
        };
    }

    /**
     * Avanza el cuerpo de la serpiente una celda.
     * Si la serpiente no debe crecer remueve la cola.
     *
     * @param {boolean} growTail - Si debe mantener la cola.
     */
    move(growTail = false) {
        if(!this.canMove()) return;
        this.direction = this.nextDirection;
        const newHead = ({
            x: this.head.x + this.direction.x,
            y: this.head.y + this.direction.y
        });

        increaseLength(newHead);

        if (!growTail) {
            this.decreaseLength();
        }
    }

    canMove() {
        return this.active && !this.stunned && !this.waiting;
    }

    /**
     * Comprueba si un punto ya esta ocupada por otra serpiente.
     *
     * @param {{x: number, y: number}} position - Punto.
     * @param {boolean} skipHead - Si ignora la cabeza.
     * @returns {boolean}
     */
    isOccupied(position, skipHead = false) {
        const cells = skipHead ? this.body.slice(1) : this.body;
        return cells.some(cell => cell.x === position.x && cell.y === position.y);
    }

    applyPenalty(amount) {
        const penalty = Math.max(0, Math.floor(amount));
        const removed = Math.min(penalty, this.body.length);
        this.body.splice(-removed, removed);
        return removed;
    }

    eatPoison() {
        this.stun();
        this.decreaseLength();
    }

    stun() {
        this.stunned = true;
    }

    recover() {
        this.stunned = false;
    }

    /**
     *
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            playerName: this.playerName,
            color: this.color,
            body: this.body,
            active: this.active,
            score: this.score
        };
    }
}

module.exports = { Snake, DIRECTIONS };