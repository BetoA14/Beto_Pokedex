import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.ts";
import { createFavoritesStore } from "../src/db/favorites.ts";
import { HttpError } from "../src/errors.ts";
import type { PokemonService } from "../src/services/pokemon.ts";

// Two valid UUIDs represent separate browser identities throughout these tests.
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

// Use real SQLite and HTTP, with a fake Pokemon service to keep tests offline.
async function withApi(check: (base: string, lookups: string[]) => Promise<void>) {
  const store = createFavoritesStore(":memory:");
  const lookups: string[] = [];
  const service: PokemonService = {
    async getPokemon(id) {
      lookups.push(id);
      // Reserved fixture IDs simulate missing data and upstream failure without network calls.
      if (id === "999999") throw new HttpError(404, "Pokemon not found");
      if (id === "888888") throw new HttpError(502, "PokeAPI is temporarily unavailable");
      return {
        id: Number(id), name: "pikachu", image: null, types: ["electric"],
        heightMeters: 0.4, weightKilograms: 6, abilities: [], stats: [],
      };
    },
    async listPokemon() { throw new Error("Listing should not be needed for favorites"); },
  };
  // Port 0 asks the OS to choose a free port, avoiding conflicts with a running app.
  const server = createApp(service, store).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await check(`http://127.0.0.1:${address.port}/api/favorites`, lookups);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
  }
}

test("favorites start empty, add once, and remain isolated by browser UUID", async () => {
  await withApi(async (base, lookups) => {
    const headers = { "X-User-Id": USER_A };
    assert.deepEqual(await (await fetch(base, { headers })).json(), { pokemonIds: [] });
    const added = await fetch(`${base}/25`, { method: "PUT", headers });
    assert.equal(added.status, 201);
    assert.deepEqual(await added.json(), { pokemonId: 25, isFavorite: true });
    // Repeating PUT neither duplicates the record nor needs another upstream lookup.
    assert.equal((await fetch(`${base}/25`, { method: "PUT", headers })).status, 200);
    assert.deepEqual(lookups, ["25"]);
    assert.deepEqual(await (await fetch(base, { headers })).json(), { pokemonIds: [25] });
    assert.deepEqual(await (await fetch(base, { headers: { "X-User-Id": USER_B } })).json(), { pokemonIds: [] });
  });
});

test("missing or malformed browser identities are rejected before database access", async () => {
  await withApi(async (base, lookups) => {
    for (const userId of [undefined, "", "not-a-uuid", "'; DROP TABLE favorites; --"]) {
      const headers: Record<string, string> = userId === undefined ? {} : { "X-User-Id": userId };
      for (const [url, method] of [[base, "GET"], [`${base}/25`, "PUT"], [`${base}/25`, "DELETE"]]) {
        const response = await fetch(url, { method, headers });
        assert.equal(response.status, 400);
        assert.equal(typeof (await response.json()).message, "string");
      }
    }
    assert.deepEqual(lookups, []);
    assert.equal((await fetch(base, { headers: { "X-User-Id": USER_A } })).status, 200);
  });
});

test("invalid and nonexistent Pokemon IDs are not saved", async () => {
  await withApi(async (base, lookups) => {
    const headers = { "X-User-Id": USER_A };
    for (const id of ["0", "-1", "1.5", "pikachu", "9007199254740992"]) {
      assert.equal((await fetch(`${base}/${id}`, { method: "PUT", headers })).status, 400);
      assert.equal((await fetch(`${base}/${id}`, { method: "DELETE", headers })).status, 400);
    }
    assert.deepEqual(lookups, []);
    assert.equal((await fetch(`${base}/999999`, { method: "PUT", headers })).status, 404);
    assert.equal((await fetch(`${base}/888888`, { method: "PUT", headers })).status, 502);
    assert.deepEqual(await (await fetch(base, { headers })).json(), { pokemonIds: [] });
  });
});

test("concurrent additions are idempotent and IDs are returned in order", async () => {
  await withApi(async (base) => {
    const options = { method: "PUT", headers: { "X-User-Id": USER_A } };
    // Send both writes together to exercise the database's duplicate protection.
    const responses = await Promise.all([fetch(`${base}/25`, options), fetch(`${base}/25`, options)]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
    await fetch(`${base}/1`, options);
    assert.deepEqual(await (await fetch(base, { headers: options.headers })).json(), { pokemonIds: [1, 25] });
  });
});

test("UUID capitalization identifies the same browser", async () => {
  await withApi(async (base) => {
    const id = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
    await fetch(`${base}/25`, { method: "PUT", headers: { "X-User-Id": id.toUpperCase() } });
    assert.deepEqual(await (await fetch(base, { headers: { "X-User-Id": id } })).json(), { pokemonIds: [25] });
  });
});

test("favorites survive closing and reopening the local SQLite file", () => {
  // Remove only this test's uniquely named file, never the application database.
  const filename = join(tmpdir(), `beto-pokedex-favorites-${randomUUID()}.sqlite`);
  let store: ReturnType<typeof createFavoritesStore> | null = null;
  try {
    store = createFavoritesStore(filename);
    store.add(USER_A, 25);
    store.close();
    store = null;
    store = createFavoritesStore(filename);
    assert.deepEqual(store.list(USER_A), [25]);
    assert.deepEqual(store.list(USER_B), []);
  } finally {
    store?.close();
    if (existsSync(filename)) unlinkSync(filename);
  }
});

test("removing a favorite is browser-scoped, repeatable, and independent of PokeAPI", async () => {
  await withApi(async (base, lookups) => {
    const headers = { "X-User-Id": USER_A };
    await fetch(`${base}/25`, { method: "PUT", headers });
    await fetch(`${base}/1`, { method: "PUT", headers });
    await fetch(`${base}/25`, { method: "PUT", headers: { "X-User-Id": USER_B } });
    // Copy the log now so later comparisons detect any unexpected upstream call.
    const lookupsBeforeRemoval = [...lookups];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${base}/25`, { method: "DELETE", headers });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { pokemonId: 25, isFavorite: false });
    }
    assert.deepEqual(await (await fetch(base, { headers })).json(), { pokemonIds: [1] });
    assert.deepEqual(await (await fetch(base, { headers: { "X-User-Id": USER_B } })).json(), { pokemonIds: [25] });
    // This ID would fail upstream; deleting a missing local favorite must still work.
    assert.equal((await fetch(`${base}/888888`, { method: "DELETE", headers })).status, 200);
    assert.deepEqual(lookups, lookupsBeforeRemoval);
  });
});

test("removed favorites stay removed after reopening SQLite", () => {
  // Work with an isolated file so no real favorite records are modified.
  const filename = join(tmpdir(), `beto-pokedex-removal-${randomUUID()}.sqlite`);
  let store: ReturnType<typeof createFavoritesStore> | null = null;
  try {
    store = createFavoritesStore(filename);
    store.add(USER_A, 25);
    store.add(USER_B, 25);
    store.remove(USER_A, 25);
    store.close();
    store = null;
    store = createFavoritesStore(filename);
    assert.deepEqual(store.list(USER_A), []);
    assert.deepEqual(store.list(USER_B), [25]);
  } finally {
    store?.close();
    if (existsSync(filename)) unlinkSync(filename);
  }
});
