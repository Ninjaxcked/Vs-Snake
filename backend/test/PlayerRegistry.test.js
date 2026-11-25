const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PlayerRegistry } = require('../src/players/PlayerRegistry');

test('registra un nickname libre y lo marca como ocupado', () => {
  const registry = new PlayerRegistry();
  assert.deepEqual(registry.register('s1', 'ana'), { ok: true, nickname: 'ana' });
  assert.deepEqual(registry.check('ana'), { available: false, reason: 'NICKNAME_TAKEN' });
  assert.equal(registry.getNickname('s1'), 'ana');
  assert.equal(registry.getSocketId('ANA'), 's1');
});

test('rechaza el mismo nickname aunque cambien las mayúsculas o haya espacios', () => {
  const registry = new PlayerRegistry();
  registry.register('s1', 'Ana');
  assert.equal(registry.register('s2', 'ana').code, 'NICKNAME_TAKEN');
  assert.equal(registry.register('s3', '  ANA  ').code, 'NICKNAME_TAKEN');
});

test('quita los espacios al inicio y al final', () => {
  const registry = new PlayerRegistry();
  assert.equal(registry.register('s1', '  beto ').nickname, 'beto');
});

test('rechaza nicknames con formato inválido', () => {
  const registry = new PlayerRegistry();
  for (const bad of ['', 'ab', 'a'.repeat(16), 'con espacio', 'ñandú', '<script>', 42, null, undefined, {}]) {
    assert.deepEqual(registry.check(bad), { available: false, reason: 'INVALID_DATA' }, `aceptó ${bad}`);
    assert.equal(registry.register('s', bad).ok, false);
  }
  assert.equal(registry.size, 0);
});

test('acepta letras, dígitos, guion y guion bajo', () => {
  const registry = new PlayerRegistry();
  assert.equal(registry.register('s1', 'Ana_2-x').ok, true);
});

test('un socket no puede iniciar sesión dos veces', () => {
  const registry = new PlayerRegistry();
  registry.register('s1', 'ana');
  assert.equal(registry.register('s1', 'beto').ok, false);
  assert.equal(registry.check('beto').available, true);
});

test('unregister libera el nickname', () => {
  const registry = new PlayerRegistry();
  registry.register('s1', 'ana');
  assert.equal(registry.unregister('s1'), 'ana');
  assert.deepEqual(registry.check('ana'), { available: true });
  assert.equal(registry.getNickname('s1'), null);
  assert.equal(registry.unregister('s1'), null);
});
