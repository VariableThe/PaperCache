import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Settings from './Settings.tsx'
import { migrateApiKeyFromLocalStorage } from './lib/safeStorage'

function Root() {
  const [hash, setHash] = useState(window.location.hash)
  const [migrated, setMigrated] = useState(false)

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    async function migrate() {
      await migrateApiKeyFromLocalStorage('papercache-apikey')
      setMigrated(true)
    }
    migrate()
  }, [])

  if (!migrated) return null

  return <StrictMode>{hash === '#/settings' ? <Settings /> : <App />}</StrictMode>
}

createRoot(document.getElementById('root')!).render(<Root />)
