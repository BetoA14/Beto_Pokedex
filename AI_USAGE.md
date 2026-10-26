# AI usage

## Tools and agents

- OpenAI Codex, GPT-6-based assistant. The exact deployed model build is not
  exposed in this session. Used for project planning, backend scaffolding,
  connecting React to Express, Pokémon cards and pagination, local SQLite favorites,
  documentation, and verification.
- No additional AI agents were used.

## Main prompts and iteration

1. The user requested help building a simple fullstack Pokédex with React and
   TypeScript, a REST backend wrapping PokéAPI, name search, favorites, a public
   Git repository, setup instructions, and an AI usage record.
2. The user asked: "Explain the project structure". Codex explained the proposed
   client/server layout and how requests would flow through the backend.
3. The user reported: "Sounds good, I have ran the commands you sent".
   After inspecting the generated Vite project, Codex added the Express foundation
   and a frontend health check as the next incremental milestone.
4. The user asked about `/api/health`, `AbortController`, asynchronous function
   signatures, and mismatched JSON shapes. Codex explained these without changing
   code, including the difference between TypeScript types and runtime validation.
5. The user asked to "return to adding the backend endpoint that fetches and caches
   Pokémon from PokéAPI". Codex implemented listing and exact-name/ID lookup,
   bounded caching, runtime validation, error responses, tests, and documentation.
6. The user requested: "Add useful comments to all .ts and .tsx files. Keep them
   brief but understandable." Codex added comments explaining purpose and less
   obvious behavior across the 14 project TypeScript files, preserving existing code.
7. The user requested useful brief comments, beginner-friendly explanations of
   changes, smaller steps, and consistent semicolons and commas in new code.
8. The user asked: "Let's move on to connecting these endpoints to Pokémon cards
   in React". Codex connected the listing endpoint to reusable cards, added
   pagination, loading/error/retry/empty states and image fallbacks, and updated docs.
9. The user asked: "Let's continue to connecting a name search to the lookup
   endpoint". Codex added a submitted search form, exact-name/ID lookup, a 404
   view, and a way back to the previous collection page, with comments and explanations.
10. The user asked where SQLite data would live, then requested: "Let's implement
    SQLite and keep the favorites stored in the local computer." Codex implemented
    a local SQLite store, favorites REST endpoints, browser UUID identification,
    React favorite controls, tests, and documentation.
11. The user requested: "Make sure this project can run on any computer without
    issues, including the local database". Codex audited portable paths and setup,
    added runtime requirements, locked clean installation, optional environment
    configuration, built frontend serving, a portability smoke check, and a
    Windows/macOS/Linux CI workflow, then tested a fresh standalone copy.
12. The user requested removing a Pokémon by clicking the **★ Favorite** button.
    Codex added browser-scoped DELETE support and changed the control into an
    add/remove toggle with confirmation, pending states, failure retry, and tests.
13. The user requested: "Add a button to do Show all Favorites which pulls the
    favorite Pokemons and show them in the card grid". Codex added a favorites
    grid mode using saved IDs and the existing lookup API, view navigation,
    loading/empty/error states, and synchronization with confirmed favorite changes.
14. The user requested a review of all `.ts` and `.tsx` files for additional useful,
    brief comments explaining how the code works. Codex reviewed and expanded comments
    in all 21 project TypeScript files, including source, Vite configuration, and tests.
15. The user requested `additional_items.md` covering time spent and its split,
    scalability, and accessibility/responsive design. The user supplied an estimate
    of around 8 total hours. Codex documented that total and a qualitative activity
    breakdown, without inventing per-phase hours, and separated implemented
    behavior from scaling recommendations and outstanding accessibility checks.

## Technical decisions and ownership

