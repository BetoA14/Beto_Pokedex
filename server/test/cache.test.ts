// Test caching with local loaders; no HTTP requests are needed.
import assert from "node:assert/strict";
import test from "node:test";
import { createCachedLoader } from "../src/services/cache.ts";

test("concurrent and subsequent requests reuse one successful load", async () => {
  let calls = 0;
  const get = createCachedLoader(
    async (key) => {
      calls += 1;
      return key.toUpperCase();
    },
    { ttlMs: 1000, maxEntries: 2 },
  );

  // Both callers share a pending load; the later call uses the stored result.
  assert.deepEqual(await Promise.all([get("pikachu"), get("pikachu")]), [
    "PIKACHU",
    "PIKACHU",
  ]);
  assert.equal(await get("pikachu"), "PIKACHU");
  assert.equal(calls, 1);
});

test("cached values expire at the TTL boundary", async () => {
  // Advance a fake clock to test expiry instantly and deterministically.
  let time = 0;
  let calls = 0;
  const get = createCachedLoader(async () => ++calls, {
    ttlMs: 1000,
    maxEntries: 2,
    now: () => time,
  });

  assert.equal(await get("pikachu"), 1);
  time = 999;
  assert.equal(await get("pikachu"), 1);
  time = 1000;
  assert.equal(await get("pikachu"), 2);
});

test("a full cache evicts the oldest stored entry", async () => {
  let calls = 0;
  const get = createCachedLoader(
    async (key) => {
      calls += 1;
      return key;
    },
    { ttlMs: 1000, maxEntries: 2 },
  );

  await get("a");
  await get("b");
  // The third key evicts a; reading b should still be a cache hit.
  await get("c");
  await get("b");
  assert.equal(calls, 3);
  await get("a");
  assert.equal(calls, 4);
});

test("failed loads are shared while pending but retried afterwards", async () => {
  let calls = 0;
  const get = createCachedLoader(
    async () => {
      calls += 1;
      if (calls === 1) throw new Error("Temporary outage");
      return "recovered";
    },
    { ttlMs: 1000, maxEntries: 2 },
  );

  // Inspect both rejections, then confirm a later request can recover.
  const results = await Promise.allSettled([get("pikachu"), get("pikachu")]);
  assert.ok(results.every((result) => result.status === "rejected"));
  assert.equal(calls, 1);
  assert.equal(await get("pikachu"), "recovered");
  assert.equal(calls, 2);
});
