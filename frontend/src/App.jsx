import { Navigate, Route, Routes } from 'react-router-dom';
import RequireSession from './session/RequireSession.jsx';
import MenuLayout from './components/MenuLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';

/**
 * Objetivo: definir las rutas del cliente Vs Snake.
 * Entradas: ninguna.
 * Salidas: árbol de rutas; todas, excepto /login, requieren nickname.
 * Restricciones: debe renderizarse dentro de un Router y de <SessionProvider>.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<MenuLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireSession />}>
          <Route path="/" element={<MenuPage />} />
          <Route path="/crear" element={<PlaceholderPage title="Crear partida" />} />
          <Route path="/unirse" element={<PlaceholderPage title="Unirse a partida" />} />
          <Route path="/ranking" element={<PlaceholderPage title="Ranking" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

/** Opciones de React Router v7 activadas desde ya (evitan avisos en consola). */
export const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
