import assert from "node:assert/strict";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import test, { type TestContext } from "node:test";
import { createApp } from "../src/app.ts";
import { createFavoritesStore } from "../src/db/favorites.ts";
import { HttpError } from "../src/errors.ts";
import { createPokemonService } from "../src/services/pokemon.ts";
import { createRateLimiter, type RequestLimiter } from "../src/services/rate-limiter.ts";

// Let Promise callbacks settle without advancing the mocked scheduling clock.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function clockFor(t: TestContext) {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });
  return {
    now: () => Date.now(),
    async tick(milliseconds: number) {
      t.mock.timers.tick(milliseconds);
      await flush();
    },
  };
}

function pokemon(id = 25) {
  return {
    id, name: `pokemon-${id}`, height: 4, weight: 60,
    sprites: { front_default: null }, types: [], abilities: [], stats: [],
  };
}

test("twenty-per-second pacing preserves FIFO order without boundary bursts", async (t) => {
  const clock = clockFor(t);
  const limiter = createRateLimiter({ now: clock.now });
  const starts: number[] = [];
  const jobs = Array.from({ length: 41 }, (_, index) => limiter.schedule(async () => {
    starts.push(Date.now());
    return index;
  }));
  await flush();
  assert.deepEqual(starts, [0]);
  for (let index = 1; index < jobs.length; index += 1) {
    await clock.tick(49);
    assert.equal(starts.length, index);
    await clock.tick(1);
    assert.equal(starts[index], index * 50);
  }
  assert.deepEqual(await Promise.all(jobs), Array.from({ length: jobs.length }, (_, index) => index));
  for (const start of starts) {
    assert.ok(starts.filter((value) => value >= start && value < start + 1000).length <= 20);
  }
});

test("an uncached 20-card page takes at least one second even with immediate responses", async (t) => {
  const clock = clockFor(t);
  const limiter = createRateLimiter({ now: clock.now });
  const starts: number[] = [];
  const service = createPokemonService({ limiter, now: clock.now, fetcher: async (input) => {
    starts.push(Date.now());
    if (String(input).includes("?")) {
      return Response.json({
        count: 20,
        results: Array.from({ length: 20 }, (_, index) => ({ name: `pokemon-${index + 1}` })),
      });
    }
    const id = Number(String(input).match(/pokemon-(\d+)\/$/)?.[1]);
    return Response.json(pokemon(id));
  } });
  let completedAt: number | undefined;
  const page = service.listPokemon(20, 0).then((result) => {
    completedAt = Date.now();
    return result;
  });
  await flush();
  // Advance in dispatch intervals, letting each response and subsequent batch settle.
  for (let index = 0; index < 19; index += 1) await clock.tick(50);
  await clock.tick(49);
  assert.equal(completedAt, undefined);
  assert.equal(starts.length, 20);
  await clock.tick(1);
  assert.equal((await page).results.length, 20);
  assert.equal(completedAt, 1000);
  assert.equal(starts.length, 21);
  // The same cached page should return immediately without another network call.
  await service.listPokemon(20, 0);
  assert.equal(starts.length, 21);
  assert.equal(Date.now(), 1000);
});

test("slow requests cannot exceed the concurrency cap", async (t) => {
  const clock = clockFor(t);
  const limiter = createRateLimiter({ now: clock.now, maxConcurrent: 2 });
  const releases: (() => void)[] = [];
  let active = 0;
  let maximum = 0;
  const jobs = Array.from({ length: 3 }, () => limiter.schedule(() => {
    active += 1;
    maximum = Math.max(maximum, active);
    return new Promise<void>((resolve) => releases.push(resolve)).finally(() => { active -= 1; });
  }));
  await clock.tick(50);
  assert.equal(releases.length, 2);
  await clock.tick(50);
  assert.equal(releases.length, 2);
  releases[0]();
  await flush();
  assert.equal(releases.length, 3);
  releases[1]();
  releases[2]();
  await Promise.all(jobs);
  assert.equal(maximum, 2);
});

test("a delayed event loop does not release accumulated starts in a burst", async (t) => {
  const clock = clockFor(t);
  const limiter = createRateLimiter({ now: clock.now });
  const starts: number[] = [];
  const jobs = Array.from({ length: 4 }, () => limiter.schedule(async () => { starts.push(Date.now()); }));
  await flush();
  await clock.tick(5000);
  assert.deepEqual(starts, [0, 5000]);
  await clock.tick(50);
  await clock.tick(50);
  await Promise.all(jobs);
  assert.deepEqual(starts, [0, 5000, 5050, 5100]);
});

