/**
 * Partida en juego: ciclo de movimiento, veneno, congelamiento y estado para los clientes.
 *
 * El tiempo del juego se cuenta en ticks enteros: un segundo son movesPerSecond ticks.
 * Asi los intervalos del veneno y el congelamiento no dependen de la precision de setInterval
 * ni de sumar decimales, y se pueden probar llamando tick() directamente.
 *
 * Eventos (EventEmitter):
 *   'tick' (events, state)  despues de cada movimiento; events es lo que devolvio GameMap.update().
 */
const { EventEmitter } = require('events');
const { GameMap } = require('./GameMap');

class Game extends EventEmitter {

    /**
     * Objetivo: crear una partida con sus serpientes, la comida inicial y el reloj del juego.
     * Entradas: options {
     *             code (codigo de la partida), theme, mode ({ type: 'time' | 'length', value }),
     *             players ([{ nickname, color }]), config (config.json)
     *           }.
     * Salidas: instancia de Game en estado 'waiting'.
     * Restricciones: al menos 1 jugador; el tablero mide cellsPerPlayer · n por lado.
     *                Lanza error si no hay lugar para alguna serpiente.
     */
    constructor({ code, theme, mode, players, config }) {
        super();
        if (!Array.isArray(players) || players.length === 0) {
            throw new Error('La partida necesita al menos un jugador');
        }
        this.code = code;
        this.theme = theme;
        this.mode = { ...mode };
        this.config = config;
        this.status = 'waiting';
        this.tickCount = 0;
        this.movesPerSecond = config.snake.movesPerSecond;
        this.tickMs = 1000 / this.movesPerSecond;
        this.timer = null;
        this.startedAt = null;

        const size = config.board.cellsPerPlayer * players.length;
        this.map = new GameMap(size, size, 1, {
            foodPerPlayer: config.food.perPlayer,
            maxPoison: config.poison.maxOnBoard,
            collisionPenalty: config.snake.collisionPenalty,
            poisonPenalty: config.poison.lengthPenalty
        });

        this.players = new Map(); // nickname -> { nickname, color, connected, entered, ready }
        for (const { nickname, color } of players) {
            if (!this.map.addPlayer(nickname, nickname, color, config.snake.initialLength)) {
                throw new Error(`No hay lugar para la serpiente de ${nickname}`);
            }
            this.players.set(nickname, { nickname, color, connected: true, entered: false, ready: false });
        }

        this.frozenUntil = new Map(); // nickname -> tick en que se descongela
        this.collisionLog = [];       // quien choco contra quien, en orden
        this.poisonSpawnTicks = this.secondsToTicks(config.poison.spawnIntervalSeconds);
        this.poisonRelocateTicks = this.secondsToTicks(config.poison.relocateIntervalSeconds);
        this.freezeTicks = this.secondsToTicks(config.poison.freezeSeconds);
        this.map.addFood();
    }

    /**
     * Objetivo: convertir segundos del juego a ticks.
     * Entradas: seconds (numero >= 0).
     * Salidas: entero >= 0 (redondeado al tick mas cercano).
     * Restricciones: ninguna.
     */
    secondsToTicks(seconds) {
        return Math.max(0, Math.round(seconds * this.movesPerSecond));
    }

    /**
     * Objetivo: empezar a mover las serpientes movesPerSecond veces por segundo.
     * Entradas: ninguna.
     * Salidas: ninguna.
     * Restricciones: solo desde 'waiting' o 'countdown'; llamar stop() para detener el ciclo.
     */
    start() {
        if (this.status !== 'waiting' && this.status !== 'countdown') return;
        this.status = 'playing';
        this.startedAt = new Date().toISOString();
        this.timer = setInterval(() => this.tick(), this.tickMs);
    }

    /**
     * Objetivo: detener el ciclo del juego.
     * Entradas: ninguna.
     * Salidas: ninguna.
     * Restricciones: la partida queda en 'finished' y ya no acepta movimientos.
     */
    stop() {
        clearInterval(this.timer);
        this.timer = null;
        this.status = 'finished';
    }

