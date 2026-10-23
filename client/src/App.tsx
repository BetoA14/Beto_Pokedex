import { useEffect, useState } from 'react'
import { getHealth } from './services/api'
import './App.css'

type ConnectionStatus = 'checking' | 'connected' | 'unavailable'

function App() {
  const [connection, setConnection] = useState<ConnectionStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()

    async function checkConnection() {
      try {
        const health = await getHealth(controller.signal)
        if (!controller.signal.aborted) {
          setConnection(health.status === 'ok' ? 'connected' : 'unavailable')
        }
      } catch {
        if (!controller.signal.aborted) {
          setConnection('unavailable')
        }
      }
    }

    void checkConnection()
    return () => controller.abort()
  }, [])

  const statusText = {
    checking: 'Checking backend connection…',
    connected: 'Backend connected',
    unavailable: 'Backend unavailable. Start both apps with npm.cmd run dev and refresh.',
  }

  return (
    <main className="welcome">
      <div className="pokeball" aria-hidden="true" />
      <p className="eyebrow">Beto’s Pokédex</p>
      <h1>Your Pokémon adventure starts here.</h1>
      <p className="intro">
        Soon you’ll be able to explore Pokémon, search for a name, and save your
        favorites.
      </p>
      <p className={`connection ${connection}`} role="status">
        {statusText[connection]}
      </p>
    </main>
  )
}

export default App
