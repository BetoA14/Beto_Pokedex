import { HttpError } from "../errors.ts";
import type { Pokemon } from "../types/pokemon.ts";

// never means this helper always throws; callers cannot continue with invalid data.
function invalidResponse(): never {
  throw new HttpError(502, "PokeAPI returned an invalid response");
}

// Check the container first; its individual properties still need validation.
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidResponse();
  }
  return value as Record<string, unknown>;
}

// Array elements remain unknown until each one is checked.
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) return invalidResponse();
  return value;
}

// Accept lowercase names and identifiers such as mr-mime and special-attack.
function name(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return invalidResponse();
  }
  return value;
}

// Reject negative, fractional, and numerically unsafe values from external JSON.
function nonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return invalidResponse();
  }
  return value;
}

// Missing images are allowed; provided URLs must use HTTPS.
function imageUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return invalidResponse();
  try {
    if (new URL(value).protocol === "https:") return value;
  } catch {
    // Fall through to the same public error for malformed image URLs.
  }
  return invalidResponse();
}

// Validate the fields we consume and build our smaller public response shape.
export function parsePokemon(value: unknown): Pokemon {
  const data = object(value);
  const id = nonNegativeInteger(data.id);
  if (id === 0) return invalidResponse();

  // Prefer official artwork, falling back to the default sprite when it is null.
  const sprites = object(data.sprites);
  let image = imageUrl(sprites.front_default);
  if (sprites.other !== undefined && sprites.other !== null) {
    const artwork = object(sprites.other)["official-artwork"];
    if (artwork !== undefined && artwork !== null) {
      image = imageUrl(object(artwork).front_default) ?? image;
    }
  }

  return {
    id,
    name: name(data.name),
    image,
    // Unwrap each nested object before validating its name.
    types: array(data.types).map((entry) =>
      name(object(object(entry).type).name),
    ),
    // PokeAPI uses decimeters and hectograms; our API exposes meters and kilograms.
    heightMeters: nonNegativeInteger(data.height) / 10,
    weightKilograms: nonNegativeInteger(data.weight) / 10,
    abilities: array(data.abilities).map((entry) =>
      name(object(object(entry).ability).name),
    ),
    stats: array(data.stats).map((entry) => {
      const stat = object(entry);
      return {
        name: name(object(stat.stat).name),
        baseStat: nonNegativeInteger(stat.base_stat),
      };
    }),
  };
}

// Keep validated names only; the service fetches their details and builds local links.
export function parsePokemonList(value: unknown): {
  count: number;
  names: string[];
} {
  const data = object(value);
  const results = array(data.results);
  // Match our maximum page size before starting any detail requests.
  if (results.length > 50) return invalidResponse();

  return {
    count: nonNegativeInteger(data.count),
    names: results.map((entry) => name(object(entry).name)),
  };
}
