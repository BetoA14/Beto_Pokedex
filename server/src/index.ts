import { createApp } from "./app.ts";
import { createFavoritesStore } from "./db/favorites.ts";
import { createPokemonService } from "./services/pokemon.ts";
import { config } from "./config.ts";

// Read optional root .env settings consistently with the development proxy.
const { port } = config;

// Open the local file only at startup, rather than when tests import app.ts.
const favorites = createFavoritesStore();
const app = createApp(createPokemonService(), favorites);
// The loopback address keeps this listener local to the current computer.
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Pokedex API listening at http://127.0.0.1:${port}`);
});

server.on("error", (error) => {
  console.error("Could not start the Pokedex API:", error.message);
  console.error("If the port is occupied, stop the other server or change PORT in the root .env file.");
  favorites.close();
  process.exit(1);
});

// Finish active requests before closing SQLite during Ctrl+C or a watcher restart.
let isClosing = false;
function shutdown() {
  // Different shutdown signals may arrive together; close the shared connection only once.
  if (isClosing) return;
  isClosing = true;
  server.close(() => {
    favorites.close();
    process.exit(0);
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
