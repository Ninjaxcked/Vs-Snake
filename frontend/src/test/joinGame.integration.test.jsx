/**
 * Pruebas de A6 (lista de partidas, selector de color y sala de espera)
 * contra el servidor real de Socket.IO del backend.
 */
import { createRequire } from 'node:module';
import { StrictMode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { io } from 'socket.io-client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import App, { ROUTER_FUTURE } from '../App.jsx';
import { NICKNAME_STORAGE_KEY, SessionProvider } from '../session/SessionContext.jsx';

const require = createRequire(import.meta.url);
const { startSocketTestServer, request } = require('../../../backend/test-utils/server.js');
const backendConfig = require('../../../backend/config/config.json');

const [RED, BLUE, GREEN] = backendConfig.colorPalette;
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
 * Objetivo: levantar el servidor y montar la app con el nickname 'ana' ya iniciado.
 * Entradas: path (ruta inicial), options.strict (envolver en React.StrictMode).
 * Salidas: promesa que termina cuando la app está montada.
 * Restricciones: GET /api/config se simula con fetch.
 */
async function renderApp(path, { strict = false } = {}) {
  if (!server) server = await startSocketTestServer();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => publicConfig(backendConfig) })));
  sessionStorage.setItem(NICKNAME_STORAGE_KEY, 'ana');
  const createSocket = () => io(server.url, { transports: ['websocket'], forceNew: true });
  const app = (
    <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
      <SessionProvider createSocket={createSocket}>
        <App />
      </SessionProvider>
    </MemoryRouter>
  );
  render(strict ? <StrictMode>{app}</StrictMode> : app);
}

/**
 * Objetivo: conectar otro jugador (otro navegador) con sesión iniciada.
 * Entradas: nickname.
 * Salidas: promesa con el socket cliente.
 * Restricciones: el servidor debe estar levantado.
 */
async function otherPlayer(nickname) {
  if (!server) server = await startSocketTestServer();
  const client = await server.connect();
  await request(client, 'auth:login', { nickname });
  return client;
}

/**
 * Objetivo: crear una partida desde otro jugador.
 * Entradas: client (socket con sesión), overrides (campos de lobby:create).
 * Salidas: promesa con el GameSummary creado.
 * Restricciones: falla la prueba si el servidor la rechaza.
 */
async function createGame(client, overrides = {}) {
  const res = await request(client, 'lobby:create', {
    mode: { type: 'time', value: 2 },
    theme: 'standard',
    maxPlayers: 2,
    color: RED,
    ...overrides
  });
  expect(res.ok).toBe(true);
  return res.game;
}

/**
 * Objetivo: obtener el botón de una partida en la lista.
 * Entradas: code (código de la partida).
 * Salidas: el botón.
 * Restricciones: la lista debe estar en pantalla.
 */
function gameButton(code) {
  return screen.getByRole('button', { name: new RegExp(code) });
}

describe('lista de partidas', () => {
  test('muestra código, temática, tipo con su valor, cupo y jugadores', async () => {
    const beto = await otherPlayer('beto');
    const game = await createGame(beto, { mode: { type: 'length', value: 15 }, theme: 'fruitMix', maxPlayers: 3 });
    await renderApp('/unirse');

    const item = await screen.findByRole('button', { name: new RegExp(game.code) });
    expect(item).toHaveTextContent('Fruit Mix · Por largo · 15 segmentos');
    expect(item).toHaveTextContent('1 / 3');
    expect(item).toHaveTextContent('beto');
  });

  test('sin partidas invita a crear una', async () => {
    await renderApp('/unirse');
    expect(await screen.findByText(/No hay partidas en espera/)).toBeInTheDocument();
  });

  test('con 3 navegadores, la lista se actualiza sin recargar', async () => {
    await renderApp('/unirse');
    await screen.findByText(/No hay partidas en espera/);

    const beto = await otherPlayer('beto');
    const game = await createGame(beto, { maxPlayers: 3 });
    expect(await screen.findByRole('button', { name: new RegExp(game.code) })).toHaveTextContent('1 / 3');

    const carla = await otherPlayer('carla');
    await request(carla, 'lobby:join', { code: game.code, color: BLUE });
    await waitFor(() => expect(gameButton(game.code)).toHaveTextContent('2 / 3'));
    expect(gameButton(game.code)).toHaveTextContent('carla');

    await request(beto, 'lobby:leave', { code: game.code });
    await waitFor(() => expect(gameButton(game.code)).not.toHaveTextContent('beto'));
  });

  test('una partida completa aparece bloqueada', async () => {
    const beto = await otherPlayer('beto');
    const game = await createGame(beto);
    const carla = await otherPlayer('carla');
    await request(carla, 'lobby:join', { code: game.code, color: BLUE });
    await renderApp('/unirse');

    const item = await screen.findByRole('button', { name: new RegExp(game.code) });
    expect(item).toHaveTextContent('Completa');
    expect(item).toBeDisabled();
  });

  test('si la partida elegida desaparece, avisa', async () => {
    const beto = await otherPlayer('beto');
    const game = await createGame(beto);
    await renderApp('/unirse');
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(game.code) }));

    await request(beto, 'lobby:leave', { code: game.code });
    expect(await screen.findByText(`La partida ${game.code} ya no está disponible.`)).toBeInTheDocument();
  });
});

