import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request, useSession } from '../session/SessionContext.jsx';
import { EVENTS } from '../protocol/events.js';
import useServerConfig from '../hooks/useServerConfig.js';
import ColorPicker from '../components/ColorPicker.jsx';
import { formatTheme } from '../lobby/format.js';
import {
  initialForm,
  toCreatePayload,
  validateCreateForm,
  valueRange
} from '../lobby/createGameForm.js';

/**
 * Objetivo: pantalla de la opción "Crear partida".
 * Entradas: ninguna (usa la sesión y GET /api/config).
 * Salidas: el formulario; al crear, lleva a la sala de espera (/sala/:code), donde se ve
 *          el código, el tiempo para que expire y el aviso si se cancela.
 * Restricciones: requiere sesión (ruta protegida).
 */
export default function CreateGamePage() {
  const { socket } = useSession();
  const navigate = useNavigate();
  const { config, error, retry } = useServerConfig();

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

  return (
    <CreateGameForm
      config={config}
      socket={socket}
      onCreated={(game) => navigate(`/sala/${game.code}`, { replace: true, state: { game } })}
    />
  );
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
            <option key={theme} value={theme}>{formatTheme(theme)}</option>
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
