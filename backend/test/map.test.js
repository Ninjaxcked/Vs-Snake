const test = require('node:test');
const assert = require('node:assert/strict');

const { GameMap } = require('../src/modules/GameMap');

// Crea una serpiente sencilla para realizar las pruebas.
function createSnake(id, body, direction = { x: 1, y: 0 }) {
    return {
        id,
        body: body.map(position => ({ ...position })),
        direction,
        active: true,
        movementReady: true,
        penalty: 0,

        get head() {
            return this.body[0];
        },
        isOccupied(position, skipHead = false) {
            const cells = skipHead ? this.body.slice(1) : this.body;

            return cells.some(cell =>
                cell.x === position.x && cell.y === position.y
            );
        },

        canMove() {
            return this.movementReady;
        },

        calculateNextMovement() {
            return {
                x: this.head.x + this.direction.x,
                y: this.head.y + this.direction.y
            };
        },

        move(grow = false) {
            const nextPosition = this.calculateNextMovement();

            this.body.unshift(nextPosition);

            if (!grow) {
                this.body.pop();
            }

            this.movementReady = false;
        },

        applyPenalty(amount) {
            this.penalty += amount;

            const removed = Math.min(amount, this.body.length - 1);

            this.body.splice(this.body.length - removed, removed);

            return removed;
        },

        resetMovement() {
            this.movementReady = false;
        },

        eatFood() {},
        eatPoison() { return 0; },
        stun() {},
        recordCollision() {}
    };
}

// Crea un mapa para las pruebas.
function createMap(rows = 10, columns = 10) {
    return new GameMap(rows, columns);
}

// Compara dos posiciones.
test('samePosition: identifica posiciones iguales', () => {
    const map = createMap();

    assert.equal(
        map.samePosition({ x: 2, y: 3 }, { x: 2, y: 3 }),
        true
    );

    assert.equal(
        map.samePosition({ x: 2, y: 3 }, { x: 3, y: 2 }),
        false
    );
});

// Calcula los movimientos siguientes.
test('getNextMovements: calcula la siguiente posición', () => {
    const map = createMap();
    const snake = createSnake(1, [{ x: 2, y: 2 }]);

    map.snakes.set(snake.id, snake);

    const movements = map.getNextMovements();

    assert.deepEqual(movements.get(1), { x: 3, y: 2 });

    // Calcular el movimiento no debe mover la serpiente.
    assert.deepEqual(snake.head, { x: 2, y: 2 });
});

// Identifica serpientes que comerían.
test('getGrowingSnakes: identifica serpientes que comerían comida', () => {
    const map = createMap();

    const snake = createSnake(1, [{ x: 2, y: 2 }]);

    map.snakes.set(snake.id, snake);
    map.food.push({ x: 3, y: 2 });

    const movements = map.getNextMovements();
    const growingSnakes = map.getGrowingSnakes(movements);

    assert.equal(growingSnakes.has(1), true);
});

// Detecta dos cabezas en la misma posición.
test('infoHeadCollisions: detecta dos serpientes que llegan a la misma posición', () => {
    const map = createMap();

    const snake1 = createSnake(1, [{ x: 1, y: 2 }]);
    const snake2 = createSnake(2, [{ x: 3, y: 2 }], { x: -1, y: 0 });

    map.snakes.set(1, snake1);
    map.snakes.set(2, snake2);

    const movements = map.getNextMovements();
    const collisions = map.infoHeadCollisions(movements);

    assert.equal(collisions.length, 1);
    assert.deepEqual(collisions[0].snakeIds, [1, 2]);
    assert.deepEqual(collisions[0].position, { x: 2, y: 2 });
});

// Detecta el intercambio de posiciones entre dos cabezas.
test('infoHeadCollisions: detecta intercambio de posiciones', () => {
    const map = createMap();

    const snake1 = createSnake(1, [{ x: 1, y: 2 }]);
    const snake2 = createSnake(2, [{ x: 2, y: 2 }], { x: -1, y: 0 });

    map.snakes.set(1, snake1);
    map.snakes.set(2, snake2);

    const movements = map.getNextMovements();
    const collisions = map.infoHeadCollisions(movements);

    assert.equal(collisions.length, 1);
});