| Decision | Reason and trade-off | Origin |
| --- | --- | --- |
| React and TypeScript | Match the user's requested frontend and existing setup | User |
| Vite | Simple React development and production builds | Suggested by Codex; user ran the scaffold commands |
| Node.js, Express, and TypeScript | Keep both sides in one language with a small REST layer | Suggested by Codex; user accepted the proposed structure |
| Separate client and server packages in one repository | Clear boundaries; separate dependency installs managed through root scripts | Suggested by Codex |
| Vite development proxy | Relative `/api` requests without extra CORS middleware locally; production routing remains to be configured | Suggested by Codex |
| React component state and effects | Manage page data, loading, errors, offset, and retry locally without another state library; cancel outdated requests during effect cleanup | Suggested by Codex |
| Reusable PokemonCard component and frontend API types | Each card receives a Pokemon prop; local type definitions keep the client independent of backend modules, with the trade-off of keeping response types in sync | Suggested and implemented by Codex |
| CSS Grid with automatic columns | Adapt the collection to available width without a UI dependency | Suggested and implemented by Codex |
| Separate editable input and submitted search term | Fetch only on submission, permit repeated searches, and keep typing from changing the displayed result | Suggested and implemented by Codex |
| Client ApiError with an HTTP status | Distinguish missing Pokemon from invalid input and retryable failures without trusting arbitrary upstream error bodies | Suggested and implemented by Codex |
| Native Node 24 TypeScript execution | Runs the development backend without an additional TypeScript runner; the compiler emits JavaScript for the build | Suggested by Codex |
| SQLite and a browser UUID for favorites | Records stay in server/data/pokedex.sqlite and survive restarts; each browser stores its identity locally without account setup | Local SQLite storage explicitly chosen by the user; UUID approach suggested by Codex from the assignment recommendations |
| Built-in node:sqlite and synchronous prepared statements | Avoid an additional driver or database service; brief synchronous operations suit this small local app, while larger workloads may need a different approach | Suggested and implemented by Codex |
| Idempotent PUT/DELETE favorites | The composite key prevents duplicate additions; deletion matches UUID and Pokemon ID and needs no upstream request | Initial add behavior suggested by Codex; removal explicitly requested by the user |
| Custom useFavorites hook | Keep favorite loading and shared state separate from browsing/search and let all cards reflect successful saves consistently | Suggested and implemented by Codex |
| Explicit collection/search/favorites view state | Keep headings, empty messages, and navigation consistent while reusing one card grid | Suggested and implemented by Codex |
| Fetch favorite details from existing lookup endpoints in batches of five | Include saved Pokemon from all collection pages without a new backend API; client requests still go only to our REST backend | Suggested and implemented by Codex |
| Supported Node 24.21+ within 24.x and npm 11.x | Keep native SQLite and TypeScript execution on a tested runtime line; engine checks and .nvmrc make prerequisites explicit | Suggested and implemented by Codex |
| Node-based setup with npm ci for all packages | Install committed versions on each OS without shell-specific scripts or copied native dependencies | Suggested and implemented by Codex |
| Optional root .env and module-relative paths | Configure ports and writable database location without machine-specific source edits; source and compiled server share the same database | Suggested and implemented by Codex |
| Express serves built React output | Provide a root npm start command with one local origin for UI and API, while retaining Vite for development | Suggested and implemented by Codex |
| Three-OS CI plus restart smoke check | Continuously test setup, builds, database creation, and persistence; Linux/macOS verification requires the GitHub workflow to run | Suggested and implemented by Codex |
| Backend PokéAPI wrapper | Keep Pokémon data requests on the server and expose a smaller response shape with explicit measurement units | Assignment requirement; implementation designed by Codex |
| One-hour bounded in-memory caches | No extra service or database; restarting clears entries and multiple processes do not share the cache | Suggested and implemented by Codex |
| Shared pending requests and batches of five detail requests per page | Reduce duplicate fetches and limit upstream request bursts for a list request | Suggested and implemented by Codex |
| Exact-name/ID lookup and offset pagination | Small REST API with local navigation links; substring matching is not included | Suggested and implemented by Codex |
| Manual runtime validation of upstream JSON | Reject unexpected data before caching; avoids a new validation dependency for this scope | Suggested and implemented by Codex following the user's questions |
| Node's built-in test runner and mocked upstream fetch | Verify HTTP behavior and caching without new dependencies or relying on PokéAPI availability | Suggested and implemented by Codex |

## Verification and review

- Codex inspected the existing package files and Vite configuration before editing.
- Codex consulted the official Express installation and Vite proxy documentation.
- Build, lint, and HTTP smoke-check results are recorded after verification below.
- The Vite starter screen was replaced with a small connection status page.
- The initial foundation had no automated suite. Backend HTTP and cache tests were
  added during the Pokémon endpoint milestone.
- User review and browser acceptance of the new foundation are still pending.
- An initial `tsx` development runner failed in the restricted execution environment
  while looking up OS user information. Codex removed it and used Node 24's built-in
  TypeScript support instead, then rechecked startup and compilation.

### Verification results

- `npm.cmd run build`: passed for both server and client.
- `npm.cmd run lint`: passed frontend ESLint and backend TypeScript checks.
- `npm.cmd run dev`: successfully launched both applications with automatic reload.
- HTTP smoke checks passed for the direct health endpoint, health requests through
  Vite's proxy, unknown-endpoint JSON 404 responses, and frontend HTML delivery.
