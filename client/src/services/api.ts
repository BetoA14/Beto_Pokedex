import type { PokemonPage } from "../types/pokemon";

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
    throw new Error("Could not load Pokémon. Please try again.");
  }

  return response.json();
}
