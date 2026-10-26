# Additional project notes

## Time spent and work breakdown

**Approximately 8 hours total**, based on the project author's estimate.
No per-phase hour breakdown was provided, so the table describes how the work
was divided without assigning unmeasured hours or percentages.

| Phase | Work completed |
| --- | --- |
| Planning and setup | Clarified the requirements, selected React/TypeScript and Express, and established the client/server structure. |
| Backend and PokéAPI wrapper | Added listing and lookup endpoints, input validation, response mapping, timeouts, caching, and controlled errors. |
| React interface | Built reusable cards, pagination, submitted name/ID search, loading/error/404 states, and the favorites grid. |
| Local favorites | Added SQLite, browser UUID identification, favorites endpoints, and confirmed add/remove controls. |
| Verification and portability | Added backend tests, React interaction checks, clean-install checks, portable configuration, startup/restart checks, and a three-OS CI workflow. |
| Learning and documentation | Explained the implementation, reviewed comments, and maintained README, AI usage, and submission notes. |

Existing commit dates span October 22–25, 2026. That calendar window is not a
measurement of active development time; the approximately 8-hour estimate above
is the supplied effort estimate.

## Scalability notes

### Pagination and request volume

- The collection API uses `limit` and `offset`. The default is 20 Pokémon per
  page, and the backend accepts at most 50. React requests 20 at a time.
- PokéAPI's list response provides names rather than complete card details.
  A cold 20-item page can therefore require 21 upstream requests: one list request
  and 20 detail requests. The backend retrieves those details in batches of five.
- The favorites view loads every saved ID through our lookup endpoint, also in
  batches of five. It is not paginated, so its requests and rendered cards grow
  with the number of favorites. A larger application should paginate that view
  or render only the portion currently visible.
- Search is an exact name/ID lookup submitted by the user. Typing does not issue
  a request for every keystroke.

Implementation: [collection routes](server/src/routes/pokemon.ts),
[Pokémon service](server/src/services/pokemon.ts), and
[frontend requests](client/src/services/api.ts).

### Caching

- Successful, validated responses are cached in memory for one hour after loading.
- Each server process stores up to 500 Pokémon detail entries and 100 list entries.
  These are entry-count limits, not measured byte budgets.
- Requests for the same pending key share a Promise, reducing duplicate upstream
  work. Expired entries are removed during loads, and the oldest stored entry is
  evicted when a cache is full. Reading an entry does not extend its lifetime.
- Failures are not cached. Name and numeric-ID lookups use separate keys, which
  can fetch the same Pokémon twice. Canonical keys and short-lived caching of
  missing results could reduce repeated requests in a larger deployment.
- Restarting the server clears the cache. Multiple server instances would have
  independent caches; a shared cache would be needed for coordinated reuse.

Implementation: [cache loader](server/src/services/cache.ts).
Caching and reducing unnecessary requests support
[PokéAPI's fair-use guidance](https://pokeapi.co/docs/v2/#fairuse).

### Rate limiting and upstream failures

**The wrapper does not currently implement a global rate limiter.** Batching five
requests limits concurrency within one list operation, not requests per second
or total concurrency across all clients. Identical pending keys are shared, but
many different simultaneous requests can still create substantial upstream load.

Each upstream request has a 10-second timeout. Upstream HTTP/network failures
become controlled 502 responses, and timeouts become 504 responses. Automatic
retries, backoff, and forwarding an upstream `Retry-After` header are not implemented.

Before a larger public deployment, priorities would be a shared outbound request
queue, an inbound per-client rate limit, and bounded retries that respect upstream
retry guidance. Limits should be selected from measured traffic and latency;
no load test or requests-per-second capacity measurement has been recorded.

### Local storage trade-off

SQLite and synchronous prepared statements suit the current local application.
The combined browser UUID/Pokémon ID key prevents duplicate favorites. For many
concurrent writers or multiple server machines, database contention and synchronous
work would need evaluation, along with shared persistent storage. The browser UUID
identifies records; it is not account authentication.

## Accessibility and responsive design

### Implemented considerations

| Area | Current implementation |
| --- | --- |
| Structure | Semantic main content, sections, headings, articles, and labeled pagination. Each card is associated with its heading. |
| Search | A visible input label, associated helper text, and a native form supporting submission with Enter. |
| Controls | Native buttons, visible keyboard-focus outlines, and disabled states while requests are pending or prerequisites are loading. |
| Favorite state | Visible text and star icons accompany `aria-pressed`; accessible labels describe adding or removing the named Pokémon. |
| Feedback | Loading and empty states use `role="status"`; errors use `role="alert"`; page ranges use a polite live region. Busy regions and buttons use `aria-busy`. |
| Images and decoration | Pokémon images have name-based alternative text and a textual fallback. Decorative stars, spinner, and brand mark are hidden from assistive technology. |
| Motion and color | Reduced-motion preferences disable the spinner animation. Type names and favorite text convey meaning alongside colors and icons. |

The layout uses an automatically sized CSS Grid, a capped content width, wrapping
controls, and fluid heading sizes. Card columns can shrink to the available width;
long names can wrap. Images use explicit dimensions, lazy loading, and `object-fit`
to preserve their appearance and reserve space. A small-screen rule adjusts spacing
at 480px, and the page has a minimum layout width of 320px.

Implementation: [main view](client/src/App.tsx),
[card component](client/src/components/PokemonCard.tsx),
[layout styles](client/src/App.css), and [base styles](client/src/index.css).

### Verification and remaining checks

Recorded verification includes successful lint/type checks, 23 backend tests,
builds, portability checks, and jsdom checks of React state and interactions.
These checks do not establish visual quality or WCAG conformance.

Real-browser review is still needed for mobile/desktop widths, zoom and reflow,
keyboard navigation, screen-reader announcements, color contrast, and touch targets.
Focus after view changes or removal of the focused favorite card also needs review;
custom focus restoration has not been implemented.

[W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and
[status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
provide references for that review. The features above describe current design
considerations, rather than a completed accessibility audit.
