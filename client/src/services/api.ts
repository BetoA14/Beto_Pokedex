import type { Pokemon, PokemonPage } from "../types/pokemon";

// Preserve HTTP status codes so the UI can distinguish a missing Pokemon from an outage.
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Store only the browser identity here; favorite records live in the server's SQLite file.
function getUserId(): string {
  const key = "beto-pokedex-user-id";
  const storedId = localStorage.getItem(key);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Reuse a valid identity across refreshes; replace a missing or malformed value.
  if (storedId && uuidPattern.test(storedId)) return storedId;

  const userId = crypto.randomUUID();
  localStorage.setItem(key, userId);
  return userId;
}

// This endpoint returns membership IDs only; the card details are fetched separately.
export async function getFavoriteIds(signal: AbortSignal): Promise<number[]> {
  const response = await fetch("/api/favorites", {
    signal,
    headers: { "X-User-Id": getUserId() },
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Could not load favorites. Please try again.");
  }
  // This annotation describes our backend contract, without adding runtime validation.
  const data: { pokemonIds: number[] } = await response.json();
  return data.pokemonIds;
}

// Fetch every saved ID, including favorites outside the currently displayed page.
export async function getFavoritePokemon(
  pokemonIds: number[],
  signal: AbortSignal,
): Promise<Pokemon[]> {
  const results: Pokemon[] = [];
  // Limit concurrent requests to our backend instead of sending a large burst.
  for (let index = 0; index < pokemonIds.length; index += 5) {
    const batch = pokemonIds.slice(index, index + 5);
    // Promise.all preserves batch order; ... appends each returned Pokemon to the array.
    results.push(...await Promise.all(
      batch.map((id) => getPokemonByName(String(id), signal)),
    ));
  }
  return results;
}

// PUT is safe to repeat: the database keeps only one row per browser and Pokemon.
// Promise<void> means callers await confirmation without needing response data.
export async function addFavorite(pokemonId: number): Promise<void> {
  const response = await fetch(`/api/favorites/${pokemonId}`, {
    method: "PUT",
    headers: { "X-User-Id": getUserId() },
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Could not save this favorite. Please try again.");
  }
}

// Removal uses the same browser identity as reading and adding favorites.
export async function removeFavorite(pokemonId: number): Promise<void> {
  const response = await fetch(`/api/favorites/${pokemonId}`, {
    method: "DELETE",
    headers: { "X-User-Id": getUserId() },
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Could not remove this favorite. Please try again.");
  }
}

// Expected health response; TypeScript types do not validate incoming JSON.
interface HealthResponse {
  status: "ok";
  message: string;
}

// The caller supplies a signal so React can cancel an obsolete request.
export async function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  const response = await fetch("/api/health", { signal });

  // fetch does not reject automatically for HTTP error statuses.
  if (!response.ok) {
    throw new Error(`Health request failed (${response.status})`);
  }

  return response.json();
}

// Call our backend through Vite's proxy; the browser never fetches Pokemon JSON from PokeAPI.
export async function getPokemonPage(
  limit: number,
  offset: number,
  signal: AbortSignal,
): Promise<PokemonPage> {
  // URLSearchParams encodes query values; URL parameters are text rather than numbers.
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetch(`/api/pokemon?${query}`, { signal });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "Could not load Pokémon. Please try again.",
    );
  }

  return response.json();
}

// Accept an exact name or numeric ID, encoded as one URL segment.
export async function getPokemonByName(
  name: string,
  signal: AbortSignal,
): Promise<Pokemon> {
  const response = await fetch(`/api/pokemon/${encodeURIComponent(name)}`, {
    signal,
  });

  if (response.status === 404) {
    throw new ApiError(404, "Pokémon not found.");
  }
  if (response.status === 400) {
    throw new ApiError(
      400,
      "Use a full Pokémon name, such as pikachu or mr-mime, or a positive ID.",
    );
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      "Could not search for Pokémon. Please try again.",
    );
  }

  return response.json();
}
