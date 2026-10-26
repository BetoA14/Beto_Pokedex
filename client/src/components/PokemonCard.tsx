import { useState } from "react";
import type { Pokemon } from "../types/pokemon";

// Props are the values a parent component passes into this reusable card.
interface PokemonCardProps {
  pokemon: Pokemon;
  isFavorite: boolean;
  favoritesReady: boolean;
  // The parent performs the API change; this Promise lets the card show pending/error feedback.
  onFavoriteChange: (pokemonId: number, isFavorite: boolean) => Promise<void>;
}

export function PokemonCard({ pokemon, isFavorite, favoritesReady, onFavoriteChange }: PokemonCardProps) {
  // Favorite selection comes from App; these values belong only to this card's UI.
  const [imageFailed, setImageFailed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  // Change display text without altering the exact name used by the API.
  const displayName = pokemon.name.replaceAll("-", " ");

  async function handleFavorite() {
    // ! flips the confirmed boolean to choose the opposite state.
    const nextIsFavorite = !isFavorite;
    setIsUpdating(true);
    setFavoriteError(null);
    try {
      await onFavoriteChange(pokemon.id, nextIsFavorite);
    } catch {
      // A failed removal stays marked as favorite and can be retried on this card.
      setFavoriteError(nextIsFavorite
        ? "Couldn't add favorite. Please try again."
        : "Couldn't remove favorite. Please try again.");
    } finally {
      // Re-enable the control after either success or failure.
      setIsUpdating(false);
    }
  }

  // Describe the pending action while keeping the last confirmed star state visible.
  let favoriteLabel = isFavorite ? "Favorite" : "Add to favorites";
  if (isUpdating) favoriteLabel = isFavorite ? "Removing…" : "Saving…";

  return (
    <article className="pokemon-card" aria-labelledby={`pokemon-${pokemon.id}`}>
      <div className="pokemon-artwork">
        <span className="pokemon-number">#{String(pokemon.id).padStart(4, "0")}</span>
        {/* Handle both a missing image URL and a URL that fails to load. */}
        {pokemon.image && !imageFailed ? (
          <img
            src={pokemon.image}
            alt={displayName}
            width={180}
            height={180}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <p className="image-placeholder">No image available</p>
        )}
      </div>

      <div className="pokemon-info">
        <h3 id={`pokemon-${pokemon.id}`}>{displayName}</h3>
        <ul className="pokemon-types" aria-label="Types">
          {pokemon.types.map((type) => (
            <li className={`type-badge type-${type}`} key={type}>
              {type}
            </li>
          ))}
        </ul>
        {/* A description list pairs each measurement label with its value. */}
        <dl className="pokemon-measurements">
          <div>
            <dt>Height</dt>
            <dd>{pokemon.heightMeters} m</dd>
          </div>
          <div>
            <dt>Weight</dt>
            <dd>{pokemon.weightKilograms} kg</dd>
          </div>
        </dl>
        {/* aria-pressed reports selection; disabling pending changes prevents duplicate clicks. */}
        <button
          type="button"
          className="favorite-button"
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${displayName} from favorites` : `Add ${displayName} to favorites`}
          aria-busy={isUpdating}
          disabled={!favoritesReady || isUpdating}
          onClick={handleFavorite}
        >
          <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>{" "}
          {favoriteLabel}
        </button>
        {favoriteError && <p className="favorite-error" role="alert">{favoriteError}</p>}
      </div>
    </article>
  );
}
