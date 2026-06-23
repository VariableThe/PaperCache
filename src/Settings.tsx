import { useState, useEffect } from 'react'
import { SETTINGS_KEYS } from './lib/settingsKeys'
import { useSettingsStore } from './store/useSettingsStore'
import { useAppStore } from './store/useAppStore'
import './Settings.css'

export default function Settings({ onClose }: { onClose?: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [isApiKeySet, setIsApiKeySet] = useState(false)

  useEffect(() => {
    window.electronAPI.getApiKeyStatus().then((status) => {
      setIsApiKeySet(status)
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      const isRecordingShortcut = useAppStore.getState().isRecordingShortcut
      if (e.key === 'Escape' && !e.defaultPrevented && !isRecordingShortcut) {
        if (onClose) onClose()
        else window.electronAPI.closeWindow()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
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
  const initialSettings = useSettingsStore.getState()
  const [fontFamily, setFontFamily] = useState(initialSettings.fontFamily)
  const [showRulings, setShowRulings] = useState(initialSettings.showRulings)
  const [themePreset, setThemePreset] = useState(initialSettings.themePreset)
  const [bgType, setBgType] = useState<'preset' | 'color' | 'image'>(
    initialSettings.bgType || 'preset'
  )
  const [bgColor, setBgColor] = useState(initialSettings.bgColor)
  const [bgImage, setBgImage] = useState(initialSettings.bgImage)

  const [textColor, setTextColor] = useState(initialSettings.textColor)
  const [numColor, setNumColor] = useState(initialSettings.numColor)
  const [symColor, setSymColor] = useState(initialSettings.symColor)
  const [aiColor, setAiColor] = useState(initialSettings.aiColor)
  const [mathColor, setMathColor] = useState(initialSettings.mathColor)

  const saveSettings = async () => {
    localStorage.setItem(SETTINGS_KEYS.API_BASE_URL, apiBaseUrl)
    localStorage.setItem(SETTINGS_KEYS.API_MODEL, apiModel)
    localStorage.setItem(SETTINGS_KEYS.AI_SYSTEM_PROMPT, aiSystemPrompt)

    if (apiKey) {
      const success = await window.electronAPI.setApiKey(apiKey)
      if (!success) {
        alert('Failed to save API key securely. Check console.')
      }
    } else {
      await window.electronAPI.setApiKey('') // clear key
    }

    useSettingsStore.getState().setSettings({
      fontFamily,
      showRulings,
      themePreset,
      bgType: bgType as 'color' | 'image',
      bgColor,
      bgImage,
      textColor,
      numColor,
      symColor,
      aiColor,
      mathColor,
    })

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

    if (onClose) {
      onClose()
    } else {
      window.electronAPI.closeWindow() // actually closes settings window
    }
  }

  const closeSettings = () => {
    if (onClose) {
      onClose()
    } else {
      window.electronAPI.closeWindow()
    }
  }

  const quitApp = () => {
    window.electronAPI.quitApp()
  }

  return (
    <div
      className="settings-container"
      style={{ fontFamily, width: '100%', maxWidth: '800px', margin: '0 auto' }}
    >
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
                fontFamily: 'inherit',
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
            <ShortcutInput value={globalShortcutToggle} onChange={setGlobalShortcutToggle} />
          </div>
          <div className="setting-group">
            <label>New Note (Global)</label>
            <ShortcutInput value={globalShortcutNewNote} onChange={setGlobalShortcutNewNote} />
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
          <div className="setting-group">
            <label>Auto-Updates</label>
            <button
              onClick={() => window.electronAPI.checkForUpdates()}
              style={{
                padding: '6px 12px',
                background: 'rgba(128,128,128,0.1)',
                border: '1px solid rgba(128,128,128,0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'inherit',
                fontFamily: 'inherit',
                margin: '0 auto',
              }}
            >
              Check for Updates Now
            </button>
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
            <select
              value={bgType}
              onChange={(e) => setBgType(e.target.value as 'preset' | 'color' | 'image')}
            >
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

function ShortcutInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [recording, setRecordingLocal] = useState(false)
  const setIsRecordingShortcut = useAppStore((state) => state.setIsRecordingShortcut)

  const setRecording = (val: boolean) => {
    setRecordingLocal(val)
    setIsRecordingShortcut(val)
  }

  useEffect(() => {
    if (recording) {
      if (window.electronAPI.pauseShortcuts) window.electronAPI.pauseShortcuts()
    } else {
      if (window.electronAPI.resumeShortcuts) window.electronAPI.resumeShortcuts()
    }
  }, [recording])

  const renderShortcutDisplay = (shortcut: string) => {
    if (!shortcut) return <span>Click to record</span>
    const parts = shortcut.split('+')
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          justifyContent: 'space-evenly',
        }}
      >
        {parts.map((part, index) => {
          let display = part
          switch (part) {
            case 'CommandOrControl':
            case 'Command':
              display = '⌘'
              break
            case 'Control':
              display = '⌃'
              break
            case 'Shift':
              display = '⇧'
              break
            case 'Alt':
            case 'Option':
              display = '⌥'
              break
            case 'Up':
              display = '↑'
              break
            case 'Down':
              display = '↓'
              break
            case 'Left':
              display = '←'
              break
            case 'Right':
              display = '→'
              break
            case 'Space':
              display = '␣'
              break
          }
          return (
            <span key={index} style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '24px',
                  height: '24px',
                  padding: '0 6px',
                  background: 'rgba(128,128,128,0.2)',
                  borderRadius: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {display}
              </span>
              {index < parts.length - 1 && (
                <span style={{ margin: '0 4px', opacity: 0.5, fontSize: '14px' }}>+</span>
              )}
            </span>
          )
        })}
      </div>
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()

    if (e.key === 'Escape') {
      setRecording(false)
      return
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      onChange('')
      setRecording(false)
      return
    }

    const modifiers = []
    if (e.metaKey || e.ctrlKey) modifiers.push('CommandOrControl')
    if (e.altKey) modifiers.push('Alt')
    if (e.shiftKey) modifiers.push('Shift')

    // Don't record if only a modifier is pressed
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      return
    }

    let key = e.key.toUpperCase()
    if (key === ' ') key = 'Space'
    // Map arrows and other special keys
    if (key === 'ARROWUP') key = 'Up'
    if (key === 'ARROWDOWN') key = 'Down'
    if (key === 'ARROWLEFT') key = 'Left'
    if (key === 'ARROWRIGHT') key = 'Right'

    const shortcut = [...modifiers, key].join('+')
    onChange(shortcut)
    setRecording(false)
  }

  return (
    <button
      className="shortcut-input-btn"
      onClick={(e) => {
        setRecording(true)
        e.currentTarget.focus()
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => setRecording(false)}
      style={{
        padding: '8px 12px',
        background: recording ? 'rgba(138, 180, 248, 0.2)' : 'rgba(128,128,128,0.1)',
        border: recording ? '1px solid #8ab4f8' : '1px solid rgba(128,128,128,0.2)',
        borderRadius: '6px',
        cursor: 'pointer',
        minWidth: '220px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'inherit',
        fontFamily: 'inherit',
        fontSize: '13px',
      }}
    >
      {recording ? 'Recording... (Press Esc to cancel)' : renderShortcutDisplay(value)}
    </button>
  )
}
