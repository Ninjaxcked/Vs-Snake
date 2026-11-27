import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request, useSession } from '../session/SessionContext.jsx';
import { EVENTS } from '../protocol/events.js';
import useServerConfig from '../hooks/useServerConfig.js';
import ColorPicker from '../components/ColorPicker.jsx';
import { formatMode, formatTheme } from '../lobby/format.js';

/**
 * Objetivo: pantalla de la opción "Unirse a partida".
 * Entradas: ninguna (usa la sesión, lobby:list, lobby:update y GET /api/config).
 * Salidas: lista en vivo de las partidas en espera; al elegir una, un selector de color
 *          con los colores usados bloqueados; al unirse, lleva a la sala de espera.
 * Restricciones: requiere sesión (ruta protegida).
 */
export default function JoinGamePage() {
  const { socket } = useSession();
  const navigate = useNavigate();
  const { config, error, retry } = useServerConfig();
  const [games, setGames] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);
  const [color, setColor] = useState(null);
  const [notice, setNotice] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!socket) return undefined;
    let active = true;

    /**
     * Objetivo: reemplazar la lista con la que envía el servidor en lobby:update.
     * Entradas: { games } (GameSummary[]).
     * Salidas: ninguna.
     * Restricciones: ninguna.
     */
    const handleUpdate = ({ games: list }) => setGames(list);

    socket.on(EVENTS.LOBBY_UPDATE, handleUpdate);
    request(socket, EVENTS.LOBBY_LIST, {}).then((res) => {
      // Si ya llegó un lobby:update, es más reciente que esta respuesta.
      if (active && res.ok) setGames((current) => current ?? res.games);
    });
    return () => {
      active = false;
      socket.off(EVENTS.LOBBY_UPDATE, handleUpdate);
    };
  }, [socket]);

  const selected = games?.find((game) => game.code === selectedCode) ?? null;

  // Si la partida elegida desaparece (se llenó y empezó, expiró o se canceló), se avisa.
  useEffect(() => {
    if (games && selectedCode && !selected) {
      setNotice(`La partida ${selectedCode} ya no está disponible.`);
      setSelectedCode(null);
    }
  }, [games, selectedCode, selected]);

  // Si otro jugador toma el color elegido, el color deja de estar elegido.
  const usedColors = selected?.usedColors ?? [];
  const chosenColor = color && !usedColors.some((c) => c.toLowerCase() === color.toLowerCase())
    ? color
    : null;

  /**
   * Objetivo: elegir una partida de la lista.
   * Entradas: game (GameSummary).
   * Salidas: ninguna.
   * Restricciones: sugiere el primer color libre de la paleta.
   */
  const handleSelect = (game) => {
    setSelectedCode(game.code);
    setNotice('');
    setJoinError('');
    const used = new Set(game.usedColors.map((c) => c.toLowerCase()));
    setColor(config?.colorPalette.find((c) => !used.has(c.toLowerCase())) ?? null);
  };

  /**
   * Objetivo: unirse a la partida elegida con el color elegido (lobby:join).
   * Entradas: event (submit del formulario).
   * Salidas: ninguna; navega a la sala de espera o muestra el error del servidor.
   * Restricciones: requiere partida y color elegidos.
   */
  const handleJoin = async (event) => {
    event.preventDefault();
    if (!selected || !chosenColor || joining) return;
    setJoining(true);
    setJoinError('');
    const res = await request(socket, EVENTS.LOBBY_JOIN, { code: selected.code, color: chosenColor });
    setJoining(false);
    if (res.ok) {
      navigate(`/sala/${res.game.code}`, { state: { game: res.game } });
    } else {
      setJoinError(res.error?.message || 'No se pudo unir a la partida');
    }
  };

  if (error) {
    return (
      <main className="card">
        <h1>Unirse a partida</h1>
        <p className="hint hint-error" role="alert">No se pudo cargar la configuración del servidor.</p>
        <button type="button" onClick={retry}>Reintentar</button>
        <Link className="back-link" to="/">Volver al menú</Link>
      </main>
    );
  }

  if (!config || !games) return <p className="status">Cargando…</p>;

  return (
    <main className="card card-wide">
      <h1>Unirse a partida</h1>
      {notice && <p className="hint hint-error" role="alert">{notice}</p>}

      {games.length === 0 ? (
        <p className="muted">
          No hay partidas en espera. <Link to="/crear">Crea una</Link>.
        </p>
      ) : (
        <ul className="game-list" aria-label="Partidas en espera">
          {games.map((game) => {
            const full = game.status === 'full';
            return (
              <li key={game.code}>
                <button
                  type="button"
                  className={`game-item${game.code === selectedCode ? ' game-item-selected' : ''}`}
                  onClick={() => handleSelect(game)}
                  disabled={full}
                  aria-pressed={game.code === selectedCode}
                >
                  <span className="game-item-head">
                    <span className="game-item-code">{game.code}</span>
                    <span className={full ? 'badge badge-full' : 'badge'}>
                      {full ? 'Completa' : `${game.players.length} / ${game.maxPlayers}`}
                    </span>
                  </span>
                  <span className="game-item-detail">
                    {formatTheme(game.theme)} · {formatMode(game.mode)}
                  </span>
                  <span className="game-item-players">
                    {game.players.map((player) => (
                      <span key={player.nickname} className="player-chip">
                        <span className="dot" style={{ background: player.color }} aria-hidden="true" />
                        {player.nickname}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <form className="join-form" onSubmit={handleJoin} noValidate>
          <span className="field-label">Elige tu color para la partida {selected.code}</span>
          <ColorPicker
            colors={config.colorPalette}
            value={chosenColor}
            onChange={setColor}
            disabledColors={usedColors}
          />
          <button type="submit" disabled={!chosenColor || joining}>
            {joining ? 'Uniéndose…' : 'Unirse'}
          </button>
          {joinError && <p className="hint hint-error" role="alert">{joinError}</p>}
        </form>
      )}

      <Link className="back-link" to="/">Volver al menú</Link>
    </main>
  );
}
