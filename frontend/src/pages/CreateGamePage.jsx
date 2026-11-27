import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request, useSession } from '../session/SessionContext.jsx';
import { EVENTS } from '../protocol/events.js';
import useServerConfig from '../hooks/useServerConfig.js';
import useCountdown, { formatSeconds } from '../hooks/useCountdown.js';
import ColorPicker from '../components/ColorPicker.jsx';
import {
  THEME_LABELS,
  initialForm,
  toCreatePayload,
  validateCreateForm,
  valueRange
} from '../lobby/createGameForm.js';

/** Mensaje que se muestra según el motivo de lobby:cancelled. */
const CANCEL_MESSAGES = {
  expired: 'La partida se canceló porque no se completó a tiempo.',
  empty: 'La partida se canceló porque quedó vacía.'
};

/**
 * Objetivo: pantalla de la opción "Crear partida".
 * Entradas: ninguna (usa la sesión y GET /api/config).
 * Salidas: el formulario; al crear, el código de la partida y el tiempo que falta para que expire;
 *          si se cancela, el aviso de cancelación.
 * Restricciones: requiere sesión (ruta protegida). Si el jugador sale de la pantalla
 *                antes de que la partida empiece, sale de la partida (lobby:leave).
 */
export default function CreateGamePage() {
  const { socket } = useSession();
  const navigate = useNavigate();
  const { config, error, retry } = useServerConfig();
  const [game, setGame] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [cancelReason, setCancelReason] = useState(null);
  const gameRef = useRef(null);
  gameRef.current = game;

  useEffect(() => {
    if (!socket) return undefined;

    /**
     * Objetivo: actualizar la partida cuando cambia (jugadores, colores, cupo).
     * Entradas: { game } (GameSummary).
     * Salidas: ninguna.
     * Restricciones: ignora otras partidas.
     */
    const handleRoom = ({ game: updated }) => {
      if (gameRef.current && updated.code === gameRef.current.code) setGame(updated);
    };

    /**
     * Objetivo: mostrar el aviso cuando la partida se cancela.
     * Entradas: { code, reason }.
     * Salidas: ninguna.
     * Restricciones: ignora otras partidas.
     */
    const handleCancelled = ({ code, reason }) => {
      if (gameRef.current && code === gameRef.current.code) {
        setGame(null);
        setDeadline(null);
        setCancelReason(reason);
      }
    };

    socket.on(EVENTS.LOBBY_ROOM, handleRoom);
    socket.on(EVENTS.LOBBY_CANCELLED, handleCancelled);
    return () => {
      socket.off(EVENTS.LOBBY_ROOM, handleRoom);
      socket.off(EVENTS.LOBBY_CANCELLED, handleCancelled);
    };
  }, [socket]);

  // Al salir de la pantalla con una partida en espera, el jugador sale de ella.
  useEffect(() => () => {
    if (socket && gameRef.current) {
      request(socket, EVENTS.LOBBY_LEAVE, { code: gameRef.current.code });
    }
  }, [socket]);

  /**
   * Objetivo: guardar la partida recién creada y empezar la cuenta de expiración.
   * Entradas: created (GameSummary de la respuesta de lobby:create).
   * Salidas: ninguna.
   * Restricciones: el tiempo se cuenta desde que llega la respuesta, así no depende
   *                de que el reloj del cliente coincida con el del servidor.
   */
  const handleCreated = (created) => {
    setCancelReason(null);
    setGame(created);
    setDeadline(Date.now() + config.gameExpirationSeconds * 1000);
  };

  /**
   * Objetivo: salir de la partida en espera y volver al menú.
   * Entradas: ninguna.
   * Salidas: promesa que termina al navegar al menú.
   * Restricciones: el servidor cancela la partida si queda vacía.
   */
  const handleLeave = async () => {
    const current = gameRef.current;
    gameRef.current = null; // ya salió: al desmontar no se vuelve a enviar lobby:leave
    if (current) await request(socket, EVENTS.LOBBY_LEAVE, { code: current.code });
    navigate('/', { replace: true });
  };

  if (error) {
    return (
      <main className="card">
        <h1>Crear partida</h1>
        <p className="hint hint-error" role="alert">No se pudo cargar la configuración del servidor.</p>
        <button type="button" onClick={retry}>Reintentar</button>
        <Link className="back-link" to="/">Volver al menú</Link>
      </main>
    );
  }

  if (!config) return <p className="status">Cargando…</p>;

  if (cancelReason) {
    return (
      <main className="card">
        <h1>Partida cancelada</h1>
        <p role="alert">{CANCEL_MESSAGES[cancelReason] || 'La partida se canceló.'}</p>
        <div className="menu">
          <button type="button" onClick={() => setCancelReason(null)}>Crear otra partida</button>
          <Link className="button button-secondary" to="/">Volver al menú</Link>
        </div>
      </main>
    );
  }

  if (game) {
    return <CreatedGame game={game} deadline={deadline} onLeave={handleLeave} />;
  }

  return <CreateGameForm config={config} socket={socket} onCreated={handleCreated} />;
}

/**
 * Objetivo: formulario validado para crear una partida.
 * Entradas: config (PublicConfig), socket, onCreated (función que recibe el GameSummary creado).
 * Salidas: formulario con tipo y valor, temática, número de jugadores y color.
 * Restricciones: el botón "Crear" solo se activa si todos los campos son válidos.
 */
