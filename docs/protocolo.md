# Protocolo cliente–servidor — Vs Snake

Contrato entre el frontend (React) y el backend (Node + Socket.IO). Si algo cambia aquí,
se cambia en el mismo PR el código de los dos lados.

- Nombres de eventos: `backend/src/protocol/events.js` y `frontend/src/protocol/events.js`
  (deben ser iguales; `npm test` en `backend/` lo verifica).
- Los parámetros (tiempos, penalizaciones, colores…) vienen de `backend/config/config.json`.

## 1. Convenciones

### Respuestas (acknowledgements)

Los eventos que el cliente envía y que necesitan respuesta usan el *callback* de Socket.IO:

```js
socket.emit('lobby:join', { code: 'K7Q2ZD', color: '#1e88e5' }, (res) => {
  if (!res.ok) console.log(res.error.code, res.error.message);
});
```

Toda respuesta es una de estas dos formas:

```js
{ ok: true, ...datos }
{ ok: false, error: { code: 'COLOR_TAKEN', message: 'Ese color ya está en uso' } }
```

### Códigos de error

| Código | Cuándo |
|---|---|
| `INVALID_DATA` | Falta un campo, tiene tipo incorrecto o está fuera de rango. |
| `NOT_LOGGED_IN` | Se envió un evento `lobby:*` o `game:*` sin haber hecho `auth:login`. |
| `NICKNAME_TAKEN` | El nickname ya lo usa otro jugador conectado. |
| `GAME_NOT_FOUND` | No existe una partida con ese código (o ya expiró). |
| `GAME_FULL` | La partida ya tiene todos sus jugadores. |
| `GAME_ALREADY_STARTED` | La partida ya empezó. |
| `COLOR_TAKEN` | Otro jugador de esa partida ya eligió ese color. |
| `ALREADY_IN_GAME` | El jugador ya está en otra partida. |

### Reglas generales

- El servidor **valida todo** lo que llega del cliente; nunca confía en él.
- El estado del juego vive solo en el servidor; el cliente solo dibuja lo que recibe.
- Códigos de partida: 6 caracteres `A-Z0-9` (ej. `K7Q2ZD`).
- Coordenadas: `x` = columna (0 a la izquierda), `y` = fila (0 arriba).
- Fechas: texto ISO 8601 en UTC (ej. `2026-11-24T20:02:00.000Z`).
- Cada partida es una *room* de Socket.IO con el nombre de su código.

## 2. Flujo de una partida

```
auth:check* → auth:login
   ├─ Crear:  lobby:create ──────────────┐
   └─ Unirse: lobby:list → lobby:join ───┤   (todos reciben lobby:update)
                                         ▼
                         sala de espera (lobby:room)
                  ¿expira antes de llenarse? → lobby:cancelled
                                         ▼ partida completa
                game:enter (cada jugador presiona "Entrar")
                                         ▼
           game:ready (cada jugador presiona la tecla u)
                                         ▼ todos listos
             game:countdown 3, 2, 1 → game:start
                                         ▼
          game:direction (flechas) ⇄ game:state (cada tick)
                                         ▼
                                    game:over
```

## 3. Eventos `auth:*`

### `auth:check` — cliente → servidor (con respuesta)

Verifica si un nickname está libre mientras el usuario escribe (el cliente espera ~300 ms entre teclas).

| Envía | Respuesta |
|---|---|
| `{ nickname: string }` | `{ ok: true, available: boolean, reason?: 'INVALID_DATA' \| 'NICKNAME_TAKEN' }` |

### `auth:login` — cliente → servidor (con respuesta)

| Envía | Respuesta |
|---|---|
| `{ nickname: string }` | `{ ok: true, nickname: string }` o error `INVALID_DATA` / `NICKNAME_TAKEN` |

Reglas del nickname:

- 3 a 15 caracteres: letras, dígitos, `_` y `-`. Se quitan espacios al inicio y al final.
- La comparación no distingue mayúsculas: si existe `Ana`, `ana` está ocupado.
- Queda reservado mientras el socket esté conectado; al desconectarse se libera.
- Un socket solo puede hacer login una vez.

## 4. Eventos `lobby:*`

### Objeto `GameSummary`

Describe una partida en espera. Se usa en la lista de partidas y en la sala de espera.

```js
{
  code: 'K7Q2ZD',
  creator: 'ana',
  theme: 'standard',                  // uno de config.themes: 'standard' | 'fruitMix'
  mode: { type: 'time', value: 2 },   // 'time': minutos · 'length': largo objetivo
  maxPlayers: 3,
  players: [ { nickname: 'ana', color: '#e53935' } ],
  usedColors: ['#e53935'],
  status: 'waiting',                  // 'waiting' (hay cupo) | 'full' (completa)
  expiresAt: '2026-11-24T20:03:00.000Z'
}
```

