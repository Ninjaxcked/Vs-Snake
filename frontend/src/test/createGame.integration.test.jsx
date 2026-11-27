/**
 * Pruebas de A5 (pantalla "Crear partida") contra el servidor real de Socket.IO del backend.
 */
import { createRequire } from 'node:module';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { io } from 'socket.io-client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import App, { ROUTER_FUTURE } from '../App.jsx';
import { NICKNAME_STORAGE_KEY, SessionProvider } from '../session/SessionContext.jsx';

const require = createRequire(import.meta.url);
const { startSocketTestServer, request, nextEvent } = require('../../../backend/test-utils/server.js');
const backendConfig = require('../../../backend/config/config.json');

let server;

afterEach(async () => {
  vi.unstubAllGlobals();
  if (server) await server.close();
  server = null;
});

/**
 * Objetivo: construir el PublicConfig que devolvería GET /api/config.
 * Entradas: config (configuración del backend).
 * Salidas: objeto PublicConfig.
 * Restricciones: mismos campos que backend/src/routes/api.js.
 */
function publicConfig(config) {
  return {
    themes: config.themes,
    colorPalette: config.colorPalette,
    minPlayers: config.lobby.minPlayers,
    maxPlayers: config.lobby.maxPlayers,
    gameExpirationSeconds: config.lobby.gameExpirationSeconds,
    startKey: config.lobby.startKey,
    startCountdownSeconds: config.lobby.startCountdownSeconds,
    gameModes: config.gameModes
  };
}

/**
 * Objetivo: levantar el servidor y montar la app en /crear con el nickname 'ana' ya iniciado.
 * Entradas: lobbyOverrides (cambios a config.lobby, por ejemplo gameExpirationSeconds).
 * Salidas: promesa que termina cuando el formulario está en pantalla.
 * Restricciones: GET /api/config se simula con fetch.
 */
async function renderCreatePage(lobbyOverrides = {}) {
  const config = { ...backendConfig, lobby: { ...backendConfig.lobby, ...lobbyOverrides } };
  server = await startSocketTestServer({ config });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => publicConfig(config) })));
  sessionStorage.setItem(NICKNAME_STORAGE_KEY, 'ana');
  const createSocket = () => io(server.url, { transports: ['websocket'], forceNew: true });
  render(
    <MemoryRouter initialEntries={['/crear']} future={ROUTER_FUTURE}>
      <SessionProvider createSocket={createSocket}>
        <App />
      </SessionProvider>
    </MemoryRouter>
  );
  await screen.findByRole('heading', { name: 'Crear partida' });
}

/**
 * Objetivo: conectar otro jugador (otro navegador) con sesión iniciada.
 * Entradas: nickname.
 * Salidas: promesa con el socket cliente.
 * Restricciones: ninguna.
 */
async function otherPlayer(nickname) {
  const client = await server.connect();
  await request(client, 'auth:login', { nickname });
  return client;
}

describe('formulario', () => {
  test('marca el valor fuera de rango y desactiva "Crear"', async () => {
    await renderCreatePage();
    const value = screen.getByLabelText('Duración (minutos)');
    await userEvent.clear(value);
    await userEvent.type(value, '99');
    expect(screen.getByText(/entre 1 y 10 minutos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled();
  });

  test('al cambiar a "Por largo" usa el valor y los límites del largo', async () => {
    await renderCreatePage();
    await userEvent.click(screen.getByLabelText('Por largo'));
    const value = screen.getByLabelText('Largo objetivo (segmentos)');
    expect(value).toHaveValue(backendConfig.gameModes.length.defaultTarget);
    await userEvent.clear(value);
    await userEvent.type(value, '3');
    expect(screen.getByText(/entre 5 y 100/)).toBeInTheDocument();
  });

  test('no acepta menos de 2 jugadores', async () => {
    await renderCreatePage();
    const players = screen.getByLabelText('Número de jugadores');
    await userEvent.clear(players);
    await userEvent.type(players, '1');
    expect(screen.getByText(/Deben ser entre 2 y/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled();
  });

  test('si no carga la configuración, ofrece reintentar', async () => {
    server = await startSocketTestServer();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red'); }));
    sessionStorage.setItem(NICKNAME_STORAGE_KEY, 'ana');
    render(
      <MemoryRouter initialEntries={['/crear']} future={ROUTER_FUTURE}>
        <SessionProvider createSocket={() => io(server.url, { transports: ['websocket'], forceNew: true })}>
          <App />
        </SessionProvider>
      </MemoryRouter>
    );
    expect(await screen.findByText(/No se pudo cargar la configuración/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('crear partida', () => {
  test('muestra el código y el tiempo para expirar, y la partida aparece en otro navegador', async () => {
    await renderCreatePage();
    const other = await otherPlayer('beto');
    const updated = nextEvent(other, 'lobby:update');

    await userEvent.click(screen.getByLabelText('Por largo'));
    await userEvent.selectOptions(screen.getByLabelText('Temática'), 'fruitMix');
    await userEvent.click(screen.getByLabelText(`Color ${backendConfig.colorPalette[1]}`));
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));

    const code = (await screen.findByLabelText('Código de la partida')).textContent;
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(screen.getByRole('timer')).toHaveTextContent('Expira en 3:00');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    const { games } = await updated;
    const game = games.find((g) => g.code === code);
    expect(game).toMatchObject({
      creator: 'ana',
      theme: 'fruitMix',
      mode: { type: 'length', value: backendConfig.gameModes.length.defaultTarget },
      maxPlayers: 2,
      usedColors: [backendConfig.colorPalette[1]]
    });
  });

  test('cuando otro jugador se une, se actualiza la lista de jugadores', async () => {
    await renderCreatePage();
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    const code = (await screen.findByLabelText('Código de la partida')).textContent;

    const other = await otherPlayer('beto');
    const res = await request(other, 'lobby:join', { code, color: backendConfig.colorPalette[1] });
    expect(res.ok).toBe(true);

    expect(await screen.findByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByText('beto')).toBeInTheDocument();
  });

  test('al expirar, el creador ve el aviso de cancelación', async () => {
    await renderCreatePage({ gameExpirationSeconds: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(await screen.findByLabelText('Código de la partida')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Partida cancelada' }, { timeout: 3000 }))
      .toBeInTheDocument();
    expect(screen.getByText(/no se completó a tiempo/)).toBeInTheDocument();
  });

  test('"Salir de la partida" vuelve al menú y la partida desaparece de la lista', async () => {
    await renderCreatePage();
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    await screen.findByLabelText('Código de la partida');

    await userEvent.click(screen.getByRole('button', { name: 'Salir de la partida' }));
    expect(await screen.findByRole('link', { name: 'Crear partida' })).toBeInTheDocument();

    const other = await otherPlayer('beto');
    await waitFor(async () => {
      const res = await request(other, 'lobby:list', {});
      expect(res.games).toHaveLength(0);
    });
  });
});
