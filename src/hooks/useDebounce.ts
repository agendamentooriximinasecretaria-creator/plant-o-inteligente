import { useEffect, useState } from "react";

/** Debounce de valor: retorna `value` somente após `delay` ms sem mudanças. */
export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