describe('selector de color', () => {
  test('los colores usados aparecen bloqueados y se actualizan en vivo', async () => {
    const beto = await otherPlayer('beto');
    const game = await createGame(beto, { maxPlayers: 3, color: RED });
    await renderApp('/unirse');
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(game.code) }));

    expect(screen.getByLabelText(`Color ${RED} (en uso)`)).toBeDisabled();
    // Sugiere el primer color libre.
    expect(screen.getByLabelText(`Color ${BLUE}`)).toBeChecked();

    const carla = await otherPlayer('carla');
    await request(carla, 'lobby:join', { code: game.code, color: BLUE });

    expect(await screen.findByLabelText(`Color ${BLUE} (en uso)`)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unirse' })).toBeDisabled();
    await userEvent.click(screen.getByLabelText(`Color ${GREEN}`));
    expect(screen.getByRole('button', { name: 'Unirse' })).toBeEnabled();
  });
});

describe('sala de espera', () => {
  test('al unirse entra a la sala; "Entrar" se activa solo cuando la partida está completa', async () => {
    const beto = await otherPlayer('beto');
    const game = await createGame(beto, { maxPlayers: 3 });
    await renderApp('/unirse');
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(game.code) }));
    await userEvent.click(screen.getByRole('button', { name: 'Unirse' }));

    expect(await screen.findByRole('heading', { name: 'Sala de espera' })).toBeInTheDocument();
    expect(screen.getByLabelText('Código de la partida')).toHaveTextContent(game.code);
    const players = screen.getByRole('list', { name: 'Jugadores unidos' });
    expect(within(players).getByText('beto')).toBeInTheDocument();
    expect(within(players).getByText('ana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    expect(screen.getByText('Falta 1 jugador.')).toBeInTheDocument();

    const carla = await otherPlayer('carla');
    await request(carla, 'lobby:join', { code: game.code, color: GREEN });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled());
    expect(within(players).getByText('carla')).toBeInTheDocument();
    expect(screen.getByText('La partida está completa.')).toBeInTheDocument();
  });

  test('el creador también llega a la sala de espera y ve cuando alguien se une', async () => {
    await renderApp('/crear');
    await userEvent.click(await screen.findByRole('button', { name: 'Crear' }));
    expect(await screen.findByRole('heading', { name: 'Sala de espera' })).toBeInTheDocument();
    const code = screen.getByLabelText('Código de la partida').textContent;
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();

    const beto = await otherPlayer('beto');
    await request(beto, 'lobby:join', { code, color: BLUE });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled());
  });

  test('"Salir de la partida" libera el lugar', async () => {
    const beto = await otherPlayer('beto');
    const game = await createGame(beto, { maxPlayers: 3 });
    await renderApp('/unirse');
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(game.code) }));
    await userEvent.click(screen.getByRole('button', { name: 'Unirse' }));
    await screen.findByRole('heading', { name: 'Sala de espera' });

    await userEvent.click(screen.getByRole('button', { name: 'Salir de la partida' }));
    expect(await screen.findByRole('link', { name: 'Unirse a partida' })).toBeInTheDocument();

    const res = await request(beto, 'lobby:list', {});
    expect(res.games[0].players.map((p) => p.nickname)).toEqual(['beto']);
  });

  test('con React.StrictMode, entrar a la sala no saca al jugador de la partida', async () => {
    const beto = await otherPlayer('beto');
    const game = await createGame(beto, { maxPlayers: 3 });
    await renderApp('/unirse', { strict: true });
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(game.code) }));
    await userEvent.click(screen.getByRole('button', { name: 'Unirse' }));
    await screen.findByRole('heading', { name: 'Sala de espera' });

    await new Promise((r) => setTimeout(r, 100));
    const res = await request(beto, 'lobby:list', {});
    expect(res.games[0].players.map((p) => p.nickname)).toEqual(['beto', 'ana']);
  });

  test('sin datos de la partida (por ejemplo, al recargar) vuelve a la lista', async () => {
    await renderApp('/sala/ABC123');
    expect(await screen.findByRole('heading', { name: 'Unirse a partida' })).toBeInTheDocument();
  });

  test('si la partida expira, muestra el aviso de cancelación', async () => {
    const config = { ...backendConfig, lobby: { ...backendConfig.lobby, gameExpirationSeconds: 1 } };
    server = await startSocketTestServer({ config });
    const beto = await otherPlayer('beto');
    const game = await createGame(beto, { maxPlayers: 3 });
    await renderApp('/unirse');
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(game.code) }));
    await userEvent.click(screen.getByRole('button', { name: 'Unirse' }));
    await screen.findByRole('heading', { name: 'Sala de espera' });

    expect(await screen.findByRole('heading', { name: 'Partida cancelada' }, { timeout: 3000 }))
      .toBeInTheDocument();
  });
});
