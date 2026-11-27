const { Snake, DIRECTIONS } = require('../modules/Snake');
const RESPAWN_MS = 2000;
const FOOD_COUNT = 5;

/**
 * Representa el mapa del juego.
 * Maneja las dimenciones del mapa, las serpientes y sus 
 * puntos de regeneracion y los puntos de generacion de comida.
 */
class GameMap {

    /**
     * Crea un mapa para el juego y controla sus celdas.
     *
     * @param {number} rows - numero filas.
     * @param {number} columns - numero columnas.
     * @param {number} foodScore - Puntos por comida.
     * @param {Object} options - Configuraciones de juego.
     */ 
    constructor(rows, columns, foodScore = 1, options = {}) {
        if (!Number.isInteger(rows) || rows <= 0 ||
            !Number.isInteger(columns) || columns <= 0) {
            throw new Error('Invalid game map dimensions');
        }

        this.rows = rows;
        this.columns = columns;
        this.foodScore = foodScore;
        this.foodPerPlayer = options.foodPerPlayer ?? 1;
        this.maxPoison = options.maxPoison ?? 1;
        this.collisionPenalty = options.collisionPenalty ?? 1;
        this.snakes = new Map();
        this.food = [];
        this.poison = [];
    }


    getRows() {
        return this.rows;
    }

    getColumns() {
        return this.columns;
    }

    getRandomCell() {
        return {
            x: Math.floor(Math.random() * this.columns),
            y: Math.floor(Math.random() * this.rows)
        };
    }


    isWithinBounds(position) {
        return position.x >= 0 &&
               position.y >= 0 &&
               position.x < this.columns &&
               position.y < this.rows;
    }

    /**
     * 
     *
     * @param {{x: number, y: number}} position 
     * @returns {boolean}
     */
    isFree(position) {
        if (!this.isWithinBounds(position)) return false;
        for (const snake of this.snakes.values()) {
            if (snake.active && snake.isOccupied(position)) {
                return false;
            }
        }

        const hasFood = this.food.some(cell =>
            cell.x === position.x && cell.y === position.y
        );

        const hasPoison = this.poison.some(cell =>
            cell.x === position.x && cell.y === position.y
        );

        return !hasFood && !hasPoison;
    }

    /**
     *
     * @param {number} length 
     * @returns {{head: Object, direction: string}|null}
     */
    getSpawnPoint(length = 1) {
        const directions = Object.keys(DIRECTIONS);
        for (let attempt = 0; attempt < 200; attempt++) {
            const head = this.getRandomCell();
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const d = DIRECTIONS[direction];
            const cells = [];
            
            for (let i = 0; i < length + 4; i++) {
                cells.push({
                    x: head.x - d.x * i,
                    y: head.y - d.y * i
                });
            }

            if (cells.every(cell => this.isFree(cell))) {
                return { head, direction };
            }
        }

        return null;
    }

    /**
     *
     * @param {string|number} id 
     * @param {string} name 
     * @param {string} color
     * @returns {Snake|null} 
     */
    addPlayer(id, name, color) {
        if (this.snakes.has(id)) return null;
        const spawn = this.getSpawnPoint();
        if (!spawn) return null;
        const snake = new Snake(id, name, color, spawn.head, spawn.direction);
        this.snakes.set(id, snake);
        return snake;
    }

    /**
     *
     * @param {string|number} id 
     * @returns {boolean}
     */
    removePlayer(id) {
        return this.snakes.delete(id);
    }

    /**
     * Genera comida por serpiente,
     * according to the configured amount.
     *
     * @returns {number} cantidad de comida añadida.
     */
    addFood() {
        const target = this.snakes.size * this.foodPerPlayer;
        let attempts = 0;
        let added = 0;

        while (this.food.length < target && attempts < 500) {
            attempts++;
            const position = this.getRandomCell();
            if (this.isFree(position)) {
                this.food.push(position);
                added++;
            }
        }

        return added;
    }

    /**
     * Quita comida de una celda.
     *
     * @param {{x: number, y: number}} position - posicion comida.
     * @returns {boolean}
     */
    removeFood(position) {
        const index = this.food.findIndex(cell =>
            cell.x === position.x && cell.y === position.y
        );
        if (index === -1) return false;
        this.food.splice(index, 1);
        return true;
    }

    /**
     * Genera venenos hasta que se alcanza el limite preestablecido.
     *
     * @returns {number} cantidad de venenos.
     */
    addPoison() {
        let added = 0;
        let attempts = 0;

        while (this.poison.length < this.maxPoison && attempts < 500) {
            attempts++;
            const position = this.getRandomCell();

            if (this.isFree(position)) {
                this.poison.push(position);
                added++;
            }
        }

        return added;
    }

    /**
     * Quita el veneno de la celda
     *
     * @param {{x: number, y: number}} position - veneno posicion.
     * @returns {boolean}
     */
    removePoison(position) {
        const index = this.poison.findIndex(cell =>
            cell.x === position.x && cell.y === position.y
        );

        if (index === -1) return false;
        this.poison.splice(index, 1);
        return true;
    }

