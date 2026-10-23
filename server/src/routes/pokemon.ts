import { Router } from 'express'
import { HttpError } from '../errors.ts'
import type { PokemonService } from '../services/pokemon.ts'

function integerQuery(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new HttpError(400, 'limit and offset must be whole numbers')
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `Query value must be between ${min} and ${max}`)
  }
  return parsed
}

export function createPokemonRouter(service: PokemonService) {
  const router = Router()

  router.get('/', async (request, response) => {
    const limit = integerQuery(request.query.limit, 20, 1, 50)
    const offset = integerQuery(request.query.offset, 0, 0, Number.MAX_SAFE_INTEGER - 50)
    response.json(await service.listPokemon(limit, offset))
  })

  router.get('/:nameOrId', async (request, response) => {
    let key = request.params.nameOrId.trim().toLowerCase()
    if (/^\d+$/.test(key)) {
      const id = Number(key)
      if (!Number.isSafeInteger(id) || id < 1) {
        throw new HttpError(400, 'Pokemon ID must be a positive safe integer')
      }
      key = String(id)
    } else if (key.length > 100 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(key)) {
      throw new HttpError(400, 'Use a Pokemon name or positive numeric ID')
    }
    response.json(await service.getPokemon(key))
  })

  return router
}
