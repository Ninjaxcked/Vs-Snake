/**
 * Repositorio de resultados de partidas guardado en memoria.
 * Define la interfaz que usará GameRepository (SQLite, commit A8):
 *   saveResult(result), getRanking(), getGameStats(code).
 * Los datos se pierden al reiniciar el servidor; solo sirve mientras no exista la base de datos.
 */
class InMemoryGameRepository {
  /**
   * Objetivo: crear un repositorio vacío.
   * Entradas: ninguna.
   * Salidas: instancia de InMemoryGameRepository.
   * Restricciones: ninguna.
   */
  constructor() {
    this.results = new Map();
  }

  /**
   * Objetivo: guardar el resultado de una partida terminada.
   * Entradas: result (objeto GameResult descrito en docs/protocolo.md).
   * Salidas: ninguna.
   * Restricciones: result.code debe ser único; si ya existe se reemplaza.
   */
  saveResult(result) {
    this.results.set(result.code, structuredClone(result));
  }

  /**
   * Objetivo: obtener el historial de ganadores de todas las partidas jugadas.
   * Entradas: ninguna.
   * Salidas: arreglo de RankingEntry, de la partida más reciente a la más antigua.
   * Restricciones: en un empate, winners contiene a todos los ganadores.
   */
  getRanking() {
    return [...this.results.values()]
      .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
      .map((result) => ({
        code: result.code,
        theme: result.theme,
        mode: result.mode,
        isDraw: result.isDraw,
        winners: result.players
          .filter((player) => result.winners.includes(player.nickname))
          .map(({ nickname, color, length }) => ({ nickname, color, length })),
        endedAt: result.endedAt
      }));
  }

  /**
   * Objetivo: obtener las estadísticas completas de una partida.
   * Entradas: code (string, código de la partida).
   * Salidas: GameResult o null si la partida no existe.
   * Restricciones: ninguna.
   */
  getGameStats(code) {
    const result = this.results.get(code);
    return result ? structuredClone(result) : null;
  }
}

module.exports = { InMemoryGameRepository };
