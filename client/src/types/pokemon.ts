// Match the JSON our backend exposes; these types describe data without validating it.
export interface Pokemon {
  id: number;
  name: string;
  image: string | null;
  types: string[];
  heightMeters: number;
  weightKilograms: number;
  abilities: string[];
  stats: { name: string; baseStat: number }[];
}

// count is the full collection size; results contains just one page.
export interface PokemonPage {
  count: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
  results: Pokemon[];
}
