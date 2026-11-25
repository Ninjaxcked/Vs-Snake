/**
 * Pruebas de A3 contra el servidor real de Socket.IO del backend (eventos auth:*).
 */
import { createRequire } from 'node:module';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { io } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import App, { ROUTER_FUTURE } from '../App.jsx';
import { NICKNAME_STORAGE_KEY, SessionProvider } from '../session/SessionContext.jsx';

const require = createRequire(import.meta.url);
const { startSocketTestServer, request } = require('../../../backend/test-utils/server.js');

let server;
let createSocket;

beforeEach(async () => {
  server = await startSocketTestServer();
  createSocket = () => io(server.url, { transports: ['websocket'], forceNew: true });
});

afterEach(async () => {
  await server.close();
});

/**
 * Objetivo: montar la aplicación completa en una ruta inicial.
 * Entradas: path (ruta inicial).
 * Salidas: resultado de render().
 * Restricciones: ninguna.
 */
function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
      <SessionProvider createSocket={createSocket}>
        <App />
      </SessionProvider>
    </MemoryRouter>
  );
}

describe('rutas protegidas', () => {
  test.each(['/', '/crear', '/unirse', '/ranking', '/cualquier-cosa'])(
    'sin nickname, %s muestra la pantalla de nickname',
    async (path) => {
      renderApp(path);
      expect(await screen.findByLabelText('Nickname')).toBeInTheDocument();
      expect(screen.queryByText('Crear partida')).not.toBeInTheDocument();
    }
  );
});

describe('pantalla de nickname', () => {
  test('muestra "nickname en uso" antes de enviar el formulario', async () => {
    const other = await server.connect();
    await request(other, 'auth:login', { nickname: 'ana' });

    renderApp('/');
    await userEvent.type(await screen.findByLabelText('Nickname'), 'ANA');

    expect(await screen.findByText('Ese nickname ya está en uso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });

  test('marca formato inválido sin preguntar al servidor', async () => {
    renderApp('/');
    await userEvent.type(await screen.findByLabelText('Nickname'), 'a b');
    expect(await screen.findByText(/De 3 a 15 caracteres/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });

  test('con un nickname libre entra al menú con las 3 opciones', async () => {
    renderApp('/');
    await userEvent.type(await screen.findByLabelText('Nickname'), 'beto');
    expect(await screen.findByText('Nickname disponible')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('link', { name: 'Crear partida' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unirse a partida' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ranking' })).toBeInTheDocument();
    expect(screen.getByText('beto')).toBeInTheDocument();
    expect(server.deps.registry.check('beto').available).toBe(false);
  });

  test('después del login vuelve a la ruta que se había pedido', async () => {
    renderApp('/ranking');
    await userEvent.type(await screen.findByLabelText('Nickname'), 'carla');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Ranking' })).toBeInTheDocument();
  });
});

describe('sesión', () => {
  test('al recargar la pestaña recupera el nickname guardado', async () => {
    sessionStorage.setItem(NICKNAME_STORAGE_KEY, 'dani');
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'Crear partida' })).toBeInTheDocument();
    expect(server.deps.registry.check('dani').available).toBe(false);
  });

  test('si el nickname guardado ya lo tomó otro, pide uno nuevo', async () => {
    const other = await server.connect();
    await request(other, 'auth:login', { nickname: 'dani' });
    sessionStorage.setItem(NICKNAME_STORAGE_KEY, 'dani');
    renderApp('/');
    expect(await screen.findByLabelText('Nickname')).toBeInTheDocument();
    expect(sessionStorage.getItem(NICKNAME_STORAGE_KEY)).toBeNull();
  });

  test('"Cambiar nickname" libera el nickname en el servidor', async () => {
    sessionStorage.setItem(NICKNAME_STORAGE_KEY, 'eva');
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar nickname' }));
    expect(await screen.findByLabelText('Nickname')).toBeInTheDocument();
    await waitFor(() => expect(server.deps.registry.check('eva').available).toBe(true));
  });
});
