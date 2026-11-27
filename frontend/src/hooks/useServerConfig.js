import { useCallback, useEffect, useState } from 'react';
import { fetchPublicConfig } from '../api.js';

/**
 * Objetivo: cargar la configuración pública del servidor (GET /api/config).
 * Entradas: ninguna.
 * Salidas: { config, error, retry }. config es null mientras carga o si falló;
 *          error es true si falló; retry() vuelve a intentarlo.
 * Restricciones: ninguna.
 */
export default function useServerConfig() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetchPublicConfig()
      .then((data) => { if (!cancelled) setConfig(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { config, error, retry };
}