    /**
     * Objetivo: recibir el cambio de direccion de un jugador (game:direction).
     * Entradas: nickname, direction ('up' | 'down' | 'left' | 'right').
     * Salidas: true si se acepto.
     * Restricciones: se ignora si la partida no esta en 'playing', si la direccion no es valida,
     *                si es un giro de 180° (con largo > 1) o si la serpiente esta congelada.
     */
    changeDirection(nickname, direction) {
        if (this.status !== 'playing') return false;
        return this.map.identifyKey(nickname, direction);
    }

    /**
     * Objetivo: avanzar un movimiento del juego.
     * Entradas: ninguna.
     * Salidas: arreglo de eventos del movimiento (ver GameMap.update()).
     * Restricciones: solo en 'playing'. Orden: descongelar, mover (choques, comida, veneno),
     *                congelar a quien comio veneno y, por ultimo, hacer aparecer o mover veneno.
     */
    tick() {
        if (this.status !== 'playing') return [];
        this.tickCount += 1;

        for (const [nickname, until] of this.frozenUntil) {
            if (this.tickCount >= until) {
                this.map.snakes.get(nickname).recover();
                this.frozenUntil.delete(nickname);
            }
        }

        const events = this.map.update();

        for (const event of events) {
            const snake = this.map.snakes.get(event.snakeId);
            if (event.type === 'poison') {
                this.frozenUntil.set(event.snakeId, this.tickCount + this.freezeTicks);
            } else if (event.type === 'collision') {
                snake.lastCollision.tick = this.tickCount;
                this.collisionLog.push({
                    tick: this.tickCount,
                    nickname: event.snakeId,
                    type: event.collisionType,
                    with: event.againstId
                });
            }
        }

        if (this.poisonSpawnTicks > 0 && this.tickCount % this.poisonSpawnTicks === 0) {
            this.map.spawnPoison();
        }
        if (this.poisonRelocateTicks > 0 && this.tickCount % this.poisonRelocateTicks === 0) {
            this.map.movePoison();
        }

        this.emit('tick', events, this.toState());
        return events;
    }

    /**
     * Objetivo: segundos que le faltan a una serpiente para descongelarse.
     * Entradas: nickname.
     * Salidas: entero >= 0 (0 si no esta congelada).
     * Restricciones: ninguna.
     */
    frozenSecondsLeft(nickname) {
        const until = this.frozenUntil.get(nickname);
        if (until === undefined) return 0;
        return Math.max(0, Math.ceil((until - this.tickCount) / this.movesPerSecond));
    }

    /**
     * Objetivo: segundos que le faltan a la partida en modo 'time'.
     * Entradas: ninguna.
     * Salidas: entero >= 0, o null en modo 'length'.
     * Restricciones: terminar la partida al llegar a 0 es parte de la condicion de victoria.
     */
    timeLeftSeconds() {
        if (this.mode.type !== 'time') return null;
        return Math.max(0, Math.ceil(this.mode.value * 60 - this.tickCount / this.movesPerSecond));
    }

    /**
     * Objetivo: armar el estado que se envia a los clientes en game:state.
     * Entradas: ninguna.
     * Salidas: objeto GameState (ver docs/protocolo.md).
     * Restricciones: ninguna.
     */
    toState() {
        return {
            code: this.code,
            theme: this.theme,
            mode: { ...this.mode },
            status: this.status,
            tick: this.tickCount,
            board: { width: this.map.columns, height: this.map.rows },
            timeLeftSeconds: this.timeLeftSeconds(),
            players: [...this.players.values()].map((player) => {
                const snake = this.map.snakes.get(player.nickname);
                return {
                    nickname: player.nickname,
                    color: player.color,
                    connected: player.connected,
                    entered: player.entered,
                    ready: player.ready,
                    direction: snake.directionName,
                    length: snake.getLength(),
                    body: snake.body.map(({ x, y }) => ({ x, y, color: player.color })),
                    foodEaten: snake.foodEaten,
                    poisonEaten: snake.poisonEaten,
                    collisions: snake.collisions,
                    stopped: snake.waiting,
                    frozenSecondsLeft: this.frozenSecondsLeft(player.nickname),
                    lastCollision: snake.lastCollision ? { ...snake.lastCollision } : null
                };
            }),
            food: this.map.food.map(({ x, y }) => ({ x, y, color: null })),
            poison: this.map.poison.map(({ x, y }) => ({ x, y }))
        };
    }
}

module.exports = { Game };
