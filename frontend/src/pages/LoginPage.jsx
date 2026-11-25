import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../session/SessionContext.jsx';
import { isValidNickname } from '../session/nickname.js';
import { ERROR_CODES } from '../protocol/events.js';
import useDebouncedValue from '../hooks/useDebouncedValue.js';

/** Espera entre teclas antes de preguntar al servidor (ms). */
export const CHECK_DELAY_MS = 300;

/** Mensajes que se muestran según el estado del nickname. */
const MESSAGES = {
  invalid: 'De 3 a 15 caracteres: letras, dígitos, _ o -',
  checking: 'Verificando…',
  available: 'Nickname disponible',
  taken: 'Ese nickname ya está en uso',
  error: 'No se pudo verificar el nickname'
};

/**
 * Objetivo: pantalla para elegir el nickname, verificando mientras se escribe.
 * Entradas: ninguna (usa la sesión y la ruta de origen guardada por RequireSession).
 * Salidas: formulario; al iniciar sesión redirige a la ruta pedida o al menú.
 * Restricciones: el botón solo se activa con un nickname válido y libre.
 */
export default function LoginPage() {
  const { nickname, connected, checkNickname, login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | invalid | checking | available | taken | error
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debounced = useDebouncedValue(value.trim(), CHECK_DELAY_MS);
  const lastRequest = useRef(0);

  useEffect(() => {
    if (!debounced) {
      setStatus('idle');
      return;
    }
    if (!isValidNickname(debounced)) {
      setStatus('invalid');
      return;
    }
    const requestId = ++lastRequest.current;
    setStatus('checking');
    checkNickname(debounced).then((res) => {
      if (requestId !== lastRequest.current) return; // llegó una respuesta vieja
      if (!res.ok) setStatus('error');
      else if (res.available) setStatus('available');
      else setStatus(res.reason === ERROR_CODES.NICKNAME_TAKEN ? 'taken' : 'invalid');
    });
  }, [debounced, checkNickname]);

  if (nickname) {
    return <Navigate to={from} replace />;
  }

  const typing = value.trim() !== debounced;
  const canSubmit = connected && !submitting && !typing && status === 'available';

  /**
   * Objetivo: enviar el formulario e iniciar sesión.
   * Entradas: event (submit del formulario).
   * Salidas: ninguna; navega si el login fue exitoso o muestra el error.
   * Restricciones: solo si canSubmit.
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    const res = await login(value.trim());
    setSubmitting(false);
    if (res.ok) {
      navigate(from, { replace: true });
    } else if (res.error?.code === ERROR_CODES.NICKNAME_TAKEN) {
      setStatus('taken');
    } else {
      setSubmitError(res.error?.message || 'No se pudo iniciar sesión');
    }
  };

  const message = typing ? '' : MESSAGES[status];

  return (
    <main className="card">
      <h1>Vs Snake</h1>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="nickname">Nickname</label>
        <input
          id="nickname"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={15}
          autoComplete="off"
          autoFocus
          aria-invalid={status === 'taken' || status === 'invalid'}
          aria-describedby="nickname-status"
        />
        <p id="nickname-status" className={`hint hint-${status}`} role="status">
          {message}
        </p>
        <button type="submit" disabled={!canSubmit}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        {submitError && <p className="hint hint-error" role="alert">{submitError}</p>}
        {!connected && <p className="hint hint-error">Conectando con el servidor…</p>}
      </form>
    </main>
  );
}
