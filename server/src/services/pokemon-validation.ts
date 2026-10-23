import { HttpError } from '../errors.ts'
import type { Pokemon } from '../types/pokemon.ts'

function invalidResponse(): never {
  throw new HttpError(502, 'PokeAPI returned an invalid response')
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalidResponse()
  }
  return value as Record<string, unknown>
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) return invalidResponse()
  return value
}

function name(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return invalidResponse()
  }
  return value
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return invalidResponse()
  }
  return value
}

function imageUrl(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') return invalidResponse()
  try {
    if (new URL(value).protocol === 'https:') return value
  } catch {
    // Fall through to the same public error for malformed image URLs.
  }
  return invalidResponse()
}

export function parsePokemon(value: unknown): Pokemon {
  const data = object(value)
  const id = nonNegativeInteger(data.id)
  if (id === 0) return invalidResponse()

  const sprites = object(data.sprites)
  let image = imageUrl(sprites.front_default)
  if (sprites.other !== undefined && sprites.other !== null) {
    const artwork = object(sprites.other)['official-artwork']
    if (artwork !== undefined && artwork !== null) {
      image = imageUrl(object(artwork).front_default) ?? image
    }
  }

  return {
    id,
    name: name(data.name),
    image,
    types: array(data.types).map((entry) => name(object(object(entry).type).name)),
    heightMeters: nonNegativeInteger(data.height) / 10,
    weightKilograms: nonNegativeInteger(data.weight) / 10,
    abilities: array(data.abilities).map((entry) => name(object(object(entry).ability).name)),
    stats: array(data.stats).map((entry) => {
      const stat = object(entry)
      return {
        name: name(object(stat.stat).name),
        baseStat: nonNegativeInteger(stat.base_stat),
      }
    }),
  }
}

export function parsePokemonList(value: unknown): { count: number; names: string[] } {
  const data = object(value)
  const results = array(data.results)
  if (results.length > 50) return invalidResponse()

  return {
    count: nonNegativeInteger(data.count),
    names: results.map((entry) => name(object(entry).name)),
  }
}