function CreateGameForm({ config, socket, onCreated }) {
  const [form, setForm] = useState(() => initialForm(config));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const errors = validateCreateForm(form, config);
  const valid = Object.keys(errors).length === 0;
  const range = valueRange(form.type, config);

  /**
   * Objetivo: cambiar un campo del formulario.
   * Entradas: field (nombre del campo), value (nuevo valor).
   * Salidas: ninguna.
   * Restricciones: al cambiar el tipo, el valor vuelve al valor por defecto de ese tipo.
   */
  const update = (field, value) => {
    setSubmitError('');
    setForm((prev) => {
      if (field === 'type') {
        return { ...prev, type: value, value: String(valueRange(value, config).defaultValue) };
      }
      return { ...prev, [field]: value };
    });
  };

  /**
   * Objetivo: enviar lobby:create.
   * Entradas: event (submit del formulario).
   * Salidas: ninguna; llama onCreated o muestra el error del servidor.
   * Restricciones: solo si el formulario es válido.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!valid || submitting || !socket) return;
    setSubmitting(true);
    const res = await request(socket, EVENTS.LOBBY_CREATE, toCreatePayload(form));
    setSubmitting(false);
    if (res.ok) onCreated(res.game);
    else setSubmitError(res.error?.message || 'No se pudo crear la partida');
  };

  return (
    <main className="card card-wide">
      <h1>Crear partida</h1>
      <form onSubmit={handleSubmit} noValidate>
        <fieldset>
          <legend>Tipo de partida</legend>
          <div className="segmented">
            <label>
              <input
                type="radio"
                name="type"
                value="time"
                checked={form.type === 'time'}
                onChange={() => update('type', 'time')}
              />
              <span>Por tiempo</span>
            </label>
            <label>
              <input
                type="radio"
                name="type"
                value="length"
                checked={form.type === 'length'}
                onChange={() => update('type', 'length')}
              />
              <span>Por largo</span>
            </label>
          </div>
        </fieldset>

        <label htmlFor="mode-value">
          {form.type === 'time' ? 'Duración (minutos)' : 'Largo objetivo (segmentos)'}
        </label>
        <input
          id="mode-value"
          type="number"
          inputMode="numeric"
          min={range.min}
          max={range.max}
          value={form.value}
          onChange={(e) => update('value', e.target.value)}
          aria-invalid={Boolean(errors.value)}
          aria-describedby="mode-value-error"
        />
        <p id="mode-value-error" className="hint hint-error">{errors.value}</p>

        <label htmlFor="theme">Temática</label>
        <select id="theme" value={form.theme} onChange={(e) => update('theme', e.target.value)}>
          {config.themes.map((theme) => (
            <option key={theme} value={theme}>{THEME_LABELS[theme] || theme}</option>
          ))}
        </select>

        <label htmlFor="max-players">Número de jugadores</label>
        <input
          id="max-players"
          type="number"
          inputMode="numeric"
          min={config.minPlayers}
          max={config.maxPlayers}
          value={form.maxPlayers}
          onChange={(e) => update('maxPlayers', e.target.value)}
          aria-invalid={Boolean(errors.maxPlayers)}
          aria-describedby="max-players-error"
        />
        <p id="max-players-error" className="hint hint-error">{errors.maxPlayers}</p>

        <span className="field-label">Tu color</span>
        <ColorPicker
          colors={config.colorPalette}
          value={form.color}
          onChange={(color) => update('color', color)}
        />
        <p className="hint hint-error">{errors.color}</p>

        <button type="submit" disabled={!valid || submitting || !socket}>
          {submitting ? 'Creando…' : 'Crear'}
        </button>
        {submitError && <p className="hint hint-error" role="alert">{submitError}</p>}
      </form>
      <Link className="back-link" to="/">Volver al menú</Link>
    </main>
  );
}

/**
 * Objetivo: mostrar la partida creada mientras espera jugadores.
 * Entradas: game (GameSummary), deadline (ms de Date.now() en que expira),
 *           onLeave (función para salir de la partida).
 * Salidas: código de la partida, tiempo para que expire, jugadores unidos y botón para salir.
 * Restricciones: la sala de espera completa (botón "Entrar") se hace en A6.
 */
function CreatedGame({ game, deadline, onLeave }) {
  const left = useCountdown(deadline);
  const [leaving, setLeaving] = useState(false);

  const modeText = game.mode.type === 'time'
    ? `Por tiempo · ${game.mode.value} min`
    : `Por largo · ${game.mode.value} segmentos`;

  return (
    <main className="card">
      <h1>Partida creada</h1>
      <p className="muted">Comparte este código con los demás jugadores:</p>
      <p className="game-code" aria-label="Código de la partida">{game.code}</p>

      <p className="expires" role="timer" aria-live="off">
        {left > 0 ? <>Expira en <strong>{formatSeconds(left)}</strong></> : 'Expirando…'}
      </p>

      <dl className="game-info">
        <dt>Tipo</dt><dd>{modeText}</dd>
        <dt>Temática</dt><dd>{THEME_LABELS[game.theme] || game.theme}</dd>
        <dt>Jugadores</dt><dd>{game.players.length} / {game.maxPlayers}</dd>
      </dl>

      <ul className="player-list" aria-label="Jugadores unidos">
        {game.players.map((player) => (
          <li key={player.nickname}>
            <span className="dot" style={{ background: player.color }} aria-hidden="true" />
            {player.nickname}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="button-secondary"
        onClick={() => { setLeaving(true); onLeave(); }}
        disabled={leaving}
      >
        Salir de la partida
      </button>
    </main>
  );
}
