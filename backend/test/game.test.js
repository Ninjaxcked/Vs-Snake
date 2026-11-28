/**
 * Pruebas del motor del juego: ciclo de juego (B2), choques (B3) y veneno con contadores (B4).
 */
const { describe, test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const baseConfig = require('../config/config.json');
const { Game } = require('../src/modules/Game');
const { GameMap } = require('../src/modules/GameMap');
const { Snake } = require('../src/modules/Snake');

/**
 * Objetivo: copiar config.json cambiando solo algunas secciones.
 * Entradas: overrides ({ seccion: { campo: valor } }).
 * Salidas: configuración nueva.
 * Restricciones: no modifica config.json.
 */
function makeConfig(overrides = {}) {
  const config = structuredClone(baseConfig);
  for (const [section, values] of Object.entries(overrides)) {
    config[section] = { ...config[section], ...values };
  }
  return config;
}

/**
 * Objetivo: crear una partida de prueba.
 * Entradas: options.players (cantidad), options.config (overrides de makeConfig), options.mode.
 * Salidas: Game en estado 'playing' sin iniciar el setInterval (se avanza con tick()).
 * Restricciones: ninguna.
 */
function makeGame({ players = 2, config = {}, mode = { type: 'time', value: 2 } } = {}) {
  const colors = baseConfig.colorPalette;
  const game = new Game({
    code: 'TEST01',
    theme: 'standard',
    mode,
    players: Array.from({ length: players }, (_, i) => ({ nickname: `p${i + 1}`, color: colors[i] })),
    config: makeConfig(config)
  });
  game.status = 'playing';
  return game;
}

/**
 * Objetivo: poner una serpiente en una posición exacta (las de la partida aparecen al azar).
 * Entradas: target (Game o GameMap), id, body (celdas, la cabeza primero), direction.
 * Salidas: la Snake colocada.
 * Restricciones: reemplaza la serpiente que tenía ese id.
 */
function place(target, id, body, direction) {
  const map = target instanceof Game ? target.map : target;
  const snake = new Snake(id, id, '#e53935', body[0], direction, 1);
  snake.body = body.map((cell) => ({ ...cell }));
  map.snakes.set(id, snake);
  return snake;
}

/**
 * Objetivo: crear un mapa vacío para probar choques, sin comida ni veneno que aparezcan solos.
 * Entradas: size (lado del tablero).
 * Salidas: GameMap con collisionPenalty de config.json.
 * Restricciones: ninguna.
 */
function emptyMap(size = 10) {
  return new GameMap(size, size, 1, {
    foodPerPlayer: 0,
    maxPoison: 0,
    collisionPenalty: baseConfig.snake.collisionPenalty
  });
}

const NO_POISON = { poison: { spawnIntervalSeconds: 10000, relocateIntervalSeconds: 10000 } };
const NO_FOOD = { food: { perPlayer: 0 } };

afterEach(() => mock.timers.reset());

describe('B2 · ciclo de juego', () => {
  test('el tablero mide 11n × 11n', () => {
    assert.deepEqual(makeGame({ players: 2 }).toState().board, { width: 22, height: 22 });
    assert.deepEqual(makeGame({ players: 3 }).toState().board, { width: 33, height: 33 });
  });

  test('las serpientes aparecen sin chocar en el primer movimiento', () => {
    for (let i = 0; i < 50; i += 1) {
      const game = makeGame({ players: 4, config: NO_POISON });
      const events = game.tick();
      assert.equal(events.filter((e) => e.type === 'collision').length, 0);
    }
  });

  test('start() avanza movesPerSecond veces por segundo', () => {
    mock.timers.enable({ apis: ['setInterval'] });
    const game = makeGame({ config: { ...NO_POISON, snake: { movesPerSecond: 3 } } });
    game.status = 'waiting';
    game.start();
    assert.equal(game.status, 'playing');
    mock.timers.tick(1000);
    assert.equal(game.tickCount, 3);
    mock.timers.tick(2000);
    assert.equal(game.tickCount, 9);
    game.stop();
    mock.timers.tick(1000);
    assert.equal(game.tickCount, 9);
    assert.equal(game.status, 'finished');
  });

  test('cada tick emite el evento y el estado', () => {
    const game = makeGame({ config: NO_POISON });
    let received = null;
    game.on('tick', (events, state) => { received = state; });
    game.tick();
    assert.equal(received.tick, 1);
    assert.equal(received.status, 'playing');
  });

  test('al comer, la serpiente crece 1 hacia adelante y aparece comida nueva', () => {
    const game = makeGame({ config: NO_POISON });
    const snake = place(game, 'p1', [{ x: 5, y: 5 }, { x: 4, y: 5 }], 'right');
    place(game, 'p2', [{ x: 15, y: 15 }], 'left');
    game.map.food = [{ x: 6, y: 5 }, { x: 0, y: 20 }];

    const events = game.tick();

    assert.ok(events.some((e) => e.type === 'food' && e.snakeId === 'p1'));
    assert.equal(snake.getLength(), 3);
    assert.deepEqual(snake.body, [{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }]);
    assert.equal(game.map.food.length, 2);
    assert.ok(!game.map.food.some((f) => f.x === 6 && f.y === 5));
  });

  test('siempre hay n comidas en el tablero (una por jugador)', () => {
    for (const players of [2, 3, 4]) {
      const game = makeGame({ players });
      const keys = ['up', 'right', 'down', 'left'];
      for (let t = 0; t < 300; t += 1) {
        for (let p = 1; p <= players; p += 1) game.changeDirection(`p${p}`, keys[(t + p) % 4]);
        game.tick();
        assert.equal(game.map.food.length, players * baseConfig.food.perPlayer);
      }
    }
  });

  test('cambiar de dirección: sin giros de 180° y solo mientras se juega', () => {
    const game = makeGame({ config: { ...NO_POISON, ...NO_FOOD } });
    place(game, 'p1', [{ x: 5, y: 5 }, { x: 4, y: 5 }], 'right');
    assert.equal(game.changeDirection('p1', 'left'), false);
    assert.equal(game.changeDirection('p1', 'diagonal'), false);
    assert.equal(game.changeDirection('p1', 'up'), true);
    game.tick();
    assert.deepEqual(game.map.snakes.get('p1').head, { x: 5, y: 4 });

    game.status = 'waiting';
    assert.equal(game.changeDirection('p1', 'right'), false);
  });

  test('toState tiene la forma de GameState del protocolo', () => {
    const state = makeGame().toState();
    assert.deepEqual(Object.keys(state).sort(), [
      'board', 'code', 'food', 'mode', 'players', 'poison', 'status', 'theme', 'tick', 'timeLeftSeconds'
    ]);
    assert.deepEqual(Object.keys(state.players[0]).sort(), [
      'body', 'collisions', 'color', 'connected', 'direction', 'entered', 'foodEaten', 'frozenSecondsLeft',
      'lastCollision', 'length', 'nickname', 'poisonEaten', 'ready', 'stopped'
    ]);
    assert.equal(state.timeLeftSeconds, 120);
    assert.equal(makeGame({ mode: { type: 'length', value: 10 } }).toState().timeLeftSeconds, null);
  });
});

describe('B3 · choques', () => {
  const penalty = baseConfig.snake.collisionPenalty;

  test('contra el borde: pierde collisionPenalty y queda detenida hasta elegir dirección', () => {
    const map = emptyMap(10);
    const snake = place(map, 'a', [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }, { x: 6, y: 5 }], 'right');

    const [event] = map.update();
    assert.equal(event.collisionType, 'wall');
    assert.equal(event.againstId, null);
    assert.equal(snake.getLength(), 4 - penalty);
    assert.equal(snake.waiting, true);

    map.update();
    assert.deepEqual(snake.head, { x: 9, y: 5 }, 'detenida: no se mueve');
    assert.equal(snake.collisions, 1, 'detenida: no vuelve a chocar');

    snake.setDirection('up');
    map.update();
    assert.deepEqual(snake.head, { x: 9, y: 4 });
  });

  test('contra sí misma', () => {
    const map = emptyMap(10);
    const snake = place(map, 'a', [
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }
    ], 'left');
    snake.setDirection('down');

    const [event] = map.update();
    assert.equal(event.collisionType, 'self');
    assert.equal(snake.getLength(), 5 - penalty);
  });

  test('contra otra serpiente: solo se penaliza a la que choca', () => {
    const map = emptyMap(10);
    const a = place(map, 'a', [{ x: 2, y: 5 }, { x: 1, y: 5 }, { x: 0, y: 5 }], 'right');
    const b = place(map, 'b', [{ x: 3, y: 4 }, { x: 3, y: 5 }, { x: 3, y: 6 }], 'up');

    const events = map.update();
    const collisions = events.filter((e) => e.type === 'collision');
    assert.equal(collisions.length, 1);
    assert.equal(collisions[0].snakeId, 'a');
    assert.equal(collisions[0].collisionType, 'snake');
    assert.equal(collisions[0].againstId, 'b');
    assert.equal(a.getLength(), 3 - penalty);
    assert.equal(b.getLength(), 3);
    assert.deepEqual(b.head, { x: 3, y: 3 }, 'la otra sigue moviéndose');
  });

  test('de frente (misma celda): se penaliza a las dos', () => {
    const map = emptyMap(10);
    const a = place(map, 'a', [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }], 'right');
    const b = place(map, 'b', [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }], 'left');

    const collisions = map.update().filter((e) => e.type === 'collision');
    assert.equal(collisions.length, 2);
    assert.ok(collisions.every((e) => e.collisionType === 'headOn'));
    assert.deepEqual(a.lastCollision, { type: 'headOn', with: 'b' });
    assert.deepEqual(b.lastCollision, { type: 'headOn', with: 'a' });
    assert.equal(a.getLength(), 3 - penalty);
    assert.equal(b.getLength(), 3 - penalty);
  });

  test('de frente (cruzándose): se penaliza a las dos', () => {
    const map = emptyMap(10);
    const a = place(map, 'a', [{ x: 4, y: 5 }, { x: 3, y: 5 }], 'right');
    const b = place(map, 'b', [{ x: 5, y: 5 }, { x: 6, y: 5 }], 'left');

    map.update();
    assert.equal(a.lastCollision.type, 'headOn');
    assert.equal(b.lastCollision.type, 'headOn');
  });

  test('en cadena: si la de adelante choca y no avanza, la de atrás choca con ella', () => {
    const map = emptyMap(10);
    // b va hacia el borde; a pensaba entrar en la celda que libera la cola de b.
    const b = place(map, 'b', [{ x: 9, y: 5 }, { x: 8, y: 5 }], 'right');
    const a = place(map, 'a', [{ x: 7, y: 5 }, { x: 6, y: 5 }], 'right');

    map.update();
    assert.equal(b.lastCollision.type, 'wall');
    assert.deepEqual(a.lastCollision, { type: 'snake', with: 'b' });
    assert.deepEqual(a.head, { x: 7, y: 5 });
  });

  test('la partida registra quién chocó contra quién y en qué tick', () => {
    const game = makeGame({ config: { ...NO_POISON, ...NO_FOOD } });
    place(game, 'p1', [{ x: 2, y: 5 }, { x: 1, y: 5 }], 'right');
    place(game, 'p2', [{ x: 3, y: 4 }, { x: 3, y: 5 }, { x: 3, y: 6 }], 'left');
    game.map.snakes.get('p2').resetMovement(); // p2 quieta: p1 choca contra ella

    game.tick();
    assert.deepEqual(game.collisionLog, [{ tick: 1, nickname: 'p1', type: 'snake', with: 'p2' }]);
    const p1 = game.toState().players.find((p) => p.nickname === 'p1');
    assert.deepEqual(p1.lastCollision, { type: 'snake', with: 'p2', tick: 1 });
    assert.equal(p1.collisions, 1);
    assert.equal(p1.stopped, true);
  });
});

