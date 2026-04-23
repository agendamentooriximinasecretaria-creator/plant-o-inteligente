import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gestorplantao-favorites";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(read);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setFavorites(read());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const persist = (next: string[]) => {
    setFavorites(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const toggle = useCallback(
    (path: string) => {
      const next = favorites.includes(path)
        ? favorites.filter((p) => p !== path)
        : [...favorites, path];
      persist(next);
    },
    [favorites],
  );

  const isFavorite = useCallback((path: string) => favorites.includes(path), [favorites]);

  return { favorites, toggle, isFavorite };
}
