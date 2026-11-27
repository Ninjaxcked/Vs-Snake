/**
 * Validación del formulario "Crear partida". Usa los mismos límites que el servidor
 * (PublicConfig de GET /api/config), así el error aparece antes de enviar.
 */

/** Nombres que se muestran para cada temática de config.themes. */
export const THEME_LABELS = { standard: 'Estándar', fruitMix: 'Fruit Mix' };

/**
 * Objetivo: convertir el texto de un campo numérico a entero.
 * Entradas: text (string del input).
 * Salidas: el entero, o null si no es un entero positivo escrito solo con dígitos.
 * Restricciones: ninguna.
 */
function parseInteger(text) {
  const trimmed = String(text).trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Objetivo: obtener el rango permitido para el valor según el tipo de partida.
 * Entradas: type ('time' | 'length'), config (PublicConfig).
 * Salidas: { min, max, defaultValue }.
 * Restricciones: type debe ser 'time' o 'length'.
 */
export function valueRange(type, config) {
  if (type === 'time') {
    const { minMinutes, maxMinutes, defaultMinutes } = config.gameModes.time;
    return { min: minMinutes, max: maxMinutes, defaultValue: defaultMinutes };
  }
  const { minTarget, maxTarget, defaultTarget } = config.gameModes.length;
  return { min: minTarget, max: maxTarget, defaultValue: defaultTarget };
}

/**
 * Objetivo: crear los valores iniciales del formulario.
 * Entradas: config (PublicConfig).
 * Salidas: { type, value, theme, maxPlayers, color } con valores válidos.
 * Restricciones: value y maxPlayers son strings, como en los inputs.
 */
export function initialForm(config) {
  return {
    type: 'time',
    value: String(valueRange('time', config).defaultValue),
    theme: config.themes[0],
    maxPlayers: String(config.minPlayers),
    color: config.colorPalette[0]
  };
}

/**
 * Objetivo: validar el formulario.
 * Entradas: form ({ type, value, theme, maxPlayers, color }), config (PublicConfig).
 * Salidas: objeto con un mensaje por cada campo inválido; vacío si todo es válido.
 * Restricciones: ninguna.
 */
export function validateCreateForm(form, config) {
  const errors = {};

  if (form.type !== 'time' && form.type !== 'length') {
    errors.type = 'Elige el tipo de partida';
  } else {
    const { min, max } = valueRange(form.type, config);
    const value = parseInteger(form.value);
    if (value === null || value < min || value > max) {
      errors.value = form.type === 'time'
        ? `El tiempo debe ser un entero entre ${min} y ${max} minutos`
        : `El largo debe ser un entero entre ${min} y ${max}`;
    }
  }

  if (!config.themes.includes(form.theme)) errors.theme = 'Elige una temática';

  const players = parseInteger(form.maxPlayers);
  if (players === null || players < config.minPlayers || players > config.maxPlayers) {
    errors.maxPlayers = `Deben ser entre ${config.minPlayers} y ${config.maxPlayers} jugadores`;
  }

  if (!config.colorPalette.includes(form.color)) errors.color = 'Elige un color';

  return errors;
}

/**
 * Objetivo: armar los datos que se envían en lobby:create.
 * Entradas: form (ya validado con validateCreateForm).
 * Salidas: { mode: { type, value }, theme, maxPlayers, color }.
 * Restricciones: llamar solo si el formulario es válido.
 */
export function toCreatePayload(form) {
  return {
    mode: { type: form.type, value: Number(form.value) },
    theme: form.theme,
    maxPlayers: Number(form.maxPlayers),
    color: form.color
  };
}