describe('B4 · veneno y contadores', () => {
  test('aparece un veneno cada spawnIntervalSeconds', () => {
    // 3 movimientos por segundo y veneno cada 5 s: uno cada 15 ticks.
    const game = makeGame({
      config: { snake: { movesPerSecond: 3 }, poison: { spawnIntervalSeconds: 5, relocateIntervalSeconds: 10000, maxOnBoard: 3 } }
    });
    for (let t = 0; t < 14; t += 1) game.tick();
    assert.equal(game.map.poison.length, 0);
    game.tick();
    assert.equal(game.map.poison.length, 1);
    for (let t = 0; t < 15; t += 1) game.tick();
    assert.equal(game.map.poison.length, 2);
  });

  test('nunca hay más veneno que maxOnBoard', () => {
    const game = makeGame({
      players: 3,
      config: { poison: { spawnIntervalSeconds: 1, relocateIntervalSeconds: 2, maxOnBoard: 3 } }
    });
    const keys = ['up', 'right', 'down', 'left'];
    for (let t = 0; t < 600; t += 1) {
      for (let p = 1; p <= 3; p += 1) game.changeDirection(`p${p}`, keys[(t * p) % 4]);
      game.tick();
      assert.ok(game.map.poison.length <= 3, `tick ${t}: ${game.map.poison.length} venenos`);
    }
    assert.equal(game.map.poison.length, 3);
  });

  test('el veneno se mueve de lugar cada relocateIntervalSeconds', () => {
    const game = makeGame({
      config: { ...NO_FOOD, snake: { movesPerSecond: 3 }, poison: { spawnIntervalSeconds: 10000, relocateIntervalSeconds: 2, maxOnBoard: 3 } }
    });
    game.map.poison = [{ x: 0, y: 0 }, { x: 21, y: 21 }];
    for (let t = 0; t < 5; t += 1) game.tick();
    assert.deepEqual(game.map.poison, [{ x: 0, y: 0 }, { x: 21, y: 21 }], 'antes de 2 s no se mueve');
    game.tick(); // 6 ticks = 2 s
    assert.equal(game.map.poison.length, 2);
    assert.notDeepEqual(game.map.poison, [{ x: 0, y: 0 }, { x: 21, y: 21 }]);
  });

  test('al comer veneno pierde 1 segmento y se congela freezeSeconds; las flechas no la mueven', () => {
    // 3 movimientos por segundo y 2 s congelada = 6 ticks sin moverse.
    const game = makeGame({
      config: { ...NO_POISON, ...NO_FOOD, snake: { movesPerSecond: 3 }, poison: { freezeSeconds: 2, lengthPenalty: 1 } }
    });
    const snake = place(game, 'p1', [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], 'right');
    place(game, 'p2', [{ x: 15, y: 15 }], 'left');
    game.map.snakes.get('p2').resetMovement();
    game.map.poison = [{ x: 6, y: 5 }];

    const events = game.tick();
    assert.ok(events.some((e) => e.type === 'poison' && e.snakeId === 'p1'));
    assert.equal(snake.getLength(), 2);
    assert.deepEqual(snake.head, { x: 6, y: 5 });
    assert.equal(game.map.poison.length, 0);
    assert.equal(game.toState().players[0].frozenSecondsLeft, 2);

    for (let t = 0; t < 5; t += 1) {
      assert.equal(game.changeDirection('p1', 'up'), false, 'congelada: ignora las flechas');
      game.tick();
      assert.deepEqual(snake.head, { x: 6, y: 5 }, `tick ${t + 2}: sigue quieta`);
    }
    assert.equal(game.toState().players[0].frozenSecondsLeft, 1);

    game.tick(); // pasaron los 2 s: se descongela y avanza en este tick
    assert.deepEqual(snake.head, { x: 7, y: 5 });
    assert.equal(game.toState().players[0].frozenSecondsLeft, 0);
    assert.equal(game.changeDirection('p1', 'up'), true);
  });

  test('cuenta cuánta comida y cuánto veneno come cada jugador', () => {
    const game = makeGame({ config: { ...NO_POISON, ...NO_FOOD, poison: { freezeSeconds: 0 } } });
    place(game, 'p1', [{ x: 2, y: 5 }], 'right');
    place(game, 'p2', [{ x: 15, y: 15 }], 'left');
    game.map.snakes.get('p2').resetMovement();
    game.map.food = [{ x: 3, y: 5 }, { x: 4, y: 5 }];
    game.map.poison = [{ x: 5, y: 5 }];

    game.tick();
    game.tick();
    game.tick();

    const [p1, p2] = game.toState().players;
    assert.equal(p1.foodEaten, 2);
    assert.equal(p1.poisonEaten, 1);
    assert.equal(p1.length, 2); // 1 + 2 comidas - 1 veneno
    assert.equal(p2.foodEaten, 0);
    assert.equal(p2.poisonEaten, 0);
  });
});
