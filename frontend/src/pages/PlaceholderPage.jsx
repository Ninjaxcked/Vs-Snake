import { Link } from 'react-router-dom';

/**
 * Objetivo: pantalla temporal para las opciones que todavía no están hechas (A5, A6, A9).
 * Entradas: title (string con el nombre de la pantalla).
 * Salidas: título y enlace de regreso al menú.
 * Restricciones: se reemplaza por la pantalla real en su commit.
 */
export default function PlaceholderPage({ title }) {
  return (
    <main className="card">
      <h1>{title}</h1>
      <p>En construcción.</p>
      <Link to="/">Volver al menú</Link>
    </main>
  );
}
