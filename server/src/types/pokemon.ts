export interface Pokemon {
  id: number
  name: string
  image: string | null
  types: string[]
  heightMeters: number
  weightKilograms: number
  abilities: string[]
  stats: { name: string; baseStat: number }[]
}

export interface PokemonPage {
  count: number
  limit: number
  offset: number
  next: string | null
  previous: string | null
  results: Pokemon[]
}
