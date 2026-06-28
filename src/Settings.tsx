import { useState, useEffect } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { SETTINGS_KEYS, getShortcut } from './lib/settingsKeys'
import { useAppStore } from './store/useAppStore'
import { useSettingsStore } from './store/useSettingsStore'
import { ShortcutInput } from './components/ShortcutInput'
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
  const isHyprland = useAppStore((state) => state.isHyprland)
  const defaultMod = isHyprland ? 'Alt' : 'CommandOrControl'

  const [shortcutNewNote, setShortcutNewNote] = useState(
    getShortcut(SETTINGS_KEYS.SHORTCUT_NEWNOTE, `${defaultMod}+Shift+N`)
  )
  const [shortcutToggle, setShortcutToggle] = useState(
    getShortcut(SETTINGS_KEYS.SHORTCUT_TOGGLE, `${defaultMod}+Shift+C`)
  )

  // Startup
  const [launchAtStartup, setLaunchAtStartup] = useState(
    localStorage.getItem(SETTINGS_KEYS.LAUNCH_STARTUP) === 'true'
  )

  // Sync launch-at-startup toggle with actual OS state on mount
  useEffect(() => {
    window.electronAPI.getLaunchAtStartup().then((enabled) => {
      setLaunchAtStartup(enabled)
      localStorage.setItem(SETTINGS_KEYS.LAUNCH_STARTUP, enabled.toString())
    })
  }, [])

  const [appVersion, setAppVersion] = useState('0.5.6')
  useEffect(() => {
    getVersion()
      .then((ver) => setAppVersion(ver))
      .catch(() => {})
  }, [])

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

    if (apiKey.trim()) {
      try {
        const success = await window.electronAPI.setApiKey(apiKey.trim())
        if (success) {
          setIsApiKeySet(true)
        } else {
          alert('Failed to save API key securely. Check console.')
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to save API key:', err)
        alert(`Failed to save API key securely: ${err}`)
      }
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
    const oldShortcut = getShortcut(SETTINGS_KEYS.SHORTCUT_NEWNOTE, `${defaultMod}+Shift+N`)
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('new-note', oldShortcut, shortcutNewNote)
    }
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_NEWNOTE, shortcutNewNote)

    const oldToggleShortcut = getShortcut(SETTINGS_KEYS.SHORTCUT_TOGGLE, `${defaultMod}+Shift+C`)
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut('toggle', oldToggleShortcut, shortcutToggle)
    }
    localStorage.setItem(SETTINGS_KEYS.SHORTCUT_TOGGLE, shortcutToggle)

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
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isApiKeySet ? 'Enter new key to replace existing' : 'sk-...'}
                style={{ flex: 1 }}
              />
              {isApiKeySet && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await window.electronAPI.setApiKey('')
                      setIsApiKeySet(false)
                      setApiKey('')
                    } catch (err) {
                      // eslint-disable-next-line no-console
                      console.error('Failed to clear key:', err)
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                >
                  Clear Key
                </button>
              )}
            </div>
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
          <div className="setting-group color-row">
            <label>Toggle App Visibility</label>
            <ShortcutInput value={shortcutToggle} onChange={setShortcutToggle} />
          </div>
          <div className="setting-group color-row">
            <label>New Note (Global)</label>
            <ShortcutInput value={shortcutNewNote} onChange={setShortcutNewNote} />
          </div>
          <div className="setting-group" style={{ marginTop: '16px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => useAppStore.getState().setShowKeybindsModal(true)}
              style={{
                padding: '8px 16px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid #3b82f6',
                borderRadius: '6px',
                color: '#3b82f6',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '13px',
                width: '100%',
              }}
            >
              ⌨️ Open Keybinds Settings Panel
            </button>
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
            <label>Submit a Bug Report</label>
            <button
              onClick={() =>
                window.electronAPI.openExternal(
                  'https://github.com/VariableThe/PaperCache/issues/new'
                )
              }
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
              Report Issue on GitHub 🐞
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

        <section>
          <h3>About</h3>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <img
              src="/icon.png"
              alt="PaperCache Logo"
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 12px',
                display: 'block',
                borderRadius: '12px',
              }}
            />
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>PaperCache</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
              Version {appVersion}
            </div>
            <p
              style={{
                fontSize: '13px',
                color: '#ccc',
                lineHeight: '1.5',
                maxWidth: '400px',
                margin: '0 auto 20px',
              }}
            >
              Thank you for using PaperCache! We hope it helps organize your thoughts and boost your
              daily productivity.
            </p>
            <div
              style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}
            >
              <button
                onClick={() => window.electronAPI.checkForUpdates()}
                style={{
                  padding: '6px 14px',
                  background: 'rgba(128,128,128,0.1)',
                  border: '1px solid rgba(128,128,128,0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                Check for Updates
              </button>
              <button
                onClick={() => window.electronAPI.openExternal('https://ko-fi.com/thevariable')}
                style={{
                  padding: '6px 14px',
                  background: 'rgba(255,94,91,0.15)',
                  border: '1px solid rgba(255,94,91,0.3)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#ff5e5b',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                }}
              >
                Support on Ko-fi ☕
              </button>
            </div>
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
