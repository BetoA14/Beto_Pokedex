import { Router } from "express";
import { HttpError } from "../errors.ts";
import type { PokemonService } from "../services/pokemon.ts";

// Query values arrive as strings; reject decimals, repeated values, and invalid ranges.
function integerQuery(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new HttpError(400, "limit and offset must be whole numbers");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `Query value must be between ${min} and ${max}`);
  }
  return parsed;
}

// This router is mounted under /api/pokemon in app.ts.
export function createPokemonRouter(service: PokemonService) {
  const router = Router();

  router.get("/", async (request, response) => {
    const limit = integerQuery(request.query.limit, 20, 1, 50);
    // Leave room to add the maximum page size without exceeding safe integers.
    const offset = integerQuery(
      request.query.offset,
      0,
      0,
      Number.MAX_SAFE_INTEGER - 50,
    );
    response.json(await service.listPokemon(limit, offset));
  });

  router.get("/:nameOrId", async (request, response) => {
    // Normalize equivalent names so they reuse the same cache entry.
    let key = request.params.nameOrId.trim().toLowerCase();
    if (/^\d+$/.test(key)) {
      const id = Number(key);
      if (!Number.isSafeInteger(id) || id < 1) {
        throw new HttpError(400, "Pokemon ID must be a positive safe integer");
      }
      // Normalize leading zeros: "00025" and "25" use the same lookup key.
      key = String(id);
    } else if (
      key.length > 100 ||
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(key)
    ) {
      throw new HttpError(400, "Use a Pokemon name or positive numeric ID");
    }
    // This is exact-name or ID lookup; missing Pokemon produce a JSON 404.
    response.json(await service.getPokemon(key));
  });

  return router;
}
