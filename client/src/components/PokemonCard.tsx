import { useState } from "react";
import type { Pokemon } from "../types/pokemon";

// Props are the values a parent component passes into this reusable card.
interface PokemonCardProps {
  pokemon: Pokemon;
}

export function PokemonCard({ pokemon }: PokemonCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayName = pokemon.name.replaceAll("-", " ");

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
      </div>
    </article>
  );
}
