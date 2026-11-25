import { useEffect, useState } from 'react';

/**
 * Objetivo: obtener un valor que solo cambia cuando el usuario deja de escribir.
 * Entradas: value (cualquier valor), delayMs (milisegundos de espera entre teclas).
 * Salidas: el último value, actualizado delayMs después del último cambio.
 * Restricciones: ninguna.
 */
export default function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