- The smoke-check script initially had a PowerShell stdin encoding mismatch in its
  accented page-title assertion; using a Unicode escape fixed the check.
- Port 5173 was already occupied, so the verification used Vite on port 5174.
- The rendered page has not been checked in a browser during this step.

### Pokémon endpoint verification

- `npm.cmd test`: all 15 backend tests passed. Coverage includes HTTP pagination,
  normalized names and numeric IDs, invalid input, missing Pokémon, upstream
  HTTP/network/timeout errors, malformed JSON and response shapes, sprite fallbacks,
  caching, expiry, eviction, concurrent request sharing, and detail request batching.
- `npm.cmd run build`: both applications built successfully.
- `npm.cmd run lint`: frontend linting and backend/test type-checking passed.

- A live HTTP check against the compiled backend and real PokéAPI passed: a page
  returned Bulbasaur and Ivysaur, lookup returned Pikachu with the expected ID and
  converted height, and an unknown name returned 404. The first two-item page made
  three upstream requests; repeating it made zero additional upstream requests.
- No new package dependencies were added for this milestone.
- Codex reviewed that only validated successful responses enter the cache, error
  responses expose no upstream body, and pagination links remain on our own API.
- The frontend remains at the connection-check milestone. User review of the new
  endpoints and implementation is pending; automated checks do not replace it.

### Comment update verification

- Compared all 14 TypeScript files with a snapshot taken before the edit: every
  non-comment line was unchanged, including the user's existing formatting edits.
- `npm.cmd test`: all 15 tests passed after the comments were added.
- `npm.cmd run lint`: frontend linting and backend/test type-checking passed.

### React card milestone verification

- `npm.cmd run build`: both applications built successfully.
- `npm.cmd run lint`: frontend linting and backend/test type-checking passed.
- A temporary jsdom check in ignored scratch space exercised the actual React
  components, effects, and click handlers. It loaded real API responses through
  Vite's proxy and verified 20 cards, first/next/previous pages, and disabled
  navigation while loading.
- Controlled responses verified error/retry recovery, an empty collection, missing
  image URLs, broken-image events, and cancellation on cleanup. JSON requests
  stayed on our backend's `/api/pokemon` endpoint.
- Computer-use browser verification was attempted, but no browser surface was
  available. The in-memory DOM checks do not verify visual layout or real image
  downloads; those still need review in a browser.
- jsdom was installed only in ignored temporary check space. No application
  dependencies, package scripts, backend behavior, or lockfiles were changed.
- Search and favorites remain later milestones so the implementation stays
  incremental and reviewable for the user.

### Name search milestone verification

- `npm.cmd run build` and `npm.cmd run lint` passed.
- Extended the temporary DOM check to exercise the actual form, input events,
  React effects, and lookup requests through Vite to the live backend. Verified
  trimmed/case-normalized names, repeated submissions, hyphenated names, numeric
  IDs, missing names, invalid input, and search failure/retry recovery.
- Checked that typing alone does not fetch, whitespace-only input is disabled,
  pagination disappears during lookup, and clearing restores the previous offset.
- Deliberately delayed responses were ignored after a newer search or clearing.
  Existing card, pagination, empty-state, image-fallback, and cleanup checks passed.
- An initial check failed because PowerShell changed accented assertion text
  passed to Node through stdin. Unicode escapes fixed the temporary harness;
  no application change was needed for that failure.
- No new application dependencies or backend changes were required. Visual layout
  was not checked in a browser; DOM checks do not measure responsive layout.
- The user later flagged the deprecated `FormEvent` annotation. Codex checked the
  installed React declarations, replaced it with React's `SubmitEvent<HTMLFormElement>`,
  and verified the frontend build. This corrected the type used in the initial handler.

### Local SQLite favorites verification

- `npm.cmd test`: all 21 backend tests passed, including six new favorites tests.
  Verified persistence across closing/reopening a real SQLite file, empty lists,
  browser isolation, duplicate/concurrent additions, invalid headers and IDs,
  unknown Pokemon, upstream failure, and UUID case normalization.
- `npm.cmd run build` and `npm.cmd run lint` passed.
- A temporary DOM check used the actual React components and Vite proxy, real
  Pokemon data, and an isolated SQLite file. Checked pending/confirmed button
  states, save failure/retry, persistence after React remount, list/search
  consistency, pagination/404 regressions, loading failure/retry, UUID persistence,
  browser isolation, and request cleanup. Its scratch database was removed afterward.
