import { useState, useEffect } from 'react'
import { SETTINGS_KEYS } from './lib/settingsKeys'
import './Settings.css'

export default function Settings() {
  const [apiKey, setApiKey] = useState('')
  const [isApiKeySet, setIsApiKeySet] = useState(false)

  useEffect(() => {
    window.electronAPI.getApiKeyStatus().then((status) => {
      setIsApiKeySet(status)
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.closeWindow()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  const [apiBaseUrl, setApiBaseUrl] = useState(
    localStorage.getItem(SETTINGS_KEYS.API_BASE_URL) || 'https://openrouter.ai/api/v1'
  )
  const [apiModel, setApiModel] = useState(
    localStorage.getItem(SETTINGS_KEYS.API_MODEL) || 'nvidia/nemotron-3-super-120b-a12b:free'
  )
  const [aiSystemPrompt, setAiSystemPrompt] = useState(
    localStorage.getItem(SETTINGS_KEYS.AI_SYSTEM_PROMPT) ||
      'Please provide a short and concise answer.'
  )

  // Shortcuts
  const [globalShortcutNewNote, setGlobalShortcutNewNote] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_NEWNOTE) || 'CommandOrControl+Shift+N'
  )
  const [globalShortcutToggle, setGlobalShortcutToggle] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHORTCUT_TOGGLE) || 'CommandOrControl+Shift+C'
  )

  // Startup
  const [launchAtStartup, setLaunchAtStartup] = useState(
    localStorage.getItem(SETTINGS_KEYS.LAUNCH_STARTUP) === 'true'
  )

  // Appearance State
  const [fontFamily, setFontFamily] = useState(
    localStorage.getItem(SETTINGS_KEYS.FONT_FAMILY) || "'JetBrains Mono', monospace"
  )
  const [showRulings, setShowRulings] = useState(
    localStorage.getItem(SETTINGS_KEYS.SHOW_RULINGS) !== 'false'
  )
  const [themePreset, setThemePreset] = useState(
    localStorage.getItem(SETTINGS_KEYS.THEME_PRESET) || 'grid-light'
  )
  const [bgType, setBgType] = useState(localStorage.getItem(SETTINGS_KEYS.BG_TYPE) || 'color') // preset, color, image
  const [bgColor, setBgColor] = useState(localStorage.getItem(SETTINGS_KEYS.BG_COLOR) || '#ffffff')
  const [bgImage, setBgImage] = useState(localStorage.getItem(SETTINGS_KEYS.BG_IMAGE) || '')

  const [textColor, setTextColor] = useState(
    localStorage.getItem(SETTINGS_KEYS.TEXT_COLOR) || '#000000'
  )
  const [numColor, setNumColor] = useState(
    localStorage.getItem(SETTINGS_KEYS.NUM_COLOR) || '#8ab4f8'
  )
  const [symColor, setSymColor] = useState(
    localStorage.getItem(SETTINGS_KEYS.SYM_COLOR) || '#ff0000'
  )
  const [aiColor, setAiColor] = useState(localStorage.getItem(SETTINGS_KEYS.AI_COLOR) || '#8b5cf6')
  const [mathColor, setMathColor] = useState(
    localStorage.getItem(SETTINGS_KEYS.MATH_COLOR) || '#10b981'
  )

  const saveSettings = async () => {
    if (apiKey) {
      await window.electronAPI.setApiKey(apiKey)
    }
    localStorage.setItem(SETTINGS_KEYS.API_BASE_URL, apiBaseUrl)
    localStorage.setItem(SETTINGS_KEYS.API_MODEL, apiModel)
    localStorage.setItem(SETTINGS_KEYS.AI_SYSTEM_PROMPT, aiSystemPrompt)

    localStorage.setItem(SETTINGS_KEYS.FONT_FAMILY, fontFamily)
    localStorage.setItem(SETTINGS_KEYS.SHOW_RULINGS, showRulings.toString())
    localStorage.setItem(SETTINGS_KEYS.THEME_PRESET, themePreset)
    localStorage.setItem(SETTINGS_KEYS.BG_TYPE, bgType)
    localStorage.setItem(SETTINGS_KEYS.BG_COLOR, bgColor)
    localStorage.setItem(SETTINGS_KEYS.BG_IMAGE, bgImage)

    localStorage.setItem(SETTINGS_KEYS.TEXT_COLOR, textColor)
    localStorage.setItem(SETTINGS_KEYS.NUM_COLOR, numColor)
    localStorage.setItem(SETTINGS_KEYS.SYM_COLOR, symColor)
    localStorage.setItem(SETTINGS_KEYS.AI_COLOR, aiColor)
    localStorage.setItem(SETTINGS_KEYS.MATH_COLOR, mathColor)

    // Startup
    localStorage.setItem(SETTINGS_KEYS.LAUNCH_STARTUP, launchAtStartup.toString())
    if (window.electronAPI.setLaunchAtStartup) {
      window.electronAPI.setLaunchAtStartup(launchAtStartup)
    }

    // Shortcuts
    const oldShortcut =
      localStorage.getItem('papercache-shortcut-newnote') || 'CommandOrControl+Shift+N'
    localStorage.setItem('papercache-shortcut-newnote', globalShortcutNewNote)
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('new-note', oldShortcut, globalShortcutNewNote)
    }

    const oldToggleShortcut =
      localStorage.getItem('papercache-shortcut-toggle') || 'CommandOrControl+Shift+C'
    localStorage.setItem('papercache-shortcut-toggle', globalShortcutToggle)
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('toggle', oldToggleShortcut, globalShortcutToggle)
    }

    // Dispatch storage event manually for the same window to pick it up immediately
    window.dispatchEvent(new Event('storage'))

    window.electronAPI.closeWindow() // actually closes settings window
  }

  const closeSettings = () => {
    window.electronAPI.closeWindow()
  }

  const quitApp = () => {
    window.electronAPI.quitApp()
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-content">
        <section>
          <h3>AI Configuration</h3>
          <div className="setting-group">
            <label>API Key {isApiKeySet ? '✅ (Set)' : ''}</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isApiKeySet ? 'Enter new key to replace existing' : 'sk-...'}
            />
          </div>

          <div className="setting-group">
            <label>API Base URL</label>
            <input
              type="text"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://openrouter.ai/api/v1"
            />
          </div>

          <div className="setting-group">
            <label>Model Name</label>
            <input
              type="text"
              value={apiModel}
              onChange={(e) => setApiModel(e.target.value)}
              placeholder="nvidia/nemotron-3-super-120b-a12b:free"
            />
          </div>

          <div className="setting-group">
            <label>System Prompt (Instructions)</label>
            <textarea
              value={aiSystemPrompt}
              onChange={(e) => setAiSystemPrompt(e.target.value)}
              placeholder="e.g. Please provide a short and concise answer."
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                background: 'rgba(128,128,128,0.1)',
                border: '1px solid rgba(128,128,128,0.2)',
                color: 'inherit',
                borderRadius: '4px',
                fontFamily: "'JetBrains Mono', monospace",
                resize: 'vertical',
                textAlign: 'center',
              }}
            />
          </div>
        </section>

        <section>
          <h3>Global Shortcuts</h3>
          <div className="setting-group">
            <label>Toggle App Visibility</label>
            <input
              type="text"
              value={globalShortcutToggle}
              onChange={(e) => setGlobalShortcutToggle(e.target.value)}
              placeholder="e.g. CommandOrControl+Shift+C"
            />
          </div>
          <div className="setting-group">
            <label>New Note (Global)</label>
            <input
              type="text"
              value={globalShortcutNewNote}
              onChange={(e) => setGlobalShortcutNewNote(e.target.value)}
              placeholder="e.g. CommandOrControl+Shift+N"
            />
          </div>
        </section>

        <section>
          <h3>System</h3>
          <div className="setting-group">
            <label>Launch at Startup</label>
            <input
              type="checkbox"
              checked={launchAtStartup}
              onChange={(e) => setLaunchAtStartup(e.target.checked)}
              style={{ width: 'auto', marginRight: 'auto' }}
            />
          </div>
        </section>

        <section>
          <h3>Appearance</h3>
          <div className="setting-group">
            <label>Font Family</label>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
              <option value="'JetBrains Mono', monospace">JetBrains Mono (Default)</option>
              <option value="Menlo, Monaco, 'Courier New', monospace">Monospace</option>
              <option value="Inter, system-ui, -apple-system, sans-serif">
                Sans-serif (Modern)
              </option>
              <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
                System Default
              </option>
              <option value="Georgia, Cambria, 'Times New Roman', Times, serif">
                Serif (Classic)
              </option>
            </select>
          </div>

          <div className="setting-group">
            <label>Show Ruled Lines (Grid)</label>
            <input
              type="checkbox"
              checked={showRulings}
              onChange={(e) => setShowRulings(e.target.checked)}
              style={{ width: 'auto', marginRight: 'auto' }}
            />
          </div>

          <div className="setting-group">
            <label>Background Type</label>
            <select value={bgType} onChange={(e) => setBgType(e.target.value)}>
              <option value="preset">Preset Theme</option>
              <option value="color">Solid Color</option>
              <option value="image">Custom Image URL</option>
            </select>
          </div>

          {bgType === 'preset' && (
            <div className="setting-group">
              <label>Theme Preset</label>
              <select value={themePreset} onChange={(e) => setThemePreset(e.target.value)}>
                <option value="paper-light">Paper Light</option>
                <option value="grid-dark">Grid Dark</option>
                <option value="blueprint">Blueprint</option>
              </select>
            </div>
          )}

          {bgType === 'color' && (
            <div className="setting-group color-row">
              <label>Background Color</label>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
            </div>
          )}

          {bgType === 'image' && (
            <div className="setting-group">
              <label>Background Image URL</label>
              <input
                type="text"
                value={bgImage}
                onChange={(e) => setBgImage(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          <div className="setting-group color-row">
            <label>Main Text</label>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
          </div>

          <div className="setting-group color-row">
            <label>Numbers</label>
            <input type="color" value={numColor} onChange={(e) => setNumColor(e.target.value)} />
          </div>

          <div className="setting-group color-row">
            <label>Math Symbols</label>
            <input type="color" value={symColor} onChange={(e) => setSymColor(e.target.value)} />
          </div>

          <div className="setting-group color-row">
            <label>Math Results (Autofill)</label>
            <input type="color" value={mathColor} onChange={(e) => setMathColor(e.target.value)} />
          </div>

          <div className="setting-group color-row">
            <label>AI Response Text</label>
            <input type="color" value={aiColor} onChange={(e) => setAiColor(e.target.value)} />
          </div>
        </section>
      </div>

      <div className="settings-footer">
        <button className="quit-btn" onClick={quitApp}>
          Quit
        </button>
        <button className="close-btn" onClick={closeSettings}>
          Close Settings
        </button>
        <button className="save-btn" onClick={saveSettings}>
          Save Settings
        </button>
      </div>
    </div>
  )
}
