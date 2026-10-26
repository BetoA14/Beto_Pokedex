// Exercise real local HTTP routes while replacing all upstream PokeAPI requests.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { createFavoritesStore } from '../src/db/favorites.ts';
import { createPokemonService } from '../src/services/pokemon.ts'

// Minimal valid upstream fixture containing every field our parser consumes.
function pokemon(id = 25, name = 'pikachu') {
  return {
    id,
    name,
    height: 4,
    weight: 60,
    sprites: {
      front_default: `https://images.example/${id}.png`,
      other: { 'official-artwork': { front_default: `https://images.example/art/${id}.png` } },
    },
    types: [{ type: { name: 'electric' } }],
    abilities: [{ ability: { name: 'static' } }],
    stats: [{ stat: { name: 'speed' }, base_stat: 90 }],
  }
}

// Port 0 selects a free port; always close the server even when an assertion fails.
async function withApi(fetcher: typeof fetch, check: (baseUrl: string) => Promise<void>) {
  // Keep the existing Pokemon tests independent of the user's local database.
  const favorites = createFavoritesStore(':memory:');
  const server = createApp(createPokemonService({ fetcher }), favorites).listen(0, '127.0.0.1')
  // Wait for the listening event before issuing requests to the temporary server.
  await once(server, 'listening')
  try {
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    await check(`http://127.0.0.1:${address.port}`)
  } finally {
    // Convert Node's close callback to a Promise so cleanup finishes before the test ends.
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    favorites.close();
  }
}

test('listing returns details and local pagination URLs and reuses cached resources', async () => {
  const calls: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input)
    calls.push(url)
    assert.ok(init?.signal instanceof AbortSignal)
    if (url.endsWith('pokemon/?limit=2&offset=0')) {
      return Response.json({ count: 3, results: [{ name: 'bulbasaur' }, { name: 'pikachu' }] })
    }
    if (url.endsWith('/bulbasaur/')) return Response.json(pokemon(1, 'bulbasaur'))
    if (url.endsWith('/pikachu/')) return Response.json(pokemon())
    throw new Error(`Unexpected upstream URL: ${url}`)
  }

  await withApi(fetcher, async (base) => {
    const response = await fetch(`${base}/api/pokemon?limit=2&offset=0`)
    assert.equal(response.status, 200)
    const page = await response.json()
    assert.equal(page.count, 3)
    assert.equal(page.limit, 2)
    assert.equal(page.offset, 0)
    assert.equal(page.next, '/api/pokemon?limit=2&offset=2')
    assert.equal(page.previous, null)
    assert.deepEqual(page.results.map((entry: { name: string }) => entry.name), ['bulbasaur', 'pikachu'])
    assert.deepEqual(page.results[1], {
      id: 25, name: 'pikachu', image: 'https://images.example/art/25.png',
      types: ['electric'], heightMeters: 0.4, weightKilograms: 6,
      abilities: ['static'], stats: [{ name: 'speed', baseStat: 90 }],
    })
    assert.equal((await fetch(`${base}/api/pokemon?limit=2&offset=0`)).status, 200)
    assert.equal((await fetch(`${base}/api/pokemon/pikachu`)).status, 200)
    // Only the initial list and its two detail requests should reach upstream.
    assert.equal(calls.length, 3)
  })
})

test('lookup normalizes name case and whitespace, and supports IDs and hyphenated names', async () => {
  const calls: string[] = []
  await withApi(async (input) => {
    calls.push(String(input))
    return Response.json(pokemon())
  }, async (base) => {
    for (const key of ['%20PIKACHU%20', 'pikachu', '00025', 'mr-mime']) {
      assert.equal((await fetch(`${base}/api/pokemon/${key}`)).status, 200)
    }
    // Equivalent names share a key; numeric IDs intentionally use a separate key.
    assert.deepEqual(calls, [
      'https://pokeapi.co/api/v2/pokemon/pikachu/',
      'https://pokeapi.co/api/v2/pokemon/25/',
      'https://pokeapi.co/api/v2/pokemon/mr-mime/',
    ])
  })
})

test('invalid query values and lookup keys return 400 without requesting PokeAPI', async () => {
  let calls = 0
  await withApi(async () => {
    calls += 1
    return Response.json(pokemon())
  }, async (base) => {
    for (const suffix of [
      '?limit=0', '?limit=51', '?limit=1.5', '?limit=1e1', '?offset=-1',
      '?limit=', '?limit=2&limit=3', '?offset=9007199254740991',
      '/0', '/9007199254740992', '/%20', '/pika%3Fchu',
    ]) {
      const response = await fetch(`${base}/api/pokemon${suffix}`)
      assert.equal(response.status, 400, suffix)
      assert.equal(typeof (await response.json()).message, 'string')
    }
    // Validation must reject bad input before contacting the external service.
    assert.equal(calls, 0)
  })
})

