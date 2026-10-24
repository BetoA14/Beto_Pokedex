import { useEffect, useState } from "react";
import { PokemonCard } from "./components/PokemonCard";
import type { FormEvent } from "react";
import { ApiError, getPokemonByName, getPokemonPage } from "./services/api";
import type { Pokemon, PokemonPage } from "./types/pokemon";
import "./App.css";

// Match the backend's default page size and keep navigation calculations consistent.
const PAGE_SIZE = 20;

function App() {
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<PokemonPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  // Typing changes the input; only submitting changes the name used for fetching.
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState<Pokemon | null>(null);
  const isSearching = searchTerm !== "";

  // One effect handles browsing and lookup, cancelling the old request on changes.
  useEffect(() => {
    const controller = new AbortController();

    async function loadPokemon() {
      try {
        if (searchTerm) {
          const result = await getPokemonByName(searchTerm, controller.signal);
          if (!controller.signal.aborted) {
            setSearchResult(result);
          }
        } else {
          const result = await getPokemonPage(PAGE_SIZE, offset, controller.signal);
          if (!controller.signal.aborted) {
            setPage(result);
          }
        }
      } catch (failure) {
        // Cleanup cancellations should neither show an error nor replace newer data.
        if (!controller.signal.aborted) {
          if (searchTerm && failure instanceof ApiError && failure.status === 404) {
            // A valid lookup with no match gets a 404 view rather than an outage alert.
            setSearchResult(null);
          } else if (failure instanceof ApiError) {
            setError(failure.message);
          } else {
            setError("We couldn't load the Pokémon. Please try again.");
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadPokemon();
    // Cancel outdated requests when the page changes or the component unmounts.
    return () => controller.abort();
  }, [offset, reloadCount, searchTerm]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    // Submit without a browser refresh; normalize before building the lookup URL.
    event.preventDefault();
    const name = searchInput.trim().toLowerCase();
    if (!name) return;

    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setSearchTerm(name);
    // Also fetch when the user submits the same name again.
    setReloadCount((current) => current + 1);
  }

  function clearSearch() {
    setSearchInput("");
    setSearchTerm("");
    setSearchResult(null);
    setError(null);
    setIsLoading(true);
    // Preserve offset so browsing resumes on the previous collection page.
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

  // Reuse the card grid for either a page or one search result.
  let displayedPokemon = page?.results ?? [];
  if (isSearching) {
    displayedPokemon = searchResult ? [searchResult] : [];
  }
  const hasResults = displayedPokemon.length > 0;
  // Compute the message here so the JSX remains easy to read.
  let pageLabel = "No results";
  if (isLoading) {
    pageLabel = "Loading…";
  } else if (error) {
    pageLabel = "Page unavailable";
  } else if (!isSearching && hasResults && page) {
    pageLabel = `${page.offset + 1}–${page.offset + page.results.length} of ${page.count.toLocaleString()}`;
  }

  return (
    <main className="pokedex">
      <header className="pokedex-header">
        <div className="brand">
          <div className="pokeball" aria-hidden="true" />
          <span>Beto’s Pokédex</span>
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
            <input
              id="pokemon-search"
              name="pokemon"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="e.g. pikachu"
              aria-describedby="search-help"
              autoComplete="off"
              maxLength={100}
            />
            <button type="submit" disabled={!searchInput.trim()}>Search</button>
            {isSearching && (
              <button type="button" onClick={clearSearch}>Show all Pokémon</button>
            )}
          </div>
          <p id="search-help">Use the full name, such as pikachu or mr-mime.</p>
        </form>
      </header>

      <section
        className="collection"
        aria-labelledby="collection-title"
        aria-busy={isLoading}
      >
        <div className="collection-header">
          <h2 id="collection-title">{isSearching ? "Search results" : "Pokémon collection"}</h2>
          {!isLoading && !error && (
            <span className="collection-count">
              {isSearching ? `${displayedPokemon.length} found` : `${page?.count.toLocaleString() ?? 0} Pokémon`}
            </span>
          )}
        </div>

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

        {!isLoading && !error && !isSearching && !hasResults && (
          <p className="collection-message" role="status">
            No Pokémon on this page.
          </p>
        )}

        {!isLoading && !error && hasResults && (
          <div className="pokemon-grid">
            {/* A stable key helps React identify each card when the list changes. */}
            {displayedPokemon.map((pokemon) => (
              <PokemonCard pokemon={pokemon} key={pokemon.id} />
            ))}
          </div>
        )}

        {/* Lookup returns one Pokemon; page navigation only applies to browsing. */}
        {!isSearching && (
          <nav className="pagination" aria-label="Pokémon pages">
            <button
              type="button"
              disabled={isLoading || offset === 0}
              onClick={() => changePage(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </button>
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
