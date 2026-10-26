// Our public API shape, built from validated PokeAPI fields.
export interface Pokemon {
  id: number
  name: string
  // Some Pokemon have neither artwork nor a default sprite.
  image: string | null
  types: string[]
  // parsePokemon converts the upstream measurements into these named units.
  heightMeters: number
  weightKilograms: number
  abilities: string[]
  // Each array element holds one stat's name and unmodified base value.
  stats: { name: string; baseStat: number }[]
}

// count is the total available; results contains only the requested page.
export interface PokemonPage {
  count: number
  limit: number
  // Offset is an entry count to skip, not a page number.
  offset: number
  // Navigation stays on our API; null means no page in that direction.
  next: string | null
  previous: string | null
  results: Pokemon[]
}
