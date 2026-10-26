// Match the JSON our backend exposes; these types describe data without validating it.
export interface Pokemon {
  id: number;
  name: string;
  // A missing URL is valid; PokemonCard renders an image placeholder for null.
  image: string | null;
  types: string[];
  heightMeters: number;
  weightKilograms: number;
  abilities: string[];
  // Each object pairs a stat name, such as speed, with its base value.
  stats: { name: string; baseStat: number }[];
}

// count is the full collection size; results contains just one page.
export interface PokemonPage {
  count: number;
  limit: number;
  // The number of entries skipped, rather than a page number.
  offset: number;
  // Relative links to our API; null marks the first/last navigation boundary.
  next: string | null;
  previous: string | null;
  results: Pokemon[];
}
