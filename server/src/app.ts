import express, { type ErrorRequestHandler } from 'express'
import { HttpError } from './errors.ts'
import { createPokemonRouter } from './routes/pokemon.ts'
import { createPokemonService, type PokemonService } from './services/pokemon.ts'

export function createApp(pokemonService: PokemonService = createPokemonService()) {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', message: 'Pokedex API is running' })
  })

  app.use('/api/pokemon', createPokemonRouter(pokemonService))

  app.use((_request, response) => {
    response.status(404).json({ message: 'Endpoint not found' })
  })

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ message: error.message })
      return
    }
    console.error('Unexpected API error:', error)
    response.status(500).json({ message: 'An unexpected server error occurred' })
  }
  app.use(errorHandler)

  return app
}

export const app = createApp()
