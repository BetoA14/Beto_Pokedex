// Our public API shape, built from validated PokeAPI fields.
export interface Pokemon {
  id: number
  name: string
  // Some Pokemon have neither artwork nor a default sprite.
  image: string | null
  types: string[]
  heightMeters: number
  weightKilograms: number
  abilities: string[]
  stats: { name: string; baseStat: number }[]
}

// count is the total available; results contains only the requested page.
export interface PokemonPage {
  count: number
  limit: number
  offset: number
  // Navigation stays on our API; null means no page in that direction.
  next: string | null
  previous: string | null
  results: Pokemon[]
}
