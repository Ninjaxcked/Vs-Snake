const { Snake, DIRECTIONS } = require('../modules/Snake');

/** Celdas libres que se piden delante de una serpiente nueva, para que no aparezca frente a un obstaculo. */
const SPAWN_CLEARANCE = 4;

/** Nombre de cada tipo de choque interno con el nombre que usa el protocolo (docs/protocolo.md). */
const COLLISION_TYPES = {
    edge: 'wall',
    self: 'self',
    body: 'snake',
    heads: 'headOn'
};

/**
 * Representa el mapa del juego.
 * Maneja las dimenciones del mapa, las serpientes, la comida, el veneno
 * y los choques de cada movimiento.
 */
class GameMap {

    /**
     * Objetivo: crear un mapa para el juego y controlar sus celdas.
     * Entradas: rows, columns (tamaño del tablero), foodScore (puntos por comida),
     *           options { foodPerPlayer, maxPoison, collisionPenalty, poisonPenalty }.
     * Salidas: instancia de GameMap vacia.
     * Restricciones: rows y columns deben ser enteros positivos.
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
        this.poisonPenalty = options.poisonPenalty ?? 1;
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
     * Revisa si una celda esta dentro del tablero y sin serpientes, comida ni veneno.
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
     * Objetivo: buscar un lugar donde aparezca una serpiente nueva.
     * Entradas: length (largo inicial de la serpiente).
     * Salidas: { head, direction } o null si no encuentra lugar.
     * Restricciones: el cuerpo (detras de la cabeza) y SPAWN_CLEARANCE celdas
     *                delante de la cabeza deben estar libres.
     */
    getSpawnPoint(length = 1) {
        const directions = Object.keys(DIRECTIONS);
        for (let attempt = 0; attempt < 200; attempt++) {
            const head = this.getRandomCell();
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const d = DIRECTIONS[direction];
            const cells = [];

            for (let i = -SPAWN_CLEARANCE; i < length; i++) {
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
     * Objetivo: agregar la serpiente de un jugador en un lugar libre.
     * Entradas: id, name (nombre del jugador), color, length (largo inicial).
     * Salidas: la Snake creada, o null si el id ya existe o no hay lugar.
     * Restricciones: ninguna.
     */
    addPlayer(id, name, color, length = 1) {
        if (this.snakes.has(id)) return null;
        const spawn = this.getSpawnPoint(length);
        if (!spawn) return null;
        const snake = new Snake(id, name, color, spawn.head, spawn.direction, length);
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
     * Genera comida hasta tener foodPerPlayer por cada serpiente.
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
        while (this.spawnPoison()) added++;
        return added;
    }

    /**
     * Objetivo: hacer aparecer un veneno en una celda libre.
     * Entradas: ninguna.
     * Salidas: true si aparecio, false si ya hay maxPoison o no hay celda libre.
     * Restricciones: nunca deja mas de maxPoison venenos en el tablero.
     */
    spawnPoison() {
        if (this.poison.length >= this.maxPoison) return false;
        for (let attempt = 0; attempt < 500; attempt++) {
            const position = this.getRandomCell();
            if (this.isFree(position)) {
                this.poison.push(position);
                return true;
            }
        }
        return false;
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
     * Si para alguno no hay celda libre, se queda donde estaba.
     */
    movePoison() {
        const previousPoison = [...this.poison];
        this.poison = [];
        for (const previous of previousPoison) {
            let newPosition = previous;
            for (let attempt = 0; attempt < 200; attempt++) {
                const position = this.getRandomCell();

                if (this.isFree(position) && !this.samePosition(position, previous)) {
                    newPosition = position;
                    break;
                }
            }
            this.poison.push(newPosition);
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

    /**
     * Identifica las serpientes que pueden moverse en este turno.
     *
     * @param {Set} blocked - ids de serpientes que ya chocaron en este turno (no se mueven).
     * @returns {Array<Snake>}
     */
    getMovingSnakes(blocked = new Set()) {
        const snakes = [];
        for (const snake of this.snakes.values()) {
            if (snake.canMove() && !blocked.has(snake.id)) { snakes.push(snake); }
        }

        return snakes;
    }


    // Identifica las serpientes que crecen al consumir comida en el siguiente movimiento.
    getGrowingSnakes(nextPositions, blocked = new Set()) {
        const snakes = new Set();
        for (const snake of this.getMovingSnakes(blocked)) {
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

    /**
     * Objetivo: describir un choque.
     * Entradas: type ('heads' | 'self' | 'edge' | 'body'), snakes (serpientes penalizadas),
     *           position (celda del choque), against (serpiente contra la que choco, o null).
     * Salidas: { type, snakeIds, position, againstId }.
     * Restricciones: ninguna.
     */
    collisionInfo(type, snakes, position, against = null) {

        const info = {
            type: type,
            snakeIds: snakes.map (snake =>snake.id),
            position: { x: position.x, y: position.y },
            againstId: against ? against.id : null
        };

        return info;
    }


    // Colisión de cabezas entre serpientes (las dos se penalizan).
    infoHeadCollisions(nextMovements, blocked = new Set()) {
        const collisions = [];
        const snakes = this.getMovingSnakes(blocked);

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
    infoSelfCollisions(nextMovements, growingSnakes, blocked = new Set()) {
        const collisions = [];
        const snakes = this.getMovingSnakes(blocked);

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
    infoEdgeCollisions(nextMovements, blocked = new Set()) {
        const collisions = [];
        const snakes = this.getMovingSnakes(blocked);

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

    /**
     * Detecta si una serpiente chocará contra el cuerpo de otra.
     * Solo se penaliza a la que choca; la otra queda registrada en againstId.
     * Una serpiente que no se mueve en este turno (detenida, congelada o que ya chocó)
     * ocupa todo su cuerpo, cabeza incluida; una que avanza libera su cola, salvo que crezca.
     */
    infoBodyCollisions(nextMovements, growingSnakes, blocked = new Set()) {
        const collisions = [];
        const movingSnakes = this.getMovingSnakes(blocked);
        const snakes = [...this.snakes.values()];

        for (const snake of movingSnakes) {
            const snakeHead = nextMovements.get(snake.id);

            for (const otherSnake of snakes) {
                if (snake.id === otherSnake.id) continue;

                let otherBody;

                if (!otherSnake.active) {
                    continue;
                } else if (!otherSnake.canMove() || blocked.has(otherSnake.id)) {
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
                                [snake],
                                snakeHead,
                                otherSnake
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
     * Detecta todas las colisiones del siguiente movimiento:
     * - Limites del mapa
     * - autochoque
     * - choque con otra serpiente
     * - choque de cabezas.
     *
     * Las coliciones se dan antes que las serpientes compartan celda.
     *
     * @param {Map} nextMovements - posicion siguiente de cada serpiente.
     * @param {Set} growingSnakes - ids de serpientes que crecen.
     * @param {Set} blocked - ids de serpientes que ya chocaron en este turno.
     * @returns {{head, self, edge, body, all}} choques por tipo.
     */
    infoCollisions(nextMovements, growingSnakes, blocked = new Set()) {
        const head = this.infoHeadCollisions(nextMovements, blocked);
        const self = this.infoSelfCollisions(nextMovements, growingSnakes, blocked);
        const edge = this.infoEdgeCollisions(nextMovements, blocked);
        const body = this.infoBodyCollisions(nextMovements, growingSnakes, blocked);

        return {head, self, edge, body, all: [...head, ...self, ...edge, ...body]};
    }

    /**
     * Objetivo: encontrar todas las serpientes que chocan en este turno.
     * Entradas: nextMovements (posicion siguiente de cada serpiente).
     * Salidas: Map id -> { type, againstId, position } con el primer choque de cada serpiente.
     * Restricciones: se repite por rondas, porque una serpiente que choca ya no se mueve
     *                y su cola deja de liberarse: otra que pensaba entrar ahi tambien choca.
     */
    resolveCollisions(nextMovements) {
        const collided = new Map();
        const blocked = new Set();

        for (let round = 0; round <= this.snakes.size; round++) {
            const growingSnakes = this.getGrowingSnakes(nextMovements, blocked);
            const found = this.infoCollisions(nextMovements, growingSnakes, blocked).all;
            let changed = false;

            for (const collision of found) {
                for (const id of collision.snakeIds) {
                    if (collided.has(id)) continue;
                    // En un choque de frente, cada una choca contra la otra.
                    const againstId = collision.type === 'heads'
                        ? collision.snakeIds.find(other => other !== id)
                        : collision.againstId;
                    collided.set(id, { type: collision.type, againstId, position: collision.position });
                    blocked.add(id);
                    changed = true;
                }
            }

            if (!changed) break;
        }

        return collided;
    }

    /**
     * Objetivo: avanzar un movimiento del juego.
     * Entradas: ninguna.
     * Salidas: arreglo de eventos del turno:
     *   { type: 'collision', snakeId, collisionType, againstId, position, removedSegments }
     *   { type: 'food', snakeId, position }
     *   { type: 'poison', snakeId, position, removedSegments }
     * Restricciones: primero resuelve los choques (las que chocan pierden collisionPenalty
     *                segmentos y quedan detenidas); despues mueve al resto, que come comida
     *                (crece 1 hacia adelante) o veneno (pierde poisonPenalty y queda congelada).
     *                Al final repone la comida.
     */
    update() {
        const events = [];
        const nextMovements = this.getNextMovements();
        const collided = this.resolveCollisions(nextMovements);

        // Penalizaciones.
        for (const [id, info] of collided) {
            const snake = this.snakes.get(id);
            if (!snake) continue;
            const removed = snake.applyPenalty(this.collisionPenalty);
            snake.resetMovement();
            const collisionType = COLLISION_TYPES[info.type];
            snake.recordCollision({ type: collisionType, with: info.againstId ?? null });

            events.push({
                type: 'collision',
                snakeId: id,
                collisionType,
                againstId: info.againstId ?? null,
                position: info.position,
                removedSegments: removed
            });
        }

        // Continuar flujo de movimiento.
        for (const snake of this.getMovingSnakes()) {
            if (collided.has(snake.id)) continue;
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
                const removed = snake.eatPoison(this.poisonPenalty);

                events.push({
                    type: 'poison',
                    snakeId: snake.id,
                    position: nextMove,
                    removedSegments: removed
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

module.exports = { GameMap, COLLISION_TYPES };