// Detecta una colisión de una serpiente consigo misma.
test('infoSelfCollisions: detecta colisión con su propio cuerpo', () => {
    const map = createMap();

    const snake = createSnake(1, [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
        { x: 1, y: 2 }
    ]);

    snake.direction = { x: 0, y: 1 };

    map.snakes.set(1, snake);

    const movements = map.getNextMovements();
    const collisions = map.infoSelfCollisions(movements, new Set());

    assert.equal(collisions.length, 1);
});

// Comprueba que entrar en la posición de la cola no produzca colisión
// cuando la serpiente no está creciendo.
test('infoSelfCollisions: permite avanzar a la posición de la cola', () => {
    const map = createMap();

    const snake = createSnake(1, [
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
        { x: 1, y: 2 }
    ]);

    snake.direction = { x: -1, y: 0 };

    map.snakes.set(1, snake);

    const movements = map.getNextMovements();
    const collisions = map.infoSelfCollisions(movements, new Set());

    assert.equal(collisions.length, 0);
});

// Detecta cuando una serpiente sale de los límites.
test('infoEdgeCollisions: detecta colisión con los bordes', () => {
    const map = createMap(5, 5);

    const snake = createSnake(1, [{ x: 4, y: 2 }]);

    map.snakes.set(1, snake);

    const movements = map.getNextMovements();
    const collisions = map.infoEdgeCollisions(movements);

    assert.equal(collisions.length, 1);
});

// Detecta cuando una serpiente entra en el cuerpo de otra.
test('infoBodyCollisions: detecta colisión con otra serpiente', () => {
    const map = createMap();

    const snake1 = createSnake(1, [{ x: 2, y: 2 }]);
    const snake2 = createSnake(2, [
        { x: 3, y: 3 },
        { x: 3, y: 2 },
        { x: 4, y: 2 }
    ]);

    map.snakes.set(1, snake1);
    map.snakes.set(2, snake2);

    const movements = map.getNextMovements();
    const collisions = map.infoBodyCollisions(movements, new Set());

    assert.equal(collisions.length, 1);
});

// Comprueba que infoCollisions agrupe las colisiones.
test('infoCollisions: agrupa los diferentes tipos de colisión', () => {
    const map = createMap(5, 5);

    const snake1 = createSnake(1, [{ x: 4, y: 2 }]);
    const snake2 = createSnake(2, [{ x: 2, y: 2 }]);

    map.snakes.set(1, snake1);
    map.snakes.set(2, snake2);

    const movements = map.getNextMovements();
    const growingSnakes = map.getGrowingSnakes(movements);

    const collisions = map.infoCollisions(movements, growingSnakes);

    assert.ok(Array.isArray(collisions.head));
    assert.ok(Array.isArray(collisions.self));
    assert.ok(Array.isArray(collisions.edge));
    assert.ok(Array.isArray(collisions.body));
    assert.ok(Array.isArray(collisions.all));
});

// Comprueba que update aplique la penalización una sola vez.
test('update: aplica penalización a una serpiente que colisiona', () => {
    const map = createMap(5, 5);

    const snake = createSnake(1, [{ x: 4, y: 2 }]);

    map.snakes.set(1, snake);

    const events = map.update();

    assert.equal(snake.penalty, map.collisionPenalty);

    assert.ok(
        events.some(event => event.type === 'collision')
    );
});

// Comprueba que update mueva las serpientes sin colisiones.
test('update: mueve una serpiente sin colisiones', () => {
    const map = createMap();

    const snake = createSnake(1, [{ x: 2, y: 2 }]);

    map.snakes.set(1, snake);

    map.update();

    assert.deepEqual(snake.head, { x: 3, y: 2 });
});

// Comprueba el consumo de comida.
test('update: procesa el consumo de comida', () => {
    const map = createMap();

    const snake = createSnake(1, [{ x: 2, y: 2 }]);

    map.snakes.set(1, snake);
    map.food.push({ x: 3, y: 2 });

    const events = map.update();

    assert.ok(
        events.some(event => event.type === 'food')
    );

    assert.equal(map.food.some(
        food => food.x === 3 && food.y === 2
    ), false);
});