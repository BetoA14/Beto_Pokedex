# Beto Pokédex

A fullstack Pokémon web application built with React, TypeScript, and Express.
The backend supports paginated Pokémon lists and lookup by name or ID, with
validated responses and an in-memory cache. The React page currently checks
the backend connection; the Pokémon interface is the next milestone.

## Requirements

- Node.js 24 LTS and npm.

## Run locally

From the repository root:

```sh
npm install
npm run setup
npm run dev
```

On Windows PowerShell, use `npm.cmd` instead of `npm` if script execution is blocked.
Open the frontend URL printed by Vite (normally http://localhost:5173).
The page should display **Backend connected**. Stop both applications with Ctrl+C.
If you already have Vite running, stop it before using the root development command.

The API listens on http://127.0.0.1:3001. During development, Vite forwards `/api`
requests to it, so the browser uses relative URLs without a separate CORS setup.
If the backend port is changed with `PORT`, update the proxy target in
`client/vite.config.ts` as well.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install frontend and backend dependencies |
| `npm run dev` | Run both development servers with automatic reload |
| `npm run build` | Type-check and build both applications |
| `npm run lint` | Lint the frontend and type-check the backend |
| `npm test` | Run backend HTTP and cache tests without calling PokéAPI |

`npm run build` writes output into `client/dist` and `server/dist`.
The compiled API can be run with `npm start --prefix server`.
Serving the frontend and routing `/api` in production is not configured yet;
the Vite proxy applies only during development.

## Project structure

```text
client/                  React frontend
  src/App.tsx            Main page and connection status
  src/services/api.ts    Calls to our REST API
  vite.config.ts         Development proxy
server/                  Express backend
  src/app.ts             Express configuration and routes
  src/index.ts           Server startup
  src/routes/pokemon.ts  Input validation and Pokémon REST routes
  src/services/          PokéAPI fetching, response validation, and caching
  src/types/pokemon.ts   The Pokémon response types exposed by our API
  test/                  Backend HTTP and cache tests
README.md                Setup and project documentation
AI_USAGE.md              AI assistance and technical decisions
```

## Current REST API

`GET /api/health` returns:

```json
{ "status": "ok", "message": "Pokedex API is running" }
```

Unknown endpoints return HTTP 404 with a JSON error message.

### List Pokémon

```http
GET /api/pokemon?limit=20&offset=0
```

- `limit` defaults to 20 and accepts whole numbers from 1 to 50.
- `offset` defaults to 0 and accepts nonnegative safe integers up to
  `Number.MAX_SAFE_INTEGER - 50`, leaving room for pagination arithmetic.
- The response contains `count`, `limit`, `offset`, `next`, `previous`, and
  `results`. Each result contains the Pokémon details described below.
- `next` and `previous` are relative URLs pointing to **our API**, or `null`.
- An offset beyond the available results returns an empty `results` array.

### Find a Pokémon

```http
GET /api/pokemon/pikachu
GET /api/pokemon/25
```

Lookup accepts an exact PokéAPI name or positive numeric ID. Names are
case-insensitive, surrounding whitespace is trimmed, and hyphenated names such
as `mr-mime` are supported. Substring search is not implemented.

Example response:

```json
{
  "id": 25,
  "name": "pikachu",
  "image": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
  "types": ["electric"],
  "heightMeters": 0.4,
  "weightKilograms": 6,
  "abilities": ["static", "lightning-rod"],
  "stats": [
    { "name": "hp", "baseStat": 35 },
    { "name": "attack", "baseStat": 55 },
    { "name": "defense", "baseStat": 40 },
    { "name": "special-attack", "baseStat": 50 },
    { "name": "special-defense", "baseStat": 50 },
    { "name": "speed", "baseStat": 90 }
  ]
}
```

`image` prefers official artwork, falls back to the default sprite, and can be
`null` when neither is available. Image assets remain on the sprite host;
Pokémon JSON is fetched by our backend. Height and weight are converted from
PokéAPI's decimeters and hectograms into meters and kilograms.

### Error responses

Errors use a JSON body such as `{ "message": "Pokemon not found" }`.

| HTTP status | Meaning |
| --- | --- |
| 400 | Invalid pagination or lookup input |
| 404 | Pokémon or endpoint not found |
| 502 | PokéAPI network/HTTP failure, invalid JSON, or unexpected response shape |
| 504 | PokéAPI request exceeded the 10-second timeout |
| 500 | Unexpected internal error |

### Caching and upstream requests

- Validated Pokémon details and list resources are cached for one hour after a
  successful fetch, following [PokéAPI's fair-use guidance](https://pokeapi.co/docs/v2/#fairuse).
- At most 500 detail entries and 100 list entries are stored per server process.
  Expired entries are removed when loading new values; the oldest stored entry
  is evicted when a cache is full.
- Concurrent requests for the same key share the pending upstream request.
  Names and numeric IDs are separate keys, so looking up both can cause two fetches.
- Failures are not cached, allowing later requests to retry.
- List resources contain names only, so the backend also fetches each Pokémon's
  details in batches of up to five. These detail responses are reused by lookups.
- The cache is in memory: restarting the server clears it, and multiple processes
  do not share entries. No database or new dependency is needed for this milestone.

With the backend running, try these directly in your browser:

- http://127.0.0.1:3001/api/pokemon?limit=2
- http://127.0.0.1:3001/api/pokemon/pikachu
- http://127.0.0.1:3001/api/pokemon/does-not-exist

## Next milestones

- Display Pokémon images, names, and details, with loading and not-found states.
- Persist favorites in SQLite using a browser-generated UUID.
- Publish the completed code to a public Git repository.

React will consume our REST API; Pokémon data requests will be made by the backend.
The Pokémon endpoints are ready for the frontend to consume. Favorites are not
implemented yet.

## AI assistance

See [AI_USAGE.md](AI_USAGE.md) for tools, prompts, decisions, and verification.
