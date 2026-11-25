/**
 * Contexto de sesión: un único socket y el nickname del jugador, compartidos por toda la aplicación.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../config.js';
import { EVENTS } from '../protocol/events.js';

/** Clave de sessionStorage donde se recuerda el nickname de esta pestaña. */
export const NICKNAME_STORAGE_KEY = 'vs-snake:nickname';

/** Tiempo máximo de espera por una respuesta del servidor. */
const ACK_TIMEOUT_MS = 5000;

export const SessionContext = createContext(null);

/**
 * Objetivo: crear la conexión de Socket.IO con el servidor de juego.
 * Entradas: ninguna.
 * Salidas: socket de socket.io-client.
 * Restricciones: usa VITE_SERVER_URL (ver src/config.js).
 */
function createDefaultSocket() {
  return io(SERVER_URL, { transports: ['websocket', 'polling'] });
}

/**
 * Objetivo: emitir un evento y esperar la respuesta con el formato { ok, ... } del protocolo.
 * Entradas: socket, event (nombre), payload (datos).
 * Salidas: promesa con la respuesta; si no llega a tiempo, una respuesta de error.
 * Restricciones: nunca rechaza la promesa.
 */
export async function request(socket, event, payload) {
  try {
    return await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload);
  } catch {
    return { ok: false, error: { code: 'TIMEOUT', message: 'El servidor no respondió' } };
  }
}

/**
 * Objetivo: proveer la sesión (socket + nickname) a toda la aplicación.
 * Entradas: children (componentes), createSocket (opcional, para pruebas).
 * Salidas: SessionContext.Provider con { socket, connected, restoring, nickname,
 *          checkNickname, login, logout }.
 * Restricciones: debe envolver a todos los componentes que usan useSession().
 */
export function SessionProvider({ children, createSocket = createDefaultSocket }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [nickname, setNickname] = useState(null);
  const [restoring, setRestoring] = useState(() => Boolean(sessionStorage.getItem(NICKNAME_STORAGE_KEY)));

  useEffect(() => {
    const newSocket = createSocket();
    setSocket(newSocket);

    /**
     * Objetivo: al (re)conectar, volver a iniciar sesión con el nickname recordado.
     * Entradas: ninguna.
     * Salidas: ninguna (actualiza el estado).
     * Restricciones: si el nickname ya no está libre, se olvida y hay que elegir otro.
     */
    const handleConnect = async () => {
      setConnected(true);
      const saved = sessionStorage.getItem(NICKNAME_STORAGE_KEY);
      if (!saved) {
        setRestoring(false);
        return;
      }
      setRestoring(true);
      const res = await request(newSocket, EVENTS.AUTH_LOGIN, { nickname: saved });
      if (res.ok) {
        setNickname(res.nickname);
      } else {
        sessionStorage.removeItem(NICKNAME_STORAGE_KEY);
        setNickname(null);
      }
      setRestoring(false);
    };

    /**
     * Objetivo: marcar la sesión como desconectada (el servidor ya liberó el nickname).
     * Entradas: ninguna.
     * Salidas: ninguna.
     * Restricciones: el nickname sigue en sessionStorage para recuperarlo al reconectar.
     */
    const handleDisconnect = () => {
      setConnected(false);
      setNickname(null);
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);
    if (newSocket.connected) handleConnect();

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.disconnect();
    };
  }, [createSocket]);

  /**
   * Objetivo: preguntar al servidor si un nickname está libre.
   * Entradas: value (string).
   * Salidas: promesa con { ok, available, reason? } o { ok: false, error }.
   * Restricciones: requiere socket.
   */
  const checkNickname = useCallback(
    (value) => (socket ? request(socket, EVENTS.AUTH_CHECK, { nickname: value }) : Promise.resolve({ ok: false })),
    [socket]
  );

  /**
   * Objetivo: iniciar sesión con un nickname.
   * Entradas: value (string).
   * Salidas: promesa con { ok: true, nickname } o { ok: false, error }.
   * Restricciones: requiere estar conectado.
   */
  const login = useCallback(
    async (value) => {
      if (!socket || !socket.connected) {
        return { ok: false, error: { code: 'DISCONNECTED', message: 'Sin conexión con el servidor' } };
      }
      const res = await request(socket, EVENTS.AUTH_LOGIN, { nickname: value });
      if (res.ok) {
        sessionStorage.setItem(NICKNAME_STORAGE_KEY, res.nickname);
        setNickname(res.nickname);
      }
      return res;
    },
    [socket]
  );

  /**
   * Objetivo: cerrar la sesión y liberar el nickname en el servidor.
   * Entradas: ninguna.
   * Salidas: ninguna.
   * Restricciones: reconecta el socket para poder iniciar sesión de nuevo.
   */
  const logout = useCallback(() => {
    sessionStorage.removeItem(NICKNAME_STORAGE_KEY);
    setNickname(null);
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  }, [socket]);

  const value = useMemo(
    () => ({ socket, connected, restoring, nickname, checkNickname, login, logout }),
    [socket, connected, restoring, nickname, checkNickname, login, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * Objetivo: acceder a la sesión desde cualquier componente.
 * Entradas: ninguna.
 * Salidas: objeto de la sesión (ver SessionProvider).
 * Restricciones: solo dentro de <SessionProvider>.
 */
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return session;
}