test("queue capacity and deadlines reject excess work and recover afterwards", async (t) => {
  const clock = clockFor(t);
  const limiter = createRateLimiter({ now: clock.now, maxConcurrent: 1, maxQueue: 2, maxWaitMs: 1000 });
  let release!: () => void;
  const active = limiter.schedule(() => new Promise<void>((resolve) => { release = resolve; }));
  let queuedCalls = 0;
  // Attach rejection handlers before advancing time to avoid unhandled test promises.
  const waiting = Promise.allSettled([
    limiter.schedule(async () => { queuedCalls += 1; }),
    limiter.schedule(async () => { queuedCalls += 1; }),
  ]);
  await assert.rejects(limiter.schedule(async () => {}), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 503);
    assert.ok(error.retryAfterSeconds! >= 1);
    return true;
  });
  await clock.tick(1000);
  const results = await waiting;
  assert.ok(results.every((result) => result.status === "rejected" && result.reason.status === 503));
  assert.equal(queuedCalls, 0);
  release();
  await active;
  await flush();
  assert.equal(await limiter.schedule(async () => "recovered"), "recovered");
});

test("synchronous and asynchronous failures release concurrency slots", async (t) => {
  const clock = clockFor(t);
  const limiter = createRateLimiter({ now: clock.now, maxConcurrent: 1 });
  const synchronous = assert.rejects(limiter.schedule(() => { throw new Error("sync failure"); }), /sync failure/);
  const asynchronous = assert.rejects(limiter.schedule(async () => { throw new Error("async failure"); }), /async failure/);
  const recovered = limiter.schedule(async () => "ok");
  await flush();
  await clock.tick(50);
  await clock.tick(50);
  await Promise.all([synchronous, asynchronous]);
  assert.equal(await recovered, "ok");
});

test("the longest cooldown applies to all queued jobs", async (t) => {
  const clock = clockFor(t);
  const limiter = createRateLimiter({ now: clock.now });
  await limiter.schedule(async () => {});
  limiter.pauseFor(3000);
  limiter.pauseFor(100);
  const starts: number[] = [];
  const job = limiter.schedule(async () => { starts.push(Date.now()); });
  await clock.tick(2999);
  assert.deepEqual(starts, []);
  await clock.tick(1);
  await job;
  assert.deepEqual(starts, [3000]);
});

test("a cooldown longer than the queue budget rejects new work immediately", async (t) => {
  const clock = clockFor(t);
  const limiter = createRateLimiter({ now: clock.now, maxWaitMs: 1000 });
  limiter.pauseFor(10_000);
  await assert.rejects(limiter.schedule(async () => {}), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.retryAfterSeconds, 10);
    return true;
  });
});

test("invalid limiter settings fail during construction", () => {
  for (const options of [
    { requestsPerSecond: 0 }, { requestsPerSecond: 1.5 }, { requestsPerSecond: 1001 },
    { maxConcurrent: 0 }, { maxQueue: -1 }, { maxWaitMs: Infinity },
  ]) {
    assert.throws(() => createRateLimiter(options));
  }
});

test("cache hits and duplicate pending lookups consume only one scheduled slot", async () => {
  let scheduled = 0;
  let fetched = 0;
  const limiter: RequestLimiter = {
    schedule(task) { scheduled += 1; return task(); },
    pauseFor() {},
  };
  const service = createPokemonService({ limiter, fetcher: async () => {
    fetched += 1;
    return Response.json(pokemon());
  } });
  await Promise.all([service.getPokemon("25"), service.getPokemon("25")]);
  await service.getPokemon("25");
  assert.equal(scheduled, 1);
  assert.equal(fetched, 1);
});

test("Retry-After seconds and HTTP dates produce shared cooldown hints", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2030-01-01T00:00:00Z") });
  const cases = [
    { status: 429, header: "3", wait: 3 },
    { status: 503, header: "Tue, 01 Jan 2030 00:00:04 GMT", wait: 4 },
    { status: 429, header: null, wait: 1 },
    { status: 429, header: "invalid", wait: 1 },
    { status: 429, header: "-1", wait: 1 },
    { status: 429, header: "0", wait: 1 },
  ];
  for (const entry of cases) {
    const pauses: number[] = [];
    const limiter: RequestLimiter = {
      schedule: (task) => task(),
      pauseFor: (milliseconds) => { pauses.push(milliseconds); },
    };
    const service = createPokemonService({ limiter, fetcher: async () => new Response("upstream body", {
      status: entry.status, headers: entry.header === null ? {} : { "Retry-After": entry.header },
    }) });
    await assert.rejects(service.getPokemon("25"), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 503);
      assert.equal(error.retryAfterSeconds, entry.wait);
      return true;
    });
    assert.deepEqual(pauses, [entry.wait * 1000]);
  }
});

