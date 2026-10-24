import { useEffect, useState } from "react";
import { PokemonCard } from "./components/PokemonCard";
import { getPokemonPage } from "./services/api";
import type { PokemonPage } from "./types/pokemon";
import "./App.css";

// Match the backend's default page size and keep navigation calculations consistent.
const PAGE_SIZE = 20;

function App() {
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<PokemonPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch on the first render, after navigation, or when the user retries.
  useEffect(() => {
    const controller = new AbortController();

    async function loadPokemon() {
      try {
        const result = await getPokemonPage(PAGE_SIZE, offset, controller.signal);
        if (!controller.signal.aborted) {
          setPage(result);
        }
      } catch {
        // Cleanup cancellations should neither show an error nor replace newer data.
        if (!controller.signal.aborted) {
          setError("We couldn't load the Pokémon. Please try again.");
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
  }, [offset, retryCount]);

  function changePage(nextOffset: number) {
    setIsLoading(true);
    setError(null);
    setOffset(nextOffset);
  }

  function retry() {
    setIsLoading(true);
    setError(null);
    // Changing this counter reruns the effect even though the offset stays the same.
    setRetryCount((current) => current + 1);
  }

  const hasResults = page !== null && page.results.length > 0;
  // Compute the message here so the JSX remains easy to read.
  let pageLabel = "No results";
  if (isLoading) {
    pageLabel = "Loading…";
  } else if (error) {
    pageLabel = "Page unavailable";
  } else if (hasResults && page) {
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
        <p className="intro">Explore the collection, meet each Pokémon, and discover its types.</p>
      </header>

      <section className="collection" aria-labelledby="collection-title" aria-busy={isLoading}>
        <div className="collection-header">
          <h2 id="collection-title">Pokémon collection</h2>
          <span className="collection-count">
            {page ? `${page.count.toLocaleString()} Pokémon` : "Let’s explore"}
          </span>
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
            <button type="button" onClick={retry}>Try again</button>
          </div>
        )}

        {!isLoading && !error && !hasResults && (
          <p className="collection-message" role="status">No Pokémon on this page.</p>
        )}

        {!isLoading && !error && page && hasResults && (
          <div className="pokemon-grid">
            {/* A stable key helps React identify each card when the list changes. */}
            {page.results.map((pokemon) => (
              <PokemonCard pokemon={pokemon} key={pokemon.id} />
            ))}
          </div>
        )}

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
            disabled={isLoading || error !== null || !page || page.next === null}
            onClick={() => changePage(offset + PAGE_SIZE)}
          >
            Next
          </button>
        </nav>
      </section>
      <footer className="pokedex-footer">Pokémon data from PokéAPI.</footer>
    </main>
  );
}

export default App;
