import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Attach React to index.html; StrictMode adds development checks, including effect cleanup.
// ! tells TypeScript that index.html supplies the root element; it is not a runtime check.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
