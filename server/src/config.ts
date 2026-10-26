import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve from this module so source and compiled code work from any working directory.
const serverDirectory = fileURLToPath(new URL("../", import.meta.url));
try {
  // Values already set in the process environment take precedence over the file.
  loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch (error) {
  // A .env file is optional; other read/parse errors should remain visible.
  // The type assertion describes a possible Node error code; it does not convert the error.
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

// Environment values are strings, so validate the numeric conversion before listening.
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

export const config = {
  port,
  // Absolute paths are allowed; relative paths always start at server/.
  databasePath: resolve(serverDirectory, process.env.DATABASE_PATH || "data/pokedex.sqlite"),
  // Express serves this build folder; the database directory is never exposed as static files.
  clientDirectory: fileURLToPath(new URL("../../client/dist/", import.meta.url)),
};
