import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { request, useSession } from '../session/SessionContext.jsx';
import { EVENTS } from '../protocol/events.js';
import useCountdown, { formatSeconds } from '../hooks/useCountdown.js';
import { formatMode, formatTheme } from '../lobby/format.js';

/** Mensaje que se muestra según el motivo de lobby:cancelled. */
const CANCEL_MESSAGES = {
  expired: 'La partida se canceló porque no se completó a tiempo.',
  empty: 'La partida se canceló porque quedó vacía.'
};

/**
 * Objetivo: sala de espera de una partida, para el creador y para los que se unen.
 * Entradas: ruta /sala/:code y location.state.game (GameSummary que devolvió
 *           lobby:create o lobby:join).
 * Salidas: código, tiempo para expirar, jugadores unidos y botón "Entrar", que solo se
 *          activa cuando la partida está completa; si se cancela, el aviso de cancelación.
 * Restricciones: requiere sesión. Sin location.state (por ejemplo, al recargar, que
 *                desconecta y saca al jugador de la partida) vuelve a /unirse.
 *                Al salir de la pantalla, el jugador sale de la partida (lobby:leave).
 */
export default function WaitingRoomPage() {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket, nickname } = useSession();
  const initial = location.state?.game?.code === code ? location.state.game : null;

  const [game, setGame] = useState(initial);
  const [cancelReason, setCancelReason] = useState(null);
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const inRoom = useRef(Boolean(initial)); // el jugador sigue en la partida en el servidor
  const pendingLeave = useRef(null);
  const left = useCountdown(game ? Date.parse(game.expiresAt) : null);

  useEffect(() => {
    if (!socket) return undefined;

    /**
     * Objetivo: actualizar la sala cuando cambia la partida (jugadores, colores, cupo).
     * Entradas: { game } (GameSummary).
     * Salidas: ninguna.
     * Restricciones: ignora otras partidas.
     */
    const handleRoom = ({ game: updated }) => {
      if (updated.code === code) setGame(updated);
    };

    /**
     * Objetivo: mostrar el aviso cuando la partida se cancela.
     * Entradas: { code, reason }.
     * Salidas: ninguna.
     * Restricciones: ignora otras partidas.
     */
    const handleCancelled = ({ code: cancelled, reason }) => {
      if (cancelled !== code) return;
      inRoom.current = false;
      setCancelReason(reason);
    };

    socket.on(EVENTS.LOBBY_ROOM, handleRoom);
    socket.on(EVENTS.LOBBY_CANCELLED, handleCancelled);
    return () => {
      socket.off(EVENTS.LOBBY_ROOM, handleRoom);
      socket.off(EVENTS.LOBBY_CANCELLED, handleCancelled);
    };
  }, [socket, code]);

  // Al salir de la pantalla, el jugador sale de la partida. Se espera un instante antes de
  // enviarlo porque React.StrictMode (en desarrollo) desmonta y vuelve a montar el componente.
  useEffect(() => {
    clearTimeout(pendingLeave.current);
    return () => {
      pendingLeave.current = setTimeout(() => {
        if (socket && inRoom.current) {
          inRoom.current = false;
          request(socket, EVENTS.LOBBY_LEAVE, { code });
        }
      }, 0);
    };
  }, [socket, code]);

  if (!initial) return <Navigate to="/unirse" replace />;

  /**
   * Objetivo: salir de la partida y volver al menú.
   * Entradas: ninguna.
   * Salidas: promesa que termina al navegar al menú.
   * Restricciones: el servidor cancela la partida si queda vacía.
   */
  const handleLeave = async () => {
    setLeaving(true);
    if (inRoom.current) {
      inRoom.current = false;
      await request(socket, EVENTS.LOBBY_LEAVE, { code });
    }
    navigate('/', { replace: true });
  };

  /**
   * Objetivo: entrar al juego (game:enter) cuando la partida está completa.
   * Entradas: ninguna.
   * Salidas: ninguna; si el servidor responde con error, lo muestra.
   * Restricciones: el paso al tablero se conecta en A7 (feature/arranque-partida).
   */
  const handleEnter = async () => {
    setEntering(true);
    setEnterError('');
    const res = await request(socket, EVENTS.GAME_ENTER, { code });
    setEntering(false);
    if (!res.ok) setEnterError(res.error?.message || 'No se pudo entrar a la partida');
  };

  if (cancelReason) {
    return (
      <main className="card">
        <h1>Partida cancelada</h1>
        <p role="alert">{CANCEL_MESSAGES[cancelReason] || 'La partida se canceló.'}</p>
        <div className="menu">
          <Link className="button" to="/">Volver al menú</Link>
          <Link className="button button-secondary" to="/unirse">Buscar otra partida</Link>
        </div>
      </main>
    );
  }

  const full = game.status === 'full';
  const missing = game.maxPlayers - game.players.length;
  const emptySlots = Array.from({ length: Math.max(0, missing) }, (_, i) => i);

  return (
    <main className="card">
      <h1>Sala de espera</h1>
      <p className="muted">Comparte este código con los demás jugadores:</p>
      <p className="game-code" aria-label="Código de la partida">{game.code}</p>

      <p className="expires" role="timer" aria-live="off">
        {left > 0 ? <>Expira en <strong>{formatSeconds(left)}</strong></> : 'Expirando…'}
      </p>

      <dl className="game-info">
        <dt>Tipo</dt><dd>{formatMode(game.mode)}</dd>
        <dt>Temática</dt><dd>{formatTheme(game.theme)}</dd>
        <dt>Jugadores</dt><dd>{game.players.length} / {game.maxPlayers}</dd>
      </dl>

      <ul className="player-list" aria-label="Jugadores unidos">
        {game.players.map((player) => (
          <li key={player.nickname}>
            <span className="dot" style={{ background: player.color }} aria-hidden="true" />
            {player.nickname}
            {player.nickname === nickname && <span className="tag">tú</span>}
            {player.nickname === game.creator && <span className="tag">creador</span>}
          </li>
        ))}
        {emptySlots.map((slot) => (
          <li key={`slot-${slot}`} className="muted">
            <span className="dot dot-empty" aria-hidden="true" />
            Esperando jugador…
          </li>
        ))}
      </ul>

      <div className="menu">
        <button type="button" onClick={handleEnter} disabled={!full || entering}>
          {entering ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="hint" role="status">
          {full ? 'La partida está completa.' : `Falta${missing === 1 ? '' : 'n'} ${missing} jugador${missing === 1 ? '' : 'es'}.`}
        </p>
        {enterError && <p className="hint hint-error" role="alert">{enterError}</p>}
        <button type="button" className="button-secondary" onClick={handleLeave} disabled={leaving}>
          Salir de la partida
        </button>
      </div>
    </main>
  );
}
