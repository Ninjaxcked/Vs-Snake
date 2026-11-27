const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { Snake } = require('../src/modules/Snake');
const { GameMap } = require('../src/modules/GameMap');
const { Game } = require('../src/modules/Game');

/**
 * Pruebas con la clase Snake real (map.test.js usa una serpiente falsa).
 */
describe('Snake', () => {
  test('move avanza una celda y mantiene el largo', () => {
    const snake = new Snake('a', 'Ana', '#e53935', { x: 5, y: 5 }, 'right', 3);
    snake.move();
    assert.deepEqual(snake.head, { x: 6, y: 5 });
    assert.equal(snake.getLength(), 3);
  });

  test('move(true) crece hacia adelante', () => {
    const snake = new Snake('a', 'Ana', '#e53935', { x: 5, y: 5 }, 'right', 1);
    snake.move(true);
    assert.deepEqual(snake.head, { x: 6, y: 5 });
    assert.equal(snake.getLength(), 2);
  });

  test('calculateNextMovement usa la dirección nueva, igual que move', () => {
    const snake = new Snake('a', 'Ana', '#e53935', { x: 5, y: 5 }, 'right', 1);
    snake.setDirection('down');
    const next = snake.calculateNextMovement();
    snake.move();
    assert.deepEqual(next, { x: 5, y: 6 });
    assert.deepEqual(snake.head, next);
  });

  test('no permite giros de 180°', () => {
    const snake = new Snake('a', 'Ana', '#e53935', { x: 5, y: 5 }, 'right', 2);
    assert.equal(snake.setDirection('left'), false);
  });

  test('applyPenalty y eatPoison nunca dejan la serpiente sin cabeza', () => {
    const snake = new Snake('a', 'Ana', '#e53935', { x: 5, y: 5 }, 'right', 2);
    assert.equal(snake.applyPenalty(5), 1);
    assert.equal(snake.getLength(), 1);
    snake.eatPoison();
    assert.equal(snake.getLength(), 1);
    assert.ok(snake.head);
  });

  test('resetMovement la detiene hasta que se elige una dirección', () => {
    const snake = new Snake('a', 'Ana', '#e53935', { x: 5, y: 5 }, 'right', 1);
    snake.resetMovement();
    snake.move();
    assert.deepEqual(snake.head, { x: 5, y: 5 });
    snake.setDirection('up');
    snake.move();
    assert.deepEqual(snake.head, { x: 5, y: 4 });
  });

  test('eatFood suma puntos', () => {
    const snake = new Snake('a', 'Ana', '#e53935', { x: 5, y: 5 }, 'right', 1);
    snake.eatFood(1);
    assert.equal(snake.score, 1);
  });
});

describe('GameMap con serpientes reales', () => {
  test('update corre muchos turnos sin errores y mantiene la comida', () => {
    const map = new GameMap(22, 22, 1, { collisionPenalty: 2 });
    assert.ok(map.addPlayer('a', 'Ana', '#e53935'));
    assert.ok(map.addPlayer('b', 'Beto', '#1e88e5'));
    map.addFood();
    const keys = ['up', 'down', 'left', 'right'];
    for (let turn = 0; turn < 300; turn += 1) {
      map.identifyKey('a', keys[turn % 4]);
      map.identifyKey('b', keys[(turn + 1) % 4]);
      map.update();
      assert.equal(map.food.length, 2);
      for (const snake of map.snakes.values()) assert.ok(snake.getLength() >= 1);
    }
  });

  test('al comer, la serpiente real crece 1', () => {
    const map = new GameMap(10, 10);
    const snake = new Snake('a', 'Ana', '#e53935', { x: 2, y: 2 }, 'right', 1);
    map.snakes.set('a', snake);
    map.food.push({ x: 3, y: 2 });
    map.update();
    assert.equal(snake.getLength(), 2);
    assert.equal(snake.score, 1);
  });

  test('chocar contra la cabeza de una serpiente detenida cuenta como choque', () => {
    const map = new GameMap(10, 10);
    const moving = new Snake('a', 'Ana', '#e53935', { x: 2, y: 2 }, 'right', 1);
    const stopped = new Snake('b', 'Beto', '#1e88e5', { x: 3, y: 2 }, 'up', 1);
    stopped.resetMovement();
    map.snakes.set('a', moving);
    map.snakes.set('b', stopped);
    const events = map.update();
    assert.ok(events.some((e) => e.type === 'collision' && e.snakeId === 'a'));
    assert.deepEqual(moving.head, { x: 2, y: 2 });
  });
});

describe('Game', () => {
  test('se puede crear y guarda el modo', () => {
    const game = new Game({ type: 'time', value: 2 }, 2);
    assert.equal(game.get_active(), true);
    assert.deepEqual(game.modo, { type: 'time', value: 2 });
  });
});
