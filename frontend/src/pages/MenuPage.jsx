import { Link } from 'react-router-dom';
import { useSession } from '../session/SessionContext.jsx';

/**
 * Objetivo: menú principal con las 3 opciones del juego.
 * Entradas: ninguna (usa el nickname de la sesión).
 * Salidas: enlaces a Crear partida, Unirse a partida y Ranking, y botón para salir.
 * Restricciones: solo accesible con sesión iniciada (ver RequireSession).
 */
export default function MenuPage() {
  const { nickname, logout } = useSession();

  return (
    <main className="card">
      <h1>Vs Snake</h1>
      <p>
        Jugando como <strong>{nickname}</strong>
      </p>
      <nav className="menu" aria-label="Menú principal">
        <Link className="button" to="/crear">Crear partida</Link>
        <Link className="button" to="/unirse">Unirse a partida</Link>
        <Link className="button" to="/ranking">Ranking</Link>
      </nav>
      <button type="button" className="link-button" onClick={logout}>
        Cambiar nickname
      </button>
    </main>
  );
}
