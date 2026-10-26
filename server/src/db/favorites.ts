import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config.ts";

// Source and compiled startup share the same configured local database path.
export const databasePath = config.databasePath;

export function createFavoritesStore(filename: string = databasePath) {
  // Tests use an isolated in-memory database; normal startup creates a local file.
  let database: DatabaseSync;
  try {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    database = new DatabaseSync(filename);
  } catch (cause) {
    throw new Error(`Could not open SQLite at ${filename}. Use a writable folder or set DATABASE_PATH in .env.`, { cause });
  }
  // Wait up to five seconds for file locks; IF NOT EXISTS preserves existing tables and records.
  // The combined primary key prevents duplicates, and STRICT enforces column types.
  database.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      pokemon_id INTEGER NOT NULL CHECK (pokemon_id > 0),
      PRIMARY KEY (user_id, pokemon_id)
    ) STRICT;
  `);

  // Bind values through placeholders; never insert user input into SQL strings.
  const list = database.prepare("SELECT pokemon_id FROM favorites WHERE user_id = ? ORDER BY pokemon_id");
  const find = database.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND pokemon_id = ?");
  const insert = database.prepare("INSERT OR IGNORE INTO favorites (user_id, pokemon_id) VALUES (?, ?)");
  // Match both columns so removing a favorite never affects another browser's records.
  const remove = database.prepare("DELETE FROM favorites WHERE user_id = ? AND pokemon_id = ?");

  // These methods share the open connection and reuse its prepared statements.
  return {
    list(userId: string): number[] {
      // Store membership only; Pokemon details continue to come from the API service.
      return list.all(userId).map((row) => Number(row.pokemon_id));
    },
    has(userId: string, pokemonId: number): boolean {
      // get returns undefined when no row matches the two bound values.
      return find.get(userId, pokemonId) !== undefined;
    },
    add(userId: string, pokemonId: number): boolean {
      // The combined primary key makes repeated additions harmless.
      return Number(insert.run(userId, pokemonId).changes) === 1;
    },
    remove(userId: string, pokemonId: number): void {
      remove.run(userId, pokemonId);
    },
    close() {
      database.close();
    },
  };
}

export type FavoritesStore = ReturnType<typeof createFavoritesStore>;
