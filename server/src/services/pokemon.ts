import { HttpError } from "../errors.ts";
import type { Pokemon, PokemonPage } from "../types/pokemon.ts";
import { createCachedLoader } from "./cache.ts";
import { parsePokemon, parsePokemonList } from "./pokemon-validation.ts";

// Replace network access and the clock in tests without changing production behavior.
interface ServiceOptions {
  fetcher?: typeof fetch;
  now?: () => number;
}

// Each service instance owns its detail and list caches.
export function createPokemonService({
  fetcher = fetch,
  now = Date.now,
}: ServiceOptions = {}) {
  // Treat external JSON as unknown until a parser checks its shape.
  async function request(
    path: string,
    notFoundMessage?: string,
  ): Promise<unknown> {
    try {
      const response = await fetcher(`https://pokeapi.co/api/v2/${path}`, {
        // Bound each upstream request, including reading its response body.
        signal: AbortSignal.timeout(10_000),
      });

      // Only detail lookups translate an upstream 404 into "Pokemon not found".
      if (response.status === 404 && notFoundMessage) {
        throw new HttpError(404, notFoundMessage);
      }
      if (!response.ok) {
        throw new HttpError(502, "PokeAPI is temporarily unavailable");
      }
      return await response.json();
    } catch (error) {
      // Preserve intentional statuses; translate other failures into API errors.
      if (error instanceof HttpError) throw error;
      if (
        error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
      ) {
        throw new HttpError(504, "PokeAPI took too long to respond");
      }
      throw new HttpError(502, "Could not retrieve Pokemon data from PokeAPI");
    }
  }

  // Validate before caching; rejected or malformed responses are never stored.
  const getPokemon = createCachedLoader(
    async (key) =>
      parsePokemon(await request(`pokemon/${key}/`, "Pokemon not found")),
    { ttlMs: 60 * 60 * 1000, maxEntries: 500, now },
  );

  // Cache name lists separately from the details reused across pages.
  const getList = createCachedLoader(
    async (query) => parsePokemonList(await request(`pokemon/?${query}`)),
    { ttlMs: 60 * 60 * 1000, maxEntries: 100, now },
  );

  async function listPokemon(
    limit: number,
    offset: number,
  ): Promise<PokemonPage> {
    const page = await getList(`limit=${limit}&offset=${offset}`);
    const results: Pokemon[] = [];

    // A list from PokeAPI has names only. Fetch details in groups of five so
    // our response includes real image URLs without a burst of 50 requests.
    for (let index = 0; index < page.names.length; index += 5) {
      const batch = page.names.slice(index, index + 5);
      results.push(
        ...(await Promise.all(
          batch.map((pokemonName) => getPokemon(pokemonName)),
        )),
      );
    }

    // Return local navigation links so clients keep using our REST backend.
    const pageUrl = (pageOffset: number) =>
      `/api/pokemon?limit=${limit}&offset=${pageOffset}`;
    return {
      count: page.count,
      limit,
      offset,
      next: offset + limit < page.count ? pageUrl(offset + limit) : null,
      previous: offset > 0 ? pageUrl(Math.max(0, offset - limit)) : null,
      results,
    };
  }

  return { getPokemon, listPokemon };
}

// Derive the service type from its returned methods to avoid duplicate definitions.
export type PokemonService = ReturnType<typeof createPokemonService>;
