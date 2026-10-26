import { useEffect, useState } from "react";
import { PokemonCard } from "./components/PokemonCard";
import { useFavorites } from "./hooks/useFavorites";
import type { SubmitEvent } from "react";
import { ApiError, getFavoritePokemon, getPokemonByName, getPokemonPage } from "./services/api";
import type { Pokemon, PokemonPage } from "./types/pokemon";
import "./App.css";

// Match the backend's default page size and keep navigation calculations consistent.
const PAGE_SIZE = 20;

// Only one grid mode is active at a time.
type View = "collection" | "search" | "favorites";

// Use the active view to select its heading without nested conditions in the JSX.
const viewTitles = {
  collection: "Pokémon collection",
  search: "Search results",
  favorites: "Your favorites",
};

function App() {
  // Load favorites independently so a storage failure does not prevent browsing.
  const { favoriteIds, favoritesError, retryFavorites, updateFavorite } = useFavorites();
  // Offset counts skipped entries; keep the last collection page when switching views.
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<PokemonPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [view, setView] = useState<View>("collection");
  // Cards need full records; the hook's favoriteIds only track which IDs are saved.
  const [favoritePokemon, setFavoritePokemon] = useState<Pokemon[]>([]);
  // Typing changes the input; only submitting changes the name used for fetching.
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState<Pokemon | null>(null);
  const isSearching = view === "search";
  // Watch ID changes only in Favorites; star clicks elsewhere should not reload the grid.
  const favoriteIdsForView = view === "favorites" ? favoriteIds : null;

  // One effect loads the selected view and cancels requests when that view changes.
  useEffect(() => {
    // Each effect run needs a new controller because an aborted signal cannot be reused.
    const controller = new AbortController();

    async function loadPokemon() {
      try {
        if (view === "favorites") {
          const results = await getFavoritePokemon(favoriteIdsForView ?? [], controller.signal);
          if (!controller.signal.aborted) {
            setFavoritePokemon(results);
          }
        } else if (view === "search") {
          const result = await getPokemonByName(searchTerm, controller.signal);
          if (!controller.signal.aborted) {
            setSearchResult(result);
          }
        } else {
          const result = await getPokemonPage(
            PAGE_SIZE,
            offset,
            controller.signal,
          );
          if (!controller.signal.aborted) {
            setPage(result);
          }
        }
      } catch (failure) {
        // Cleanup cancellations should neither show an error nor replace newer data.
        if (!controller.signal.aborted) {
          if (view === "favorites") {
            setError("We couldn't load your favorite Pokémon. Please try again.");
          } else if (
            view === "search" &&
            failure instanceof ApiError &&
            failure.status === 404
          ) {
            // A valid lookup with no match gets a 404 view rather than an outage alert.
            setSearchResult(null);
          } else if (failure instanceof ApiError) {
            setError(failure.message);
          } else {
            setError("We couldn't load the Pokémon. Please try again.");
          }
        }
      } finally {
        // An old request must not clear the loading state of a newer request.
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    // Start async work without returning a Promise as the effect's cleanup value.
    void loadPokemon();
    // Cancel outdated requests when the page changes or the component unmounts.
    return () => controller.abort();
  }, [offset, reloadCount, searchTerm, view, favoriteIdsForView]);

  // React's SubmitEvent describes a form submission; FormEvent is deprecated.
  function handleSearch(event: SubmitEvent<HTMLFormElement>) {
    // Submit without a browser refresh; normalize before building the lookup URL.
    event.preventDefault();
    const name = searchInput.trim().toLowerCase();
    if (!name) return;

    setIsLoading(true);
    setError(null);
    // Clear the old match so a new 404 cannot leave its card visible.
    setSearchResult(null);
    setSearchTerm(name);
    setView("search");
    // Also fetch when the user submits the same name again.
    setReloadCount((current) => current + 1);
  }

  function showCollection() {
    setSearchInput("");
    setSearchTerm("");
    setSearchResult(null);
    setError(null);
    setIsLoading(true);
    setView("collection");
    // Preserve offset so browsing resumes on the previous collection page.
  }

  function showFavorites() {
    // Clear search text so the heading and future requests match the selected view.
    setSearchInput("");
    setSearchTerm("");
    setError(null);
    setIsLoading(true);
    setView("favorites");
    // Clicking again also reloads details when the view is already selected.
    setReloadCount((current) => current + 1);
  }

  function changePage(nextOffset: number) {
    setIsLoading(true);
    setError(null);
    setOffset(nextOffset);
  }

  function retry() {
    setIsLoading(true);
    setError(null);
    // Reload the current page or lookup without changing its parameters.
    setReloadCount((current) => current + 1);
  }

  // Reuse the card grid for collection pages, search results, and saved favorites.
  // ?. handles a page that is still null; ?? supplies an empty array in that case.
  let displayedPokemon = page?.results ?? [];
  if (view === "favorites") {
    // Hide a successfully removed favorite immediately, before details reload.
    displayedPokemon = favoritePokemon.filter((pokemon) => favoriteIds?.includes(pokemon.id));
  } else if (isSearching) {
    displayedPokemon = searchResult ? [searchResult] : [];
  }
  const hasResults = displayedPokemon.length > 0;
  // Compute the message here so the JSX remains easy to read.
  let pageLabel = "No results";
  if (isLoading) {
    pageLabel = "Loading…";
  } else if (error) {
    pageLabel = "Page unavailable";
  } else if (view === "collection" && hasResults && page) {
    pageLabel = `${page.offset + 1}-${page.offset + page.results.length} of ${page.count.toLocaleString()}`;
  }

  return (
    <main className="pokedex">
      <header className="pokedex-header">
        <div className="brand">
          <div className="pokeball" aria-hidden="true" />
          <span>Beto's Pokédex</span>
        </div>
        <p className="eyebrow">A world of discovery</p>
        <h1>Every Pokémon has a story.</h1>
        <p className="intro">
          Explore the collection, meet each Pokémon, and discover its types.
        </p>
        {/* A form supports both the Search button and Enter in the input. */}
        <form className="search-form" role="search" onSubmit={handleSearch}>
          <label htmlFor="pokemon-search">Find a Pokémon by name</label>
          <div className="search-controls">
            {/* React state owns this input's value; editing it does not submit a search. */}
            <input
              id="pokemon-search"
              name="pokemon"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="e.g. pikachu or 25"
              aria-describedby="search-help"
              autoComplete="off"
              maxLength={100}
            />
            <button type="submit" disabled={!searchInput.trim()}>
              Search
            </button>
            {view !== "collection" && (
              <button type="button" onClick={showCollection}>
                Show all Pokémon
              </button>
            )}
          </div>
          <p id="search-help">Use the full name, such as pikachu or mr-mime, or use an ID</p>
        </form>
        <div className="view-controls">
          <button
            type="button"
            onClick={showFavorites}
            aria-pressed={view === "favorites"}
            disabled={favoriteIds === null}
          >
            Show all Favorites
          </button>
        </div>
      </header>

      {/* Favorite-loading errors stay separate from the grid's data-loading errors. */}
      {favoritesError ? (
        <div className="favorites-notice" role="alert">
          <p>{favoritesError}</p>
          <button type="button" onClick={retryFavorites}>Retry favorites</button>
        </div>
      ) : favoriteIds === null && (
        <p className="favorites-notice" role="status">Loading favorites…</p>
      )}

      <section
        className="collection"
        aria-labelledby="collection-title"
        aria-busy={isLoading}
      >
        <div className="collection-header">
          <h2 id="collection-title">
            {viewTitles[view]}
          </h2>
          {!isLoading && !error && (
            <span className="collection-count">
              {view === "collection"
                ? `${page?.count.toLocaleString() ?? 0} Pokémon`
                : `${displayedPokemon.length} found`}
            </span>
          )}
        </div>

        {/* Render request feedback first so old cards do not appear as a new result. */}
        {isLoading && (
          <div className="collection-message" role="status">
            <span className="loading-dot" aria-hidden="true" />
            Loading Pokémon…
          </div>
        )}

        {!isLoading && error && (
          <div className="collection-message error-message">
            <p role="alert">{error}</p>
            <button type="button" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && isSearching && !hasResults && (
          <div className="collection-message" role="status">
            <span className="not-found-code">404</span>
            <h3>Pokémon not found</h3>
            <p>No Pokémon named “{searchTerm}” was found.</p>
          </div>
        )}

        {!isLoading && !error && view === "favorites" && !hasResults && (
          <div className="collection-message" role="status">
            <h3>No favorites yet</h3>
            <p>Add a Pokémon to favorites to see it here.</p>
          </div>
        )}

        {!isLoading && !error && view === "collection" && !hasResults && (
          <p className="collection-message" role="status">
            No Pokémon on this page.
          </p>
        )}

        {!isLoading && !error && hasResults && (
          <div className="pokemon-grid">
            {/* A stable key helps React identify each card when the list changes. */}
            {displayedPokemon.map((pokemon) => (
              <PokemonCard
                pokemon={pokemon}
                key={pokemon.id}
                isFavorite={favoriteIds?.includes(pokemon.id) ?? false}
                favoritesReady={favoriteIds !== null}
                onFavoriteChange={updateFavorite}
              />
            ))}
          </div>
        )}

        {/* Favorites show the full saved set; only the collection uses pagination. */}
        {view === "collection" && (
          <nav className="pagination" aria-label="Pokémon pages">
            <button
              type="button"
              disabled={isLoading || offset === 0}
              onClick={() => changePage(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </button>
            {/* Announce page changes to screen readers without interrupting current speech. */}
            <p aria-live="polite">{pageLabel}</p>
            <button
              type="button"
              disabled={
                isLoading || error !== null || !page || page.next === null
              }
              onClick={() => changePage(offset + PAGE_SIZE)}
            >
              Next
            </button>
          </nav>
        )}
      </section>
      <footer className="pokedex-footer">Pokémon data from PokéAPI.</footer>
    </main>
  );
}

export default App;
