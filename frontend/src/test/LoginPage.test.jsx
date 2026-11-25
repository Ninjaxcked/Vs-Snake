/**
 * Pruebas de la verificación del nickname mientras se escribe (espera entre teclas).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import LoginPage from '../pages/LoginPage.jsx';
import { ROUTER_FUTURE } from '../App.jsx';
import { SessionContext } from '../session/SessionContext.jsx';

/**
 * Objetivo: montar LoginPage con una sesión falsa.
 * Entradas: overrides (campos de la sesión a reemplazar).
 * Salidas: { session } con la sesión usada.
 * Restricciones: ninguna.
 */
function renderLogin(overrides = {}) {
  const session = {
    socket: {},
    connected: true,
    restoring: false,
    nickname: null,
    checkNickname: vi.fn(async () => ({ ok: true, available: true })),
    login: vi.fn(async (nickname) => ({ ok: true, nickname })),
    logout: vi.fn(),
    ...overrides
  };
  render(
    <MemoryRouter future={ROUTER_FUTURE}>
      <SessionContext.Provider value={session}>
        <LoginPage />
      </SessionContext.Provider>
    </MemoryRouter>
  );
  return { session };
}

describe('LoginPage', () => {
  test('no pregunta al servidor en cada tecla, solo cuando se deja de escribir', async () => {
    const { session } = renderLogin();
    await userEvent.type(screen.getByLabelText('Nickname'), 'jugador1');
    await screen.findByText('Nickname disponible');
    expect(session.checkNickname).toHaveBeenCalledTimes(1);
    expect(session.checkNickname).toHaveBeenCalledWith('jugador1');
  });

  test('ignora una respuesta vieja que llega después de la nueva', async () => {
    let resolveFirst;
    const checkNickname = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementation(async () => ({ ok: true, available: true }));
    renderLogin({ checkNickname });
    const input = screen.getByLabelText('Nickname');

    await userEvent.type(input, 'ana');
    await waitFor(() => expect(checkNickname).toHaveBeenCalledTimes(1));
    await userEvent.type(input, 'xx');
    await screen.findByText('Nickname disponible');

    resolveFirst({ ok: true, available: false, reason: 'NICKNAME_TAKEN' });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Nickname disponible')).toBeInTheDocument();
  });

  test('sin conexión no deja enviar', async () => {
    renderLogin({ connected: false });
    await userEvent.type(screen.getByLabelText('Nickname'), 'ana');
    await screen.findByText('Nickname disponible');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    expect(screen.getByText('Conectando con el servidor…')).toBeInTheDocument();
  });

  test('si otro toma el nickname justo antes de enviar, muestra "en uso"', async () => {
    const { session } = renderLogin({
      login: vi.fn(async () => ({ ok: false, error: { code: 'NICKNAME_TAKEN', message: 'x' } }))
    });
    await userEvent.type(screen.getByLabelText('Nickname'), 'ana');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Ese nickname ya está en uso')).toBeInTheDocument();
    expect(session.login).toHaveBeenCalledWith('ana');
  });
});
