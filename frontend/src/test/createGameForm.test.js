/**
 * Pruebas de la validación del formulario "Crear partida".
 */
import { describe, expect, test } from 'vitest';
import { initialForm, toCreatePayload, validateCreateForm } from '../lobby/createGameForm.js';

const config = {
  themes: ['standard', 'fruitMix'],
  colorPalette: ['#e53935', '#1e88e5'],
  minPlayers: 2,
  maxPlayers: 8,
  gameExpirationSeconds: 180,
  gameModes: {
    time: { defaultMinutes: 2, minMinutes: 1, maxMinutes: 10 },
    length: { defaultTarget: 10, minTarget: 5, maxTarget: 100 }
  }
};

describe('validateCreateForm', () => {
  test('los valores iniciales son válidos', () => {
    expect(validateCreateForm(initialForm(config), config)).toEqual({});
  });

  test.each([
    ['0', 'tiempo menor al mínimo'],
    ['11', 'tiempo mayor al máximo'],
    ['2.5', 'decimales'],
    ['', 'vacío'],
    ['-3', 'negativo']
  ])('por tiempo rechaza %s (%s)', (value) => {
    const errors = validateCreateForm({ ...initialForm(config), value }, config);
    expect(errors.value).toMatch(/entre 1 y 10 minutos/);
  });

  test('por largo usa los límites de largo', () => {
    const base = { ...initialForm(config), type: 'length' };
    expect(validateCreateForm({ ...base, value: '4' }, config).value).toMatch(/entre 5 y 100/);
    expect(validateCreateForm({ ...base, value: '100' }, config)).toEqual({});
  });

  test('mínimo 2 jugadores y máximo maxPlayers', () => {
    const base = initialForm(config);
    expect(validateCreateForm({ ...base, maxPlayers: '1' }, config).maxPlayers).toBeDefined();
    expect(validateCreateForm({ ...base, maxPlayers: '9' }, config).maxPlayers).toBeDefined();
    expect(validateCreateForm({ ...base, maxPlayers: '8' }, config)).toEqual({});
  });

  test('rechaza temática y color que no están en la configuración', () => {
    const errors = validateCreateForm({ ...initialForm(config), theme: 'x', color: '#000000' }, config);
    expect(errors.theme).toBeDefined();
    expect(errors.color).toBeDefined();
  });
});

test('toCreatePayload convierte los números', () => {
  const form = { type: 'length', value: '20', theme: 'fruitMix', maxPlayers: '3', color: '#1e88e5' };
  expect(toCreatePayload(form)).toEqual({
    mode: { type: 'length', value: 20 },
    theme: 'fruitMix',
    maxPlayers: 3,
    color: '#1e88e5'
  });
});