### `lobby:list` — cliente → servidor (con respuesta)

| Envía | Respuesta |
|---|---|
| `{}` | `{ ok: true, games: GameSummary[] }` |

Solo incluye partidas en estado `waiting` o `full` (las que ya empezaron no aparecen).

### `lobby:create` — cliente → servidor (con respuesta)

| Envía | Respuesta |
|---|---|
| `{ mode: { type, value }, theme, maxPlayers, color }` | `{ ok: true, game: GameSummary }` o error |

Validaciones:

- `mode.type`: `'time'` o `'length'`.
- `mode.value`: entero. Con `time` va de `gameModes.time.minMinutes` a `maxMinutes` (1 a 10 minutos);
  con `length`, de `gameModes.length.minTarget` a `maxTarget` (5 a 100 segmentos).
- `theme`: uno de `config.themes`.
- `maxPlayers`: entero entre `config.lobby.minPlayers` (2) y `config.lobby.maxPlayers`.
- `color`: uno de `config.colorPalette`. El creador queda unido a la partida con ese color.
- El servidor genera el código y entra al socket en la room de la partida.
- Si la partida no arranca en `config.lobby.gameExpirationSeconds`, se cancela (`lobby:cancelled`).
  El tiempo corre desde que se crea hasta que empieza, aunque ya esté completa.

### `lobby:join` — cliente → servidor (con respuesta)

| Envía | Respuesta |
|---|---|
| `{ code, color }` | `{ ok: true, game: GameSummary }` o error `GAME_NOT_FOUND`, `GAME_FULL`, `GAME_ALREADY_STARTED`, `COLOR_TAKEN`, `ALREADY_IN_GAME`, `INVALID_DATA` |

El color queda bloqueado para los demás jugadores de esa partida.

### `lobby:leave` — cliente → servidor (con respuesta)

| Envía | Respuesta |
|---|---|
| `{ code }` | `{ ok: true }` o error `GAME_NOT_FOUND` si el jugador no está en esa partida |

Libera el color del jugador. Si la partida queda vacía, se cancela con motivo `'empty'`.
Si un jugador se desconecta mientras está en una partida en espera, el servidor hace lo mismo.

### `lobby:update` — servidor → todos los clientes con login

`{ games: GameSummary[] }`. Es la misma lista que da `lobby:list`. Se envía cada vez que una partida se
crea, cambia de jugadores o colores, se llena, empieza, expira o se elimina.

### `lobby:room` — servidor → jugadores de la partida

`{ game: GameSummary }`. Actualiza la sala de espera. El botón **Entrar** se activa cuando `status === 'full'`.

### `lobby:cancelled` — servidor → jugadores de la partida

`{ code, reason: 'expired' | 'empty' }`. El cliente muestra el aviso y vuelve al menú.

## 5. Eventos `game:*`

### `game:enter` — cliente → servidor (con respuesta)

Cada jugador lo envía al presionar **Entrar** (solo si la partida está completa).

| Envía | Respuesta |
|---|---|
| `{ code }` | `{ ok: true, state: GameState }` o error |

Desde aquí el cliente muestra el tablero. Las flechas no hacen nada todavía.

### `game:ready` — cliente → servidor (sin respuesta)

`{}`. Se envía cuando el jugador presiona la tecla `config.lobby.startKey` (**u**).

**Decisión:** la cuenta regresiva empieza cuando **todos** los jugadores de la partida presionaron **u**.
Mientras tanto, `game:state` muestra quién está listo (`players[i].ready`). Repetir el evento no tiene efecto.

### `game:countdown` — servidor → jugadores de la partida

`{ secondsLeft: 3 }`, luego `2` y `1`, uno por segundo. Lo controla el servidor para que todos lo vean
al mismo tiempo (`config.lobby.startCountdownSeconds`).

### `game:start` — servidor → jugadores de la partida

`{ startedAt }`. Desde este momento el servidor acepta `game:direction`.

### `game:direction` — cliente → servidor (sin respuesta)

`{ direction: 'up' | 'down' | 'left' | 'right' }`.

El servidor lo ignora si:

- la partida no está en `playing`,
- la dirección no es válida,
- es un giro de 180° (si la serpiente mide más de 1),
- o la serpiente está congelada por veneno.

Si la serpiente estaba detenida por un choque, una dirección válida la vuelve a mover.

### `game:state` — servidor → jugadores de la partida

Se envía en cada tick (`config.snake.movesPerSecond` veces por segundo), y también cuando un jugador
entra o presiona **u** antes de empezar.

### Objeto `GameState`