test("an upstream cooldown delays another service and starts its timeout only at dispatch", async (t) => {
  const clock = clockFor(t);
  const limiter = createRateLimiter({ now: clock.now });
  const timeoutStarts: number[] = [];
  t.mock.method(AbortSignal, "timeout", () => {
    timeoutStarts.push(Date.now());
    return new AbortController().signal;
  });
  const first = createPokemonService({ limiter, fetcher: async () => new Response("busy", {
    status: 429, headers: { "Retry-After": "3" },
  }) });
  let secondCalls = 0;
  const second = createPokemonService({ limiter, fetcher: async () => {
    secondCalls += 1;
    return Response.json(pokemon(2));
  } });
  const rejected = assert.rejects(first.getPokemon("1"), { status: 503 });
  const waiting = second.getPokemon("2");
  await flush();
  assert.deepEqual(timeoutStarts, [0]);
  await clock.tick(2999);
  assert.equal(secondCalls, 0);
  await clock.tick(1);
  assert.equal((await waiting).id, 2);
  await rejected;
  assert.deepEqual(timeoutStarts, [0, 3000]);
});

test("a concurrency slot stays occupied until the response body is parsed", async (t) => {
  const clock = clockFor(t);
  const limiter = createRateLimiter({ now: clock.now, maxConcurrent: 1 });
  let finishBody!: (value: unknown) => void;
  const body = new Promise<unknown>((resolve) => { finishBody = resolve; });
  let calls = 0;
  const service = createPokemonService({ limiter, fetcher: async () => {
    calls += 1;
    if (calls === 1) {
      const response = new Response();
      response.json = () => body;
      return response;
    }
    return Response.json(pokemon(2));
  } });
  const first = service.getPokemon("1");
  const second = service.getPokemon("2");
  await flush();
  await clock.tick(2000);
  assert.equal(calls, 1);
  finishBody(pokemon(1));
  await flush();
  assert.deepEqual((await Promise.all([first, second])).map((value) => value.id), [1, 2]);
});

test("default service instances share the process-wide limiter", async () => {
  const starts: number[] = [];
  const fetcher: typeof fetch = async (input) => {
    starts.push(performance.now());
    return Response.json(pokemon(Number(String(input).split("/").at(-2))));
  };
  const first = createPokemonService({ fetcher });
  const second = createPokemonService({ fetcher });
  const jobs = [first.getPokemon("1"), second.getPokemon("2"), first.getPokemon("3")];
  await flush();
  assert.equal(starts.length, 1);
  assert.deepEqual((await Promise.all(jobs)).map((value) => value.id), [1, 2, 3]);
  // Fake-clock tests enforce exact intervals; allow small observation overhead in this wiring check.
  assert.ok(starts[1] - starts[0] >= 45);
  assert.ok(starts[2] - starts[1] >= 45);
});

test("queue overload returns HTTP 503 with Retry-After while local endpoints stay usable", async () => {
  const limiter = createRateLimiter({ maxConcurrent: 1, maxQueue: 1 });
  let release!: () => void;
  const active = limiter.schedule(() => new Promise<void>((resolve) => { release = resolve; }));
  const queued = limiter.schedule(async () => {});
  const store = createFavoritesStore(":memory:");
  let fetched = 0;
  const service = createPokemonService({ limiter, fetcher: async () => {
    fetched += 1;
    return Response.json(pokemon());
  } });
  const server = createApp(service, store).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${base}/api/pokemon/25`);
    assert.equal(response.status, 503);
    assert.ok(Number(response.headers.get("Retry-After")) >= 1);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(typeof (await response.json()).message, "string");
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    const headers = { "X-User-Id": "11111111-1111-4111-8111-111111111111" };
    assert.equal((await fetch(`${base}/api/favorites`, { headers })).status, 200);
    assert.equal((await fetch(`${base}/api/favorites/25`, { headers, method: "DELETE" })).status, 200);
    assert.equal(fetched, 0);
  } finally {
    release();
    await Promise.all([active, queued]);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
  }
});
