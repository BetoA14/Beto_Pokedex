# Beto Pokédex

A fullstack Pokémon web application built with React, TypeScript, and Express.
The backend supports paginated Pokémon lists and lookup by name or ID, with
validated responses and an in-memory cache. React displays Pokémon cards with
images, names, types, height, and weight, with 20 Pokémon per page. Search submits
an exact name or ID to the backend lookup endpoint and displays the matching card.
Favorites are stored in a local SQLite file and marked on cards in both views.

## Requirements

- An official Node.js **24.21 or newer within the 24.x LTS line**, with npm **11.x**.
  See [Node.js downloads](https://nodejs.org/en/download). `.nvmrc` selects Node 24
  for compatible version managers; package engine checks reject unsupported versions.
- Windows, macOS, or Linux supported by that Node.js distribution, plus a modern
  browser with local storage enabled.
- A writable project directory. SQLite is included in Node; no database installation,
  account, API key, or global TypeScript installation is required.
- Internet access for the initial npm install and for Pokémon data and images.
  Favorites are stored locally, but the Pokémon catalog is not an offline database.

## Run locally

From the repository root:

```sh
npm run setup
npm run dev
```

On Windows PowerShell, use `npm.cmd` instead of `npm` if script execution is blocked.
`npm run setup` installs root, frontend, and backend dependencies using their
committed lockfiles with `npm ci`. Run it after cloning or copying source code;
do not transfer another computer's `node_modules` or build output. Reinstalling
dependencies does not remove the local favorites database.
Open the frontend URL printed by Vite (normally http://localhost:5173).
The page loads a Pokémon card grid with Previous/Next controls. It also handles
loading, failed requests with a retry button, empty results, and unavailable images.
Use the search form or press Enter to look up a full name such as `pikachu` or
`mr-mime`. Searches ignore letter case and surrounding whitespace. A missing
Pokémon shows a 404 view. **Show all Pokémon** clears the search and returns to
the collection page you were browsing. Pagination is hidden during lookup.
Click **Add to favorites** on a card to save it. A confirmed save displays a filled
star and **Favorite**. Click **★ Favorite** to remove it; after confirmation, the
button returns to **☆ Add to favorites**. While a change is pending, the button
is disabled and shows **Saving…** or **Removing…**. Failed changes can be retried.
Click **Show all Favorites** to load the full saved set into the card grid,
including Pokémon outside the current collection page. Favorites have no page
controls. **Show all Pokémon** returns to the collection page you were browsing.
Removing a favorite hides its card after confirmation; removing the last one
shows **No favorites yet**. Detail-loading failures offer **Try again**.
Stop both applications with Ctrl+C.
If you already have Vite running, stop it before using the root development command.

The API normally listens on http://127.0.0.1:3001. During development, Vite forwards
`/api` requests to it, so the browser uses relative URLs without a separate CORS setup.
Both servers read the same optional root `.env` settings described below.

## Run the built application

After setup, run from the repository root:

```sh
npm run build
npm start
```

Open http://127.0.0.1:3001 (or the configured `PORT`). Express serves both the built
React files and the REST API from that address. Vite is not needed in this mode.
The source and built server use the same SQLite path. The built app has its own
browser origin, so its UUID is separate from the development page's UUID.

## Optional local settings

Copy `.env.example` to `.env` in the repository root using your editor, then edit:

```dotenv
PORT=3001
CLIENT_PORT=5173
DATABASE_PATH=data/pokedex.sqlite
```

- `PORT` sets the Express port and Vite's API proxy target automatically.
- `CLIENT_PORT` sets the development page's port. Vite exits if that port is
  occupied, so it cannot silently switch to an origin with a different browser UUID.
- `DATABASE_PATH` can be an absolute writable path. Relative paths start at
  `server/`, regardless of the terminal's working directory. Parent folders and
  tables are created automatically. Existing environment variables take precedence.
- No `.env` file is needed for the defaults. Restart the servers after editing it.

If a port is occupied, stop the previous app process or choose another port here.
If SQLite reports a permissions error, move the project to a writable folder or
choose a writable `DATABASE_PATH`. Keep the same browser origin to retain its UUID.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Clean-install all three packages from their lockfiles |
| `npm run check` | Verify the supported Node version and SQLite availability |
| `npm run dev` | Run both development servers with automatic reload |
| `npm run build` | Type-check and build both applications |
| `npm run lint` | Lint the frontend and type-check the backend |
| `npm test` | Run backend HTTP and cache tests without calling PokéAPI |
| `npm start` | Serve the built frontend and backend at one local address |
| `npm run smoke` | Check built startup and SQLite persistence after a build |
| `npm run verify` | Run lint, tests, builds, and the portability smoke check |

`npm run build` writes output into `client/dist` and `server/dist`.
The compiled server can also be run with `npm start --prefix server`.
The smoke check uses a temporary database and does not modify your favorites.

## Project structure

```text
client/                  React frontend
  src/App.tsx            Page loading, error handling, and pagination
  src/components/       Reusable Pokémon cards
  src/hooks/useFavorites.ts  Shared favorite state, loading, and saving
  src/services/api.ts    Calls to our REST API
  src/types/pokemon.ts   Frontend types matching the API response
  vite.config.ts         Development proxy
server/                  Express backend
  src/app.ts             Express configuration and routes
  src/index.ts           Server startup
  src/config.ts          Optional root .env and portable paths
  src/db/favorites.ts    Local SQLite connection, table setup, and prepared statements
  src/routes/favorites.ts  Favorite listing and addition endpoints
  src/routes/pokemon.ts  Input validation and Pokémon REST routes
  src/services/          PokéAPI fetching, response validation, and caching
  src/types/pokemon.ts   The Pokémon response types exposed by our API
  test/                  Backend HTTP, cache, and SQLite persistence tests
README.md                Setup and project documentation
AI_USAGE.md              AI assistance and technical decisions
scripts/                 Environment, setup, and built-app smoke checks
.github/workflows/ci.yml Windows/macOS/Linux verification workflow
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
  do not share entries. This cache is separate from the persistent favorites database.

With the backend running, try these directly in your browser:

- http://127.0.0.1:3001/api/pokemon?limit=2
- http://127.0.0.1:3001/api/pokemon/pikachu
- http://127.0.0.1:3001/api/pokemon/does-not-exist

## Local favorites storage

The database lives at **`server/data/pokedex.sqlite`** on the computer running
Express. It is created automatically, including its table, when the backend starts.
The path stays the same when running TypeScript source or compiled JavaScript.
Each fresh computer gets its own empty local database. It is never required in
the Git repository. `DATABASE_PATH` can override the default location.
No separate SQLite installation or database server is needed: we use Node 24's
built-in `node:sqlite` module.

Each favorite stores a browser UUID and a Pokémon ID. The combined primary key
prevents duplicate favorites for the same browser. Prepared statements bind values
to SQL placeholders rather than building SQL from user input.

The browser stores its UUID under `beto-pokedex-user-id` in local storage and
sends it in the `X-User-Id` header. This is an identifier, not account authentication.
The favorite records themselves live in SQLite. They survive page refreshes and
backend restarts. Clearing browser storage creates a new identity, so its old
records remain in the database but are no longer selected by that browser.
Different browsers have separate identities. Use the same browser origin, such as
`http://localhost:5173`, because browser storage is scoped to the origin.

Both APIs below require a version-4 UUID in `X-User-Id`:

| Endpoint | Result |
| --- | --- |
| `GET /api/favorites` | `{ "pokemonIds": [1, 25] }` for that browser |
| `PUT /api/favorites/25` | `{ "pokemonId": 25, "isFavorite": true }`; 201 for a new row, 200 for an existing row |
| `DELETE /api/favorites/25` | `{ "pokemonId": 25, "isFavorite": false }`; 200 even if already removed |

Invalid headers or IDs return 400. A new favorite is checked against the Pokémon
service before saving; a missing Pokémon returns 404 and upstream failures return
502/504. Repeating an existing favorite does not require another upstream request.
Removal uses only SQLite and never calls PokéAPI. It matches both the UUID and
Pokémon ID, so another browser's records remain unchanged.

Favorite loading errors have a separate retry button and do not hide Pokémon.
Add/remove errors stay on the affected card. The star changes only after a
successful response; a failed removal stays marked. Duplicate requests are safe
to repeat, and removal persists after refreshing or restarting the backend.
The favorites view uses the saved IDs loaded by `useFavorites` and retrieves their
details through our existing lookup endpoint in batches of five. It stays in sync
with confirmed add/remove operations, including a save completing after navigation.

`server/data/` is ignored by Git, so local favorites are not published with the code.
To back up the records, stop the backend and copy `pokedex.sqlite`. The backend
continues to listen on `127.0.0.1`, so this setup remains local to this computer.

## Portability verification

`npm run verify` runs the 23 backend tests, builds both applications, then starts
the compiled server from a different working directory. It checks serving the
React bundle, a custom port, automatic database/folder creation in a path with
spaces, and favorites surviving a server restart. These checks need no PokéAPI
connection and use isolated temporary databases.

When hosted on GitHub, the Actions workflow repeats setup and verification on
Windows, macOS, and Linux after a push or pull request. Local verification was performed on
Windows with Node 24.21.0/npm 11.19.0, including a clean installation in a separate
temporary folder. macOS/Linux results depend on running that workflow; they
have not been executed in this local session.

## Next milestones

- Publish the completed code to a public Git repository.

React consumes `/api/pokemon` and `/api/pokemon/:nameOrId` through our REST backend.
Only image assets are loaded directly from their sprite host. Search uses exact
names rather than substring matching. Favorites are saved locally through
`/api/favorites`.

## AI assistance

See [AI_USAGE.md](AI_USAGE.md) for tools, prompts, decisions, and verification.

## Additional project notes

See [additional_items.md](additional_items.md) for the approximately 8-hour effort
estimate and activity breakdown, scalability limits, and accessibility/responsive
design considerations.
