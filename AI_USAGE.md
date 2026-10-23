# AI usage

## Tools and agents

- OpenAI Codex, GPT-6-based assistant. The exact deployed model build is not
  exposed in this session. Used for project planning, backend scaffolding,
  connecting React to Express, documentation, and verification.
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

## Technical decisions and ownership

| Decision | Reason and trade-off | Origin |
| --- | --- | --- |
| React and TypeScript | Match the user's requested frontend and existing setup | User |
| Vite | Simple React development and production builds | Suggested by Codex; user ran the scaffold commands |
| Node.js, Express, and TypeScript | Keep both sides in one language with a small REST layer | Suggested by Codex; user accepted the proposed structure |
| Separate client and server packages in one repository | Clear boundaries; separate dependency installs managed through root scripts | Suggested by Codex |
| Vite development proxy | Relative `/api` requests without extra CORS middleware locally; production routing remains to be configured | Suggested by Codex |
| React component state and effects | Enough for the current health request without another state library | Suggested by Codex |
| Native Node 24 TypeScript execution | Runs the development backend without an additional TypeScript runner; the compiler emits JavaScript for the build | Suggested by Codex |
| SQLite and a browser UUID for favorites | Planned persistence without account setup; UUID identification is not secure authentication | Suggested by Codex, based on the assignment recommendations; not implemented yet |
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
