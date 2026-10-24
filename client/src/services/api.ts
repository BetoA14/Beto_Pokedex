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
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetch(`/api/pokemon?${query}`, { signal });

  if (!response.ok) {
    throw new ApiError(response.status, "Could not load Pokémon. Please try again.");
  }

  return response.json();
}

// Encode the name as one URL segment, even if the input contains punctuation.
export async function getPokemonByName(
  name: string,
  signal: AbortSignal,
): Promise<Pokemon> {
  const response = await fetch(`/api/pokemon/${encodeURIComponent(name)}`, { signal });

  if (response.status === 404) {
    throw new ApiError(404, "Pokémon not found.");
  }
  if (response.status === 400) {
    throw new ApiError(400, "Use a full Pokémon name, such as pikachu or mr-mime, or a positive ID.");
  }
  if (!response.ok) {
    throw new ApiError(response.status, "Could not search for Pokémon. Please try again.");
  }

  return response.json();
}
