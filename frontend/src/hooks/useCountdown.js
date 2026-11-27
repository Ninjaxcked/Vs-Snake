import { useEffect, useState } from 'react';

/** Cada cuánto se recalcula el tiempo restante (ms). */
const TICK_MS = 250;

/**
 * Objetivo: calcular los segundos que faltan para una hora límite.
 * Entradas: deadline (milisegundos de Date.now() en que termina) o null.
 * Salidas: segundos restantes, redondeados hacia arriba (nunca negativos), o null si no hay deadline.
 * Restricciones: ninguna.
 */
function secondsLeft(deadline) {
  if (deadline == null) return null;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/**
 * Objetivo: mostrar una cuenta regresiva que se actualiza sola.
 * Entradas: deadline (milisegundos de Date.now() en que termina) o null para no contar.
 * Salidas: segundos restantes (ver secondsLeft).
 * Restricciones: se detiene al llegar a 0.
 */
export default function useCountdown(deadline) {
  const [left, setLeft] = useState(() => secondsLeft(deadline));

  useEffect(() => {
    setLeft(secondsLeft(deadline));
    if (deadline == null) return undefined;
    const timer = setInterval(() => {
      const next = secondsLeft(deadline);
      setLeft(next);
      if (next === 0) clearInterval(timer);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [deadline]);

  return left;
}

/**
 * Objetivo: dar formato m:ss a una cantidad de segundos.
 * Entradas: seconds (entero >= 0).
 * Salidas: string, por ejemplo 125 -> '2:05'.
 * Restricciones: ninguna.
 */
export function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
