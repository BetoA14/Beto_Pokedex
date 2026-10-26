# Additional project notes

## What I would do next

- **Improve search and navigation:** Allow users to search for multiple Pokémon
  names or IDs in a single query, and jump directly to a collection page by
  entering its page number.
- **Add a dark theme:** Offer a darker color scheme for the interface.
- **Add a retro Pokémon theme:** Introduce a visual style inspired by the classic
  Pokémon games.

## Screenshots and demo video

These captures show the running application using real Pokémon data.

| Screenshot | What it shows |
| --- | --- |
| [Main collection](screenshots/pokedex.png) | Pokémon cards with images, names, types, measurements, and favorite controls. |
| [Search result](screenshots/pokedex-search.png) | Searching for `pikachu` and displaying its matching card. |
| [Favorites](screenshots/pokedex-favorites.png) | Four saved favorites: Bulbasaur, Charmander, Squirtle, and Pikachu. |
| [Page index](screenshots/pokedex-page-index.png) | The collection's `21–40 of 1,351` range and Previous/Next controls. |

The [13.6-second demo video](videos/pokedex-demo.mp4) shows browsing the collection,
searching for Pikachu, adding it to favorites, opening the favorites view, and
returning to browse more cards. It is an MP4 and stays below the 15-second limit.

Favorites shown in the captures used a separate demo browser identity; temporary
records were cleaned up afterward, preserving the project author's saved favorites.

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

All PokéAPI network requests now pass through one shared queue per Node.js process,
across collection requests, lookups, and browsers. Starts are spaced at least
**50 ms apart (20 requests per second)**, with at most **5 requests in flight**,
including reading their bodies. Cache hits do not use slots. This is separate
from the existing per-page batches of five.

Twenty requests per second is an application choice supporting
[PokéAPI's fair-use guidance](https://pokeapi.co/docs/v2/#fairuse), not an official
quota. A cold 20-card page needs 21 upstream requests, whose starts span at least
one second plus response time. No production load test has been performed;
the limit should be reviewed against measured traffic and latency.

The queue holds at most **50 waiting requests**, each for up to **15 seconds**.
Full queues and expired waits produce 503 responses with a `Retry-After` hint and
`Cache-Control: no-store`. The separate 10-second network timeout starts only when
the request leaves the queue. HTTP/network failures otherwise become 502 responses,
and timeouts become 504 responses. Health checks and local favorites reads/removals
remain independent of the queue.

An upstream 429 pauses new requests globally within the process. A valid
`Retry-After`, expressed in seconds or as an HTTP date, determines the pause;
missing or invalid values fall back to one second. Upstream 503 responses with a
valid header also trigger a pause. The API returns 503 with a retry hint, without
automatically retrying the failed request. This follows the purpose of
[429](https://www.rfc-editor.org/rfc/rfc6585.html#section-4) and
[`Retry-After`](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after).

Implementation: [outbound limiter](server/src/services/rate-limiter.ts).
For multiple server workers or machines, share limiter state so they use one
combined budget. A larger public deployment should also consider inbound
per-client limits; these are not currently implemented.

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

Recorded verification includes successful lint/type checks, 38 backend tests,
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
