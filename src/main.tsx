import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { VoiceIndicatorWindow } from './App.tsx'
import Settings from './Settings.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { tauriApi } from './api'
window.electronAPI = tauriApi

// eslint-disable-next-line react-refresh/only-export-components
function MainRoot() {
  const [hash, setHash] = useState(window.location.hash)
  const [migrated, setMigrated] = useState(false)

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    async function migrate() {
      // Migrate legacy plain text key if it exists
      const plain = localStorage.getItem('papercache-apikey')
      if (plain) {
        try {
          const success = await window.electronAPI.setApiKey(plain)
          if (success) {
            localStorage.removeItem('papercache-apikey')
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to migrate plain API key', e)
        }
      }

      // Migrate legacy encrypted key if it exists
      const secureEncrypted = localStorage.getItem('papercache-apikey-secure')
      if (secureEncrypted) {
        try {
          // Decrypt it using the old method, then send to new IPC
          const decrypted = await window.electronAPI.safeStorageDecrypt(secureEncrypted)
          // Ensure it looks like an API key (e.g. typical lengths for OpenAI or anthropic are 40+ chars)
          // and not the original base64 garbage
          if (decrypted && decrypted !== secureEncrypted && decrypted.length > 20) {
            const success = await window.electronAPI.setApiKey(decrypted)
            if (success) {
              localStorage.removeItem('papercache-apikey-secure')
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to migrate secure API key', e)
        }
      }

      setMigrated(true)
    }
    migrate()
  }, [])

  if (!migrated) return null

  return (
    <StrictMode>
      <ErrorBoundary>{hash === '#/settings' ? <Settings /> : <App />}</ErrorBoundary>
    </StrictMode>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  if (getCurrentWindow().label === 'voice-indicator') {
    return (
      <StrictMode>
        <ErrorBoundary>
          <VoiceIndicatorWindow />
        </ErrorBoundary>
      </StrictMode>
    )
  }
  return <MainRoot />
}

createRoot(document.getElementById('root')!).render(<Root />)