test('default pagination and an empty page use our own navigation links', async () => {
  await withApi(async (input) => {
    const url = new URL(String(input))
    assert.equal(url.searchParams.get('limit'), '20')
    return Response.json({ count: 1, results: [] })
  }, async (base) => {
    const first = await (await fetch(`${base}/api/pokemon`)).json()
    assert.equal(first.limit, 20)
    assert.equal(first.offset, 0)
    assert.equal(first.next, null)
    assert.equal(first.previous, null)
    const empty = await (await fetch(`${base}/api/pokemon?offset=20`)).json()
    assert.deepEqual(empty.results, [])
    assert.equal(empty.next, null)
    assert.equal(empty.previous, '/api/pokemon?limit=20&offset=0')
  })
})

test('missing Pokemon return JSON 404 and failures are not cached', async () => {
  let calls = 0
  await withApi(async () => {
    calls += 1
    return new Response('Not Found', { status: 404 })
  }, async (base) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${base}/api/pokemon/does-not-exist`)
      assert.equal(response.status, 404)
      assert.deepEqual(await response.json(), { message: 'Pokemon not found' })
    }
    assert.equal(calls, 2)
  })
})

test('upstream HTTP, network, and timeout failures return controlled JSON errors', async () => {
  // Simulate failures directly so tests do not depend on outages or real timeouts.
  const cases: { fetcher: typeof fetch; status: number }[] = [
    { fetcher: async () => new Response('Private upstream details', { status: 503 }), status: 502 },
    { fetcher: async () => { throw new TypeError('Private network details') }, status: 502 },
    { fetcher: async () => { throw new DOMException('Timeout', 'TimeoutError') }, status: 504 },
    { fetcher: async () => new Response('not json'), status: 502 },
  ]
  for (const entry of cases) {
    await withApi(entry.fetcher, async (base) => {
      const response = await fetch(`${base}/api/pokemon/pikachu`)
      assert.equal(response.status, entry.status)
      const body = await response.json()
      assert.equal(typeof body.message, 'string')
      assert.doesNotMatch(JSON.stringify(body), /Private/)
    })
  }
})

test('malformed Pokemon data is rejected before caching, then retried successfully', async () => {
  let calls = 0
  await withApi(async () => {
    calls += 1
    // A bad first response must not poison the cache for the valid retry.
    return Response.json(calls === 1 ? { ...pokemon(), weight: 'sixty' } : pokemon())
  }, async (base) => {
    const bad = await fetch(`${base}/api/pokemon/pikachu`)
    assert.equal(bad.status, 502)
    assert.deepEqual(await bad.json(), { message: 'PokeAPI returned an invalid response' })
    assert.equal((await fetch(`${base}/api/pokemon/pikachu`)).status, 200)
    assert.equal(calls, 2)
  })
})

test('malformed lists are rejected without requesting details', async () => {
  let calls = 0
  await withApi(async () => {
    calls += 1
    return Response.json({ count: 3, results: [{ name: '../invalid' }] })
  }, async (base) => {
    assert.equal((await fetch(`${base}/api/pokemon`)).status, 502)
    assert.equal(calls, 1)
  })
})

test('missing artwork falls back to a sprite and missing images remain null', async () => {
  for (const sprite of ['https://images.example/sprite.png', null]) {
    await withApi(async () => Response.json({
      ...pokemon(), sprites: { front_default: sprite, other: { 'official-artwork': { front_default: null } } },
    }), async (base) => {
      const response = await fetch(`${base}/api/pokemon/pikachu`)
      assert.equal(response.status, 200)
      assert.equal((await response.json()).image, sprite)
    })
  }
})

test('list detail requests are limited to five at a time', async () => {
  let active = 0
  let maximum = 0
  const service = createPokemonService({ fetcher: async (input) => {
    const url = String(input)
    if (url.includes('?')) {
      return Response.json({ count: 12, results: Array.from({ length: 12 }, (_, id) => ({ name: `pokemon-${id + 1}` })) })
    }
    // Measure overlapping detail loads, rather than just the total number of requests.
    active += 1
    maximum = Math.max(maximum, active)
    // Keep requests overlapping for one event-loop turn to measure concurrency.
    await new Promise((resolve) => setImmediate(resolve))
    active -= 1
    return Response.json(pokemon())
  } })
  assert.equal((await service.listPokemon(12, 0)).results.length, 12)
  assert.equal(maximum, 5)
})

// Advance the injected clock to verify the configured production cache lifetime.
test('service cache refreshes after one hour', async () => {
  let time = 0
  let calls = 0
  const service = createPokemonService({
    now: () => time,
    fetcher: async () => { calls += 1; return Response.json(pokemon()) },
  })
  await service.getPokemon('pikachu')
  time = 60 * 60 * 1000 - 1
  await service.getPokemon('pikachu')
  assert.equal(calls, 1)
  time += 1
  await service.getPokemon('pikachu')
  assert.equal(calls, 2)
})
