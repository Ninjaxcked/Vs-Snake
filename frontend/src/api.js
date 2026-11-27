/**
 * Llamadas a la API REST del servidor (/api/*). El formato de cada respuesta está en docs/protocolo.md.
 */
import { SERVER_URL } from './config.js';

/**
 * Objetivo: pedir un recurso JSON a la API del servidor.
 * Entradas: path (ruta después de /api, por ejemplo '/config').
 * Salidas: promesa con el JSON de la respuesta.
 * Restricciones: rechaza la promesa si la red falla o la respuesta no es 2xx.
 */
export async function getJson(path) {
  const res = await fetch(`${SERVER_URL}/api${path}`);
  if (!res.ok) throw new Error(`La API respondió ${res.status}`);
  return res.json();
}

/**
 * Objetivo: obtener los parámetros públicos del juego (temáticas, colores, límites).
 * Entradas: ninguna.
 * Salidas: promesa con un objeto PublicConfig.
 * Restricciones: ver getJson.
 */
export function fetchPublicConfig() {
  return getJson('/config');
}