    /**
     * Cambia la posicion de todos los venenos en el mapa.
     */
    movePoison() {
        const previousPoison = [...this.poison];
        this.poison = [];
        for (const previous of previousPoison) {
            let newPosition = null;
            for (let attempt = 0; attempt < 200; attempt++) {
                const position = this.getRandomCell();

                if (this.isFree(position)) {
                    newPosition = position;
                    break;
                }
            }

            if (newPosition) {
                this.poison.push(newPosition);
            }
        }
    }

    /**
     * Identifica serpiente ocupando la celda.
     *
     * @param {{x: number, y: number}} position - Posicion.
     * @returns {Snake|null}
     */
    getSnakeAt(position) {
        for (const snake of this.snakes.values()) {
            if (snake.active && snake.isOccupied(position)) {
                return snake;
            }
        }

        return null;
    }

    /**
     * Revisa si una celda tiene comida.
     *
     * @param {{x: number, y: number}} position
     * @returns {boolean}
     */
    checkFoodConsumption(position) {
        return this.food.some(cell =>
            cell.x === position.x && cell.y === position.y
        );
    }

    /**
     * Revisa si una celda tiene veneno.
     *
     * @param {{x: number, y: number}} position
     * @returns {boolean}
     */
    checkPoisonConsumption(position) {
        return this.poison.some(cell =>
            cell.x === position.x && cell.y === position.y
        );
    }

    samePosition(first, second) {
        return first.x == second.x && first.y == second.y;
    }


    getNextMovements() {
        const moves = new Map();

        for (const snake of this.snakes.values()) {
            const nextPosition = snake.calculateNextMovement();
            moves.set(snake.id, nextPosition);
        }

        return moves;
    }

    // Identifica las serpientes que pueden moverse en este turno.
    getMovingSnakes() {
        const snakes = [];
        for (const snake of this.snakes.values()) {
            if (snake.canMove()) { snakes.push(snake); }
        }

        return snakes;
    }


    // Identifica las serpientes que crecen al consumir comida en el siguiente movimiento.
    getGrowingSnakes(nextPositions) {
        const snakes = new Set();
        for (const snake of this.getMovingSnakes()) {
            const nextHead = nextPositions.get(snake.id);
            let willEat = false;

            for (const food of this.food) {
                if (this.samePosition(food, nextHead)) {
                    willEat = true;
                    break;
                }
            }

            if (willEat) {
                snakes.add(snake.id);
            }
        }
        return snakes;
    }

    // Retorna información de una colisión.
    collisionInfo(type, snakes, position) {

        const info = {
            type: type,
            snakeIds: snakes.map (snake =>snake.id),
            position: { x: position.x, y: position.y }
        };

        return info;
    }


    // Colisión de cabezas entre serpientes.
    infoHeadCollisions(nextMovements) {
        const collisions = [];
        const snakes = this.getMovingSnakes();

        for (let i = 0; i < snakes.length; i++) {
            for (let j = i + 1; j < snakes.length; j++) {
                const snake = snakes[i];
                const otherSnake = snakes[j];

                const snakeHead = nextMovements.get(snake.id);
                const otherSnakeHead = nextMovements.get(otherSnake.id);

                const sameNextPosition = this.samePosition(
                    snakeHead,
                    otherSnakeHead
                );

                const exchangePositions =
                    this.samePosition(snakeHead, otherSnake.head) &&
                    this.samePosition(otherSnakeHead, snake.head);

                if (sameNextPosition || exchangePositions) {
                    collisions.push(
                        this.collisionInfo(
                            'heads',
                            [snake, otherSnake],
                            snakeHead
                        )
                    );
                }
            }
        }

        return collisions;
    }

    // Detecta si una serpiente chocará contra su propio cuerpo.
    infoSelfCollisions(nextMovements, growingSnakes) {
        const collisions = [];
        const snakes = this.getMovingSnakes();

        for (const snake of snakes) {
            const snakeHead = nextMovements.get(snake.id);

            let snakeBody;

            if (growingSnakes.has(snake.id)) {
                snakeBody = snake.body;
            } else {
                snakeBody = snake.body.slice(0, -1);
            }

            for (const bodyPosition of snakeBody) {
                if (this.samePosition(bodyPosition, snakeHead)) {
                    collisions.push(
                        this.collisionInfo('self', [snake], snakeHead)
                    );
                    break;
                }
            }
        }

        return collisions;
    }


    // Detecta si una serpiente chocará contra los bordes del tablero.
    infoEdgeCollisions(nextMovements) {
        const collisions = [];
        const snakes = this.getMovingSnakes();

        for (const snake of snakes) {
            const snakeHead = nextMovements.get(snake.id);

            if (!this.isWithinBounds(snakeHead)) {
                collisions.push(
                    this.collisionInfo('edge', [snake], snakeHead)
                );
            }
        }

        return collisions;
    }

