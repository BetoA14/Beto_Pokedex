import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { basename, dirname, join, resolve } from "node:path";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createFavoritesStore } from "../server/dist/db/favorites.js";

// Exercise the compiled app from a different working directory and a path with spaces.
const rootDirectory = fileURLToPath(new URL("../", import.meta.url));
const prefix = "beto-pokedex-portability-";
const temporaryDirectory = mkdtempSync(join(tmpdir(), prefix));
const databasePath = join(temporaryDirectory, "folder with spaces", "favorites.sqlite");
const userId = "11111111-1111-4111-8111-111111111111";
const headers = { "X-User-Id": userId };

// Ask the OS for a free local port instead of assuming 3001 is unused.
const reservation = createServer().listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
const origin = `http://127.0.0.1:${port}`;
let running;

async function start() {
  const child = spawn(process.execPath, [join(rootDirectory, "server", "dist", "index.js")], {
    cwd: tmpdir(),
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  running = { child, exited };
  let output = "";
  child.stdout.on("data", (data) => { output = (output + data).slice(-8000); });
  child.stderr.on("data", (data) => { output = (output + data).slice(-8000); });

  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Server stopped during startup: ${output}`);
    }
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Startup may still be opening the database and network listener. */ }
    await delay(100);
  }
  throw new Error(`Server did not become ready: ${output}`);
}

async function stop() {
  if (!running) return;
  const { child, exited } = running;
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  await exited;
  running = null;
}

try {
  await start();
  assert.ok(existsSync(databasePath), "Startup must create the database and parent directory");
  assert.deepEqual(await (await fetch(`${origin}/api/favorites`, { headers })).json(), { pokemonIds: [] });
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<div id="root"><\/div>/);
  const asset = html.match(/src="([^"]+\.js)"/);
  assert.ok(asset, "The built React bundle must be referenced by the page");
  const javascript = await fetch(new URL(asset[1], origin));
  assert.equal(javascript.status, 200);
  assert.match(javascript.headers.get("content-type"), /javascript/);
  const unknown = await fetch(`${origin}/api/unknown`);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).message, "Endpoint not found");

  // Seed only the isolated test database; persistence checks need no internet access.
  const store = createFavoritesStore(databasePath);
  try { store.add(userId, 25); } finally { store.close(); }
  await stop();
  await start();
  assert.deepEqual(await (await fetch(`${origin}/api/favorites`, { headers })).json(), { pokemonIds: [25] });
  console.log("Portability smoke check passed: built frontend, API, custom port, automatic SQLite creation, paths with spaces, and persistence after server restart.");
} finally {
  await stop();
  // Verify the exact temporary target before recursively removing test artifacts.
  const target = resolve(temporaryDirectory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith(prefix)) {
    throw new Error("Refusing to remove an unexpected temporary directory");
  }
  rmSync(target, { recursive: true, force: true });
}
