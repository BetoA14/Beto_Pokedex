import express, { type ErrorRequestHandler } from "express";
import { HttpError } from "./errors.ts";
import { createPokemonRouter } from "./routes/pokemon.ts";
import {
  createPokemonService,
  type PokemonService,
} from "./services/pokemon.ts";

// Tests can supply an isolated service; normal startup uses the real one.
export function createApp(
  pokemonService: PokemonService = createPokemonService(),
) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  // Checks server availability without contacting PokeAPI.
  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", message: "Pokedex API is running" });
  });

  // Prefix every route in the Pokemon router with /api/pokemon.
  app.use("/api/pokemon", createPokemonRouter(pokemonService));

  // Runs only when no earlier route handled the request.
  app.use((_request, response) => {
    response.status(404).json({ message: "Endpoint not found" });
  });

  // Express recognizes error handlers by their four parameters, even unused ones.
  const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
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

export const app = createApp();