    // Detecta si una serpiente chocará contra el cuerpo de otra.
    infoBodyCollisions(nextMovements, growingSnakes) {
        const collisions = [];
        const movingSnakes = this.getMovingSnakes();
        const snakes = [...this.snakes.values()];

        for (const snake of movingSnakes) {
            const snakeHead = nextMovements.get(snake.id);

            for (const otherSnake of snakes) {
                if (snake.id === otherSnake.id) continue;

                let otherBody;

                if (!otherSnake.active) {
                    continue;
                } else if (!otherSnake.canMove()) {
                    // Una serpiente detenida ocupa todo su cuerpo, cabeza incluida.
                    otherBody = otherSnake.body;
                } else if (growingSnakes.has(otherSnake.id)) {
                    otherBody = otherSnake.body;
                } else {
                    otherBody = otherSnake.body.slice(0, -1);
                }

                for (const bodyPosition of otherBody) {
                    if (this.samePosition(bodyPosition, snakeHead)) {
                        collisions.push(
                            this.collisionInfo(
                                'body',
                                [snake, otherSnake],
                                snakeHead
                            )
                        );
                        break;
                    }
                }
            }
        }

        return collisions;
    }

        /**
         * Chequeo de coliciones para todas las serpientes en movimiento.
         * Detecta todas las colisiones del siguiente movimiento.
         * Detecta:
         * - Limites del mapa
         * - autochoque
         * - choque con otra serpiente
         * - choque de cabezas.
         *
         * Las coliciones se dan antes que las serpientes compartan celda.
         *
         * @param {Map<Snake, Object>} nextPositions - calculo de posiciones.
         * @param {Set<Snake>} growingSnakes - serpientes en crecimiento.
         * @returns {Map<Snake, string[]>} serpientes que chocaron.
         */

        infoCollisions(nextMovements, growingSnakes) {
            const head = this.infoHeadCollisions(nextMovements);
            const self = this.infoSelfCollisions(nextMovements, growingSnakes);
            const edge = this.infoEdgeCollisions(nextMovements);
            const body = this.infoBodyCollisions(nextMovements, growingSnakes);

            return {head, self, edge, body, all: [...head, ...self, ...edge, ...body]};
        }


    /**
     * Hace update al tablero por cada movimiento de las serpientes.
     *
     * calcula movimineto, busca por choques,
     * mueve la serpiente, comidas y venenos.
     *
     * @returns {Array<Object>} eventos generados en la actualizacion.
     */


    update() {
        const events = [];
        // Coliciones y calculo de posiciones siguientes.
        const nextMovements = this.getNextMovements();
        const growingSnakes = this.getGrowingSnakes(nextMovements);
        const collisions = this.infoCollisions(nextMovements, growingSnakes);
        const collidedSnakes = new Map();

        for (const collision of collisions.all) {
            for (const id of collision.snakeIds) {
                if (!collidedSnakes.has(id)) {
                    collidedSnakes.set(id, {
                        reasons: [],
                        positions: []
                    });
                }

                const info = collidedSnakes.get(id);

                if (!info.reasons.includes(collision.type)) {
                    info.reasons.push(collision.type);
                }

                info.positions.push(collision.position);
            }
        }

        // Penalizaciones.
        for (const [id, info] of collidedSnakes) {
            const snake = this.snakes.get(id);
            if (!snake) continue;
            const removed = snake.applyPenalty(this.collisionPenalty);
            snake.resetMovement();

            events.push({
                type: 'collision',
                snakeId: id,
                reasons: info.reasons,
                positions: info.positions,
                removedSegments: removed
            });
        }

        // Continuar flujo de movimiento.
        for (const snake of this.getMovingSnakes()) {
            if (collidedSnakes.has(snake.id)) continue;
            const nextMove = nextMovements.get(snake.id);
            const ateFood = this.checkFoodConsumption(nextMove);
            const atePoison = this.checkPoisonConsumption(nextMove);

            snake.move(ateFood);

            if (ateFood) {
                this.removeFood(nextMove);
                snake.eatFood(this.foodScore);

                events.push({
                    type: 'food',
                    snakeId: snake.id,
                    position: nextMove
                });
            }

            if (atePoison) {
                this.removePoison(nextMove);
                snake.eatPoison();
                snake.stun();

                events.push({
                    type: 'poison',
                    snakeId: snake.id,
                    position: nextMove
                });
            }
        }

        this.addFood();

        return events;
    }


    /**
     * Receives a player's direction input.
     *
     * @param {string|number} id - Player identifier.
     * @param {string} key - Requested direction.
     * @returns {boolean} Whether the direction was accepted.
     */
    identifyKey(id, key) {
        const snake = this.snakes.get(id);
        if (!snake) return false;
        return snake.setDirection(key);
    }
}

module.exports = { GameMap };