- Initialized the normal server/data/pokedex.sqlite file without adding test rows,
  and verified that Git ignores it. Application dependency and lockfiles did not change.
- Server initialization now owns the store and closes it on shutdown; importing
  app.ts no longer opens a database. Existing Pokemon HTTP tests use memory stores.
- The UI is marked as favorite only after the API confirms the save. Favorites
  are add-only, consistent with the requested scope.
- Visual layout remains unverified in a browser; the DOM check verifies behavior.

### Portability verification

- `npm.cmd run verify` passed locally: frontend lint, backend/test type-checks,
  all 21 tests, both builds, and the new compiled-server smoke check.
- Copied source and lockfiles into a separate OS temporary folder with spaces in
  its name, without node_modules, build output, .env, or database files. Ran
  `npm.cmd run setup` successfully and then `npm.cmd run verify`; all checks passed.
- The smoke check created a nested database path with spaces, started from an
  unrelated working directory, served React and its JS bundle, retained API JSON
  404 behavior, and recovered saved IDs after restarting the server. Its temporary
  SQLite artifacts were removed without touching the user's database.
- In the fresh copy, tested root `npm start`, source `npm run dev`, custom backend
  and Vite ports from root .env, Vite proxy requests, automatic database creation,
  source/compiled path equality, and shared saved records across both startup modes.
- The first clean-copy harness location was inside node_modules, where Node
  refuses native TypeScript stripping. Reran the check in the OS temporary folder
  rather than weakening runtime restrictions. A dev proxy check was corrected to
  use Vite's printed localhost URL, which may resolve to IPv6.
- Local environment: Windows, Node 24.21.0, npm 11.19.0. The Windows/macOS/Linux
  GitHub Actions workflow was added but was not executed or published in this
  session. Cross-OS runtime results are therefore pending.
- No application dependency versions were changed; lockfile root metadata now
  records the runtime engine requirements. Personal SQLite records were preserved.

### Favorite removal verification

- `npm.cmd run verify` passed: linting, type-checks, all 23 backend tests, builds,
  and the portability smoke check.
- Two new backend tests verify browser-scoped and repeatable deletion without
  upstream calls, and removal persisting after reopening SQLite. Existing invalid
  identity and invalid ID tests now also cover DELETE.
- A temporary DOM check exercised the real controls through the API and an isolated
  SQLite file: pending removal, blocked double-clicks, removal failure/retry,
  persistence after remount, list/search consistency, re-adding, and navigation
  while deletion completes. Existing favorites and search checks also passed.
- Favorite IDs are filtered from shared React state only after API success; the
  confirmed star state stays unchanged on failure. No real user favorites were
  removed during testing, and the scratch database was cleaned up.
- No dependencies or schema migration were needed. The browser layout was not
  visually checked; DOM checks cover interaction behavior.

### Favorites grid verification

- `npm.cmd run verify` passed: linting, type-checks, all 23 backend tests, both
  builds, and the compiled-server portability smoke check.
- The temporary DOM check used the real React components, Vite proxy, and SQLite,
  with controlled Pokemon fixtures and an isolated memory store. Verified seven
  saved Pokemon spanning multiple collection pages, batches of five, selected
  button state, no favorites pagination, repeated loading, empty/loading/error
  states, retry, return to the prior page, search navigation, immediate removal,
  removal of the last item, and persisted empty state after React remount.
- Verified stale favorite-detail responses cannot replace the collection after
  navigation. Also held an add request until after opening Favorites and confirmed
  the newly saved Pokemon appeared automatically when it completed.
- An initial request-ID snapshot was revised to follow shared favorite IDs,
  covering saves that finish after navigation. A test fixture assertion was
  corrected to match the card's existing hyphen-to-space display formatting.
- Existing local favorite records were not modified by verification. No new
  application dependencies, database schema, or backend endpoints were needed.
- Layout was not visually verified in a browser; interaction checks used jsdom.

### Additional comment review verification

- Added concise explanations for React state/effect cleanup, controlled inputs,
  favorite synchronization, functional state updates, TypeScript assertions and
  nullable values, request validation, SQLite statements, cache behavior, and tests.
- Compared all 21 files to a snapshot from before editing. Non-comment lines were
  unchanged, and TypeScript transpilation produced identical JavaScript tokens.
  The comparison normalized the existing UTF-8 byte-order marks when reading files.
- `npm.cmd run verify` passed: linting, type-checking, all 23 backend tests, builds,
  and the portability smoke check. No application logic or dependencies changed.
