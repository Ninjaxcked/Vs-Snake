import { Outlet } from 'react-router-dom';

/**
 * Objetivo: fondo común de las pantallas de menú (login, menú, crear, unirse, ranking).
 * Entradas: ninguna (renderiza las rutas hijas con <Outlet />).
 * Salidas: contenedor a pantalla completa con la imagen de fondo y el contenido centrado.
 * Restricciones: la pantalla del juego no debe usar este layout.
 */
export default function MenuLayout() {
  return (
    <div className="menu-layout">
      <Outlet />
    </div>
  );
}
