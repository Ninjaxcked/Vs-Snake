import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './SessionContext.jsx';

/**
 * Objetivo: proteger las rutas que necesitan un nickname.
 * Entradas: ninguna (lee la sesión y la ruta actual).
 * Salidas: las rutas hijas (<Outlet />), un aviso mientras se recupera la sesión,
 *          o una redirección a /login recordando la ruta pedida.
 * Restricciones: usarse como elemento de una <Route> padre.
 */
export default function RequireSession() {
  const { nickname, restoring } = useSession();
  const location = useLocation();

  if (restoring) {
    return <p className="status">Conectando…</p>;
  }
  if (!nickname) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
