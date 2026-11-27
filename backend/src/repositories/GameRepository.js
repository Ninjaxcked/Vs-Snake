/**
 * Repositorio de resultados de partidas guardado en SQLite (better-sqlite3).
 * Tiene los mismos métodos que InMemoryGameRepository:
 *   saveResult(result), getRanking(), getGameStats(code).
 * Los objetos GameResult y RankingEntry están descritos en docs/protocolo.md.
 *
 * Tablas:
 *   games        una fila por partida terminada.
 *   game_players una fila por jugador de cada partida, con sus estadísticas.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS games (
    code        TEXT PRIMARY KEY,
    theme       TEXT NOT NULL,
    mode_type   TEXT NOT NULL CHECK (mode_type IN ('time', 'length')),
    mode_value  INTEGER NOT NULL,
    is_draw     INTEGER NOT NULL CHECK (is_draw IN (0, 1)),
    started_at  TEXT NOT NULL,
    ended_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_players (
    game_code     TEXT NOT NULL REFERENCES games(code) ON DELETE CASCADE,
    position      INTEGER NOT NULL,
    nickname      TEXT NOT NULL,
    color         TEXT NOT NULL,
    length        INTEGER NOT NULL,
    food_eaten    INTEGER NOT NULL,
    poison_eaten  INTEGER NOT NULL,
    collisions    INTEGER NOT NULL,
    is_winner     INTEGER NOT NULL CHECK (is_winner IN (0, 1)),
    PRIMARY KEY (game_code, nickname)
  );

  CREATE INDEX IF NOT EXISTS idx_games_ended_at ON games(ended_at);
`;

class GameRepository {
  /**
   * Objetivo: abrir (o crear) la base de datos y sus tablas.
   * Entradas: filename (ruta del archivo .sqlite, o ':memory:' para una base temporal).
   * Salidas: instancia de GameRepository.
   * Restricciones: crea la carpeta del archivo si no existe. Llamar close() al apagar el servidor.
   */
  constructor(filename) {
    if (filename !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    }
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA);

    this.statements = {
      deleteGame: this.db.prepare('DELETE FROM games WHERE code = ?'),
      insertGame: this.db.prepare(`
        INSERT INTO games (code, theme, mode_type, mode_value, is_draw, started_at, ended_at)
        VALUES (@code, @theme, @modeType, @modeValue, @isDraw, @startedAt, @endedAt)
      `),
      insertPlayer: this.db.prepare(`
        INSERT INTO game_players
          (game_code, position, nickname, color, length, food_eaten, poison_eaten, collisions, is_winner)
        VALUES
          (@gameCode, @position, @nickname, @color, @length, @foodEaten, @poisonEaten, @collisions, @isWinner)
      `),
      selectGame: this.db.prepare('SELECT * FROM games WHERE code = ?'),
      selectGames: this.db.prepare('SELECT * FROM games ORDER BY ended_at DESC, rowid DESC'),
      selectPlayers: this.db.prepare(
        'SELECT * FROM game_players WHERE game_code = ? ORDER BY position, nickname'
      ),
      selectWinners: this.db.prepare(`
        SELECT game_code, nickname, color, length FROM game_players
        WHERE is_winner = 1 ORDER BY game_code, position, nickname
      `)
    };

    // Guarda la partida y sus jugadores juntos: o se guarda todo o nada.
    this.saveTransaction = this.db.transaction((result) => {
      const winners = new Set(result.winners);
      this.statements.deleteGame.run(result.code);
      this.statements.insertGame.run({
        code: result.code,
        theme: result.theme,
        modeType: result.mode.type,
        modeValue: result.mode.value,
        isDraw: result.isDraw ? 1 : 0,
        startedAt: result.startedAt,
        endedAt: result.endedAt
      });
      for (const player of result.players) {
        this.statements.insertPlayer.run({
          gameCode: result.code,
          position: player.position,
          nickname: player.nickname,
          color: player.color,
          length: player.length,
          foodEaten: player.foodEaten,
          poisonEaten: player.poisonEaten,
          collisions: player.collisions,
          isWinner: winners.has(player.nickname) ? 1 : 0
        });
      }
    });
  }

  /**
   * Objetivo: guardar el resultado de una partida terminada.
   * Entradas: result (objeto GameResult descrito en docs/protocolo.md).
   * Salidas: ninguna.
   * Restricciones: result.code debe ser único; si ya existe se reemplaza.
   *                Lanza error si faltan datos obligatorios (no guarda nada en ese caso).
   */
  saveResult(result) {
    this.saveTransaction(result);
  }

  /**
   * Objetivo: obtener el historial de ganadores de todas las partidas jugadas.
   * Entradas: ninguna.
   * Salidas: arreglo de RankingEntry, de la partida más reciente a la más antigua.
   * Restricciones: en un empate, winners contiene a todos los ganadores.
   */
  getRanking() {
    const winnersByGame = new Map();
    for (const row of this.statements.selectWinners.all()) {
      if (!winnersByGame.has(row.game_code)) winnersByGame.set(row.game_code, []);
      winnersByGame.get(row.game_code).push({ nickname: row.nickname, color: row.color, length: row.length });
    }
    return this.statements.selectGames.all().map((game) => ({
      code: game.code,
      theme: game.theme,
      mode: { type: game.mode_type, value: game.mode_value },
      isDraw: game.is_draw === 1,
      winners: winnersByGame.get(game.code) ?? [],
      endedAt: game.ended_at
    }));
  }

  /**
   * Objetivo: obtener las estadísticas completas de una partida.
   * Entradas: code (string, código de la partida).
   * Salidas: GameResult o null si la partida no existe.
   * Restricciones: ninguna.
   */
  getGameStats(code) {
    const game = this.statements.selectGame.get(code);
    if (!game) return null;
    const players = this.statements.selectPlayers.all(code);
    return {
      code: game.code,
      theme: game.theme,
      mode: { type: game.mode_type, value: game.mode_value },
      isDraw: game.is_draw === 1,
      winners: players.filter((p) => p.is_winner === 1).map((p) => p.nickname),
      players: players.map((p) => ({
        position: p.position,
        nickname: p.nickname,
        color: p.color,
        length: p.length,
        foodEaten: p.food_eaten,
        poisonEaten: p.poison_eaten,
        collisions: p.collisions
      })),
      startedAt: game.started_at,
      endedAt: game.ended_at
    };
  }

  /**
   * Objetivo: cerrar la conexión con la base de datos.
   * Entradas: ninguna.
   * Salidas: ninguna.
   * Restricciones: después de close() el repositorio ya no se puede usar.
   */
  close() {
    if (this.db.open) this.db.close();
  }
}

module.exports = { GameRepository };