```js
{
  code: 'K7Q2ZD',
  theme: 'standard',
  mode: { type: 'time', value: 2 },
  status: 'waiting',           // 'waiting' (esperando la tecla u) | 'countdown' | 'playing' | 'finished'
  tick: 0,                     // número de movimientos desde game:start
  board: { width: 33, height: 33 },   // 11·n × 11·n con n = número de jugadores
  timeLeftSeconds: 120,        // solo en modo 'time'; null en modo 'length'
  players: [
    {
      nickname: 'ana',
      color: '#e53935',
      connected: true,
      entered: true,           // ya presionó "Entrar"
      ready: false,            // ya presionó la tecla u
      direction: 'right',
      length: 3,
      body: [                  // body[0] es la cabeza
        { x: 10, y: 5, color: '#e53935' },
        { x: 9,  y: 5, color: '#e53935' },
        { x: 8,  y: 5, color: '#e53935' }
      ],
      foodEaten: 0,
      poisonEaten: 0,
      collisions: 0,
      stopped: false,          // true después de chocar, hasta que elija otra dirección
      frozenSecondsLeft: 0,    // > 0 mientras está congelado por veneno
      lastCollision: null      // o { type: 'wall' | 'self' | 'snake' | 'headOn', with: 'beto' | null, tick: 42 }
    }
  ],
  food:   [ { x: 3, y: 7, color: '#43a047' } ],   // con 'fruitMix', color de config.fruitColors
  poison: [ { x: 20, y: 11 } ]
}
```

- Cada segmento lleva su propio `color`. En `standard` todos son del color del jugador. En `fruitMix`,
  cada segmento nuevo toma el color de la comida que se comió.
- Con `lastCollision` y `frozenSecondsLeft` se muestran los avisos de "chocaste" y "congelado".

### `game:over` — servidor → jugadores de la partida

Envía un objeto `GameResult`. Es el mismo que se guarda en la base de datos y el que devuelve
`GET /api/games/:id/stats`.

### Objeto `GameResult`

```js
{
  code: 'K7Q2ZD',
  theme: 'standard',
  mode: { type: 'time', value: 2 },
  isDraw: false,
  winners: ['ana'],            // en un empate hay varios
  players: [                   // ordenados por largo final, de mayor a menor
    { position: 1, nickname: 'ana',  color: '#e53935', length: 9, foodEaten: 8, poisonEaten: 1, collisions: 0 },
    { position: 2, nickname: 'beto', color: '#1e88e5', length: 4, foodEaten: 5, poisonEaten: 2, collisions: 1 }
  ],
  startedAt: '2026-11-24T20:00:00.000Z',
  endedAt:   '2026-11-24T20:02:00.000Z'
}
```

Si hay un empate en largo, los jugadores empatados comparten el mismo `position`.

### Desconexiones

Si un jugador se desconecta durante la partida, se queda en `players` con `connected: false`.
El detalle de qué pasa con su serpiente lo define B9 (`feature/robustez`) y se anota aquí.

## 6. API REST

Todas las rutas empiezan con `/api` y responden JSON. Los errores tienen la forma
`{ error: { code, message } }`.

| Método y ruta | Respuesta |
|---|---|
| `GET /api/health` | `{ status: 'ok' }` |
| `GET /api/config` | `PublicConfig` |
| `GET /api/ranking` | `RankingEntry[]`, de la partida más reciente a la más antigua |
| `GET /api/games/:id/stats` | `GameResult`. Responde `400 INVALID_DATA` si el código no tiene formato válido y `404 GAME_NOT_FOUND` si no existe. Acepta el código en minúsculas. |

### Objeto `RankingEntry`

```js
{
  code: 'K7Q2ZD',
  theme: 'standard',
  mode: { type: 'length', value: 15 },   // 'time' = Tiempo, 'length' = Largo
  isDraw: false,
  winners: [ { nickname: 'ana', color: '#e53935', length: 15 } ],   // todos los ganadores en un empate
  endedAt: '2026-11-24T20:02:00.000Z'
}
```

### Objeto `PublicConfig`

Contiene los parámetros que el cliente necesita para sus formularios:

```js
{
  themes: ['standard', 'fruitMix'],
  colorPalette: ['#e53935', '#1e88e5', ...],
  minPlayers: 2,
  maxPlayers: 8,
  gameExpirationSeconds: 180,
  startKey: 'u',
  startCountdownSeconds: 3,
  gameModes: {
    time:   { defaultMinutes: 2, minMinutes: 1, maxMinutes: 10 },
    length: { defaultTarget: 10, minTarget: 5, maxTarget: 100 }
  }
}
```

### Almacenamiento

Por ahora los resultados se guardan en `InMemoryGameRepository` y se pierden al reiniciar el servidor.
En A8 (`feature/persistencia`) se reemplaza por `GameRepository` (SQLite), que tendrá los mismos
métodos: `saveResult(result)`, `getRanking()` y `getGameStats(code)`.
