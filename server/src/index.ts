import { app } from './app.ts'

const port = Number(process.env.PORT ?? 3001)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Pokedex API listening at http://127.0.0.1:${port}`)
})

server.on('error', (error) => {
  console.error('Could not start the Pokedex API:', error.message)
  process.exit(1)
})
