import express, { type ErrorRequestHandler } from "express";
import { HttpError } from "./errors.ts";
import type { FavoritesStore } from "./db/favorites.ts";
import { createFavoritesRouter } from "./routes/favorites.ts";
import { createPokemonRouter } from "./routes/pokemon.ts";
import type { PokemonService } from "./services/pokemon.ts";
import { config } from "./config.ts";

// Startup supplies the real database; tests supply isolated stores and services.
export function createApp(
  pokemonService: PokemonService,
  favoritesStore: FavoritesStore,
) {
  const app = express();

  // Omit the framework-identifying response header.
  app.disable("x-powered-by");
  // Parse JSON request bodies before matching route handlers.
  app.use(express.json());

  // Checks server availability without contacting PokeAPI.
  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", message: "Pokedex API is running" });
  });

  // Prefix every route in the Pokemon router with /api/pokemon.
  app.use("/api/pokemon", createPokemonRouter(pokemonService));
  app.use("/api/favorites", createFavoritesRouter(favoritesStore, pokemonService));

  // Built mode serves React and REST from one local address, without Vite's proxy.
  app.use(express.static(config.clientDirectory));

  // Runs only when no earlier route handled the request.
  app.use((_request, response) => {
    response.status(404).json({ message: "Endpoint not found" });
  });

  // Express 5 forwards rejected async handlers here; four parameters identify this middleware.
  const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    // instanceof separates our expected HTTP errors from unexpected server failures.
    if (error instanceof HttpError) {
      response.status(error.status).json({ message: error.message });
      return;
    }
    // Log unexpected details on the server and return a generic public message.
    console.error("Unexpected API error:", error);
    response
      .status(500)
      .json({ message: "An unexpected server error occurred" });
  };
  // Register last so errors from earlier routes reach this handler.
  app.use(errorHandler);

  return app;
}
