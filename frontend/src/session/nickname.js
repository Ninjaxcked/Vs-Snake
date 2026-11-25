/**
 * Reglas del nickname (las mismas que valida el servidor; ver docs/protocolo.md).
 */

/** Nickname válido: 3 a 15 caracteres entre letras, dígitos, "_" y "-". */
export const NICKNAME_PATTERN = /^[A-Za-z0-9_-]{3,15}$/;

/**
 * Objetivo: verificar en el cliente si un nickname tiene el formato permitido.
 * Entradas: nickname (string).
 * Salidas: true si es válido (después de quitar espacios), false si no.
 * Restricciones: no verifica si está en uso; eso lo decide el servidor.
 */
export function isValidNickname(nickname) {
  return typeof nickname === 'string' && NICKNAME_PATTERN.test(nickname.trim());
}
