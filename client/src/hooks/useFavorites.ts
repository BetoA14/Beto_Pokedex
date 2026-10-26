import { useEffect, useState } from "react";
import { addFavorite, getFavoriteIds, removeFavorite } from "../services/api";

// A custom hook groups favorite state so App can stay focused on browsing and search.
export function useFavorites() {
  // null means not loaded; [] means loading succeeded and this browser has no favorites.
  const [favoriteIds, setFavoriteIds] = useState<number[] | null>(null);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    // Fetch on mount or retry; star clicks update local state after their own requests.
    const controller = new AbortController();
    async function loadFavorites() {
      try {
        const ids = await getFavoriteIds(controller.signal);
        if (!controller.signal.aborted) setFavoriteIds(ids);
      } catch {
        if (!controller.signal.aborted) {
          setFavoritesError("We couldn't load your favorites. Please try again.");
        }
      }
    }
    void loadFavorites();
    // Cancel this read on cleanup, including StrictMode's development effect replay.
    return () => controller.abort();
  }, [reloadCount]);

  function retryFavorites() {
    // Mark membership as unknown so cards cannot write before the replacement read finishes.
    setFavoriteIds(null);
    setFavoritesError(null);
    setReloadCount((current) => current + 1);
  }

  async function updateFavorite(pokemonId: number, isFavorite: boolean) {
    // Request the desired state explicitly, rather than guessing from an old state value.
    if (isFavorite) {
      await addFavorite(pokemonId);
    } else {
      await removeFavorite(pokemonId);
    }
    // Update only after SQLite confirms the change; failures leave the indicator intact.
    // A functional updater preserves other card changes that completed while this request ran.
    setFavoriteIds((current) => {
      const ids = current ?? [];
      // filter and spread create new arrays instead of mutating React's existing state.
      if (!isFavorite) return ids.filter((id) => id !== pokemonId);
      return ids.includes(pokemonId) ? ids : [...ids, pokemonId];
    });
  }

  return { favoriteIds, favoritesError, retryFavorites, updateFavorite };
}
