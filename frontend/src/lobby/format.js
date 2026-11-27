/**
 * Textos que se muestran para los datos de una partida (GameSummary).
 */

/** Nombres que se muestran para cada temática de config.themes. */
export const THEME_LABELS = { standard: 'Estándar', fruitMix: 'Fruit Mix' };

/**
 * Objetivo: nombre de una temática para mostrar.
 * Entradas: theme (string de config.themes).
 * Salidas: el nombre en español, o el mismo valor si no se conoce.
 * Restricciones: ninguna.
 */
export function formatTheme(theme) {
  return THEME_LABELS[theme] || theme;
}

/**
 * Objetivo: describir el tipo de partida con su valor.
 * Entradas: mode ({ type: 'time' | 'length', value }).
 * Salidas: por ejemplo 'Por tiempo · 2 min' o 'Por largo · 10 segmentos'.
 * Restricciones: ninguna.
 */
export function formatMode(mode) {
  return mode.type === 'time'
    ? `Por tiempo · ${mode.value} min`
    : `Por largo · ${mode.value} segmentos`;
}
