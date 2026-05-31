import { useState } from 'react'
import './Settings.css'

export default function Settings() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('papercache-apikey') || '')
  const [apiBaseUrl, setApiBaseUrl] = useState(localStorage.getItem('papercache-baseurl') || 'https://api.openai.com/v1')
  const [apiModel, setApiModel] = useState(localStorage.getItem('papercache-model') || 'gpt-4o')
  const [aiSystemPrompt, setAiSystemPrompt] = useState(localStorage.getItem('papercache-system-prompt') || 'Please provide a short and concise answer.')

  // Shortcuts
  const [globalShortcutNewNote, setGlobalShortcutNewNote] = useState(localStorage.getItem('papercache-shortcut-newnote') || 'CommandOrControl+Shift+N')

  // Appearance State
  const [fontFamily, setFontFamily] = useState(localStorage.getItem('papercache-font') || "'JetBrains Mono', monospace")
  const [showRulings, setShowRulings] = useState(localStorage.getItem('papercache-show-rulings') === 'true')
  const [themePreset, setThemePreset] = useState(localStorage.getItem('papercache-theme') || 'paper-light')
  const [bgType, setBgType] = useState(localStorage.getItem('papercache-bg-type') || 'preset') // preset, color, image
  const [bgColor, setBgColor] = useState(localStorage.getItem('papercache-bg-color') || '#ffffff')
  const [bgImage, setBgImage] = useState(localStorage.getItem('papercache-bg-image') || '')
  
  const [textColor, setTextColor] = useState(localStorage.getItem('papercache-color-text') || '#333333')
  const [numColor, setNumColor] = useState(localStorage.getItem('papercache-color-num') || '#007acc')
  const [symColor, setSymColor] = useState(localStorage.getItem('papercache-color-sym') || '#c586c0')
  const [aiColor, setAiColor] = useState(localStorage.getItem('papercache-color-ai') || '#10b981')
  const [mathColor, setMathColor] = useState(localStorage.getItem('papercache-color-math') || '#f59e0b')

  const saveSettings = () => {
    localStorage.setItem('papercache-apikey', apiKey)
    localStorage.setItem('papercache-baseurl', apiBaseUrl)
    localStorage.setItem('papercache-model', apiModel)
    localStorage.setItem('papercache-system-prompt', aiSystemPrompt)
    
    localStorage.setItem('papercache-font', fontFamily)
    localStorage.setItem('papercache-show-rulings', showRulings.toString())
    localStorage.setItem('papercache-theme', themePreset)
    localStorage.setItem('papercache-bg-type', bgType)
    localStorage.setItem('papercache-bg-color', bgColor)
    localStorage.setItem('papercache-bg-image', bgImage)
    
    localStorage.setItem('papercache-color-text', textColor)
    localStorage.setItem('papercache-color-num', numColor)
    localStorage.setItem('papercache-color-sym', symColor)
    localStorage.setItem('papercache-color-ai', aiColor)
    localStorage.setItem('papercache-color-math', mathColor)
    
    // Shortcuts
    const oldShortcut = localStorage.getItem('papercache-shortcut-newnote') || 'CommandOrControl+Shift+N'
    localStorage.setItem('papercache-shortcut-newnote', globalShortcutNewNote)
    if (window.electronAPI.updateGlobalShortcut) {
      window.electronAPI.updateGlobalShortcut(oldShortcut, globalShortcutNewNote)
    }
    
    // Dispatch storage event manually for the same window to pick it up immediately
    window.dispatchEvent(new Event('storage'))

    window.electronAPI.closeWindow() // actually closes settings window
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
            <label>API Key</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              placeholder="sk-..."
            />
          </div>

          <div className="setting-group">
            <label>API Base URL</label>
            <input 
              type="text" 
              value={apiBaseUrl} 
              onChange={e => setApiBaseUrl(e.target.value)} 
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div className="setting-group">
            <label>Model Name</label>
            <input 
              type="text" 
              value={apiModel} 
              onChange={e => setApiModel(e.target.value)} 
              placeholder="gpt-4o"
            />
          </div>

          <div className="setting-group">
            <label>System Prompt (Instructions)</label>
            <textarea 
              value={aiSystemPrompt} 
              onChange={e => setAiSystemPrompt(e.target.value)} 
              placeholder="e.g. Please provide a short and concise answer."
              rows={3}
              style={{ width: '100%', padding: '8px', background: 'rgba(128,128,128,0.1)', border: '1px solid rgba(128,128,128,0.2)', color: 'inherit', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", resize: 'vertical', textAlign: 'center' }}
            />
          </div>
        </section>

        <section>
          <h3>Global Shortcuts</h3>
          <div className="setting-group">
            <label>New Note (Global)</label>
            <input 
              type="text" 
              value={globalShortcutNewNote} 
              onChange={e => setGlobalShortcutNewNote(e.target.value)} 
              placeholder="e.g. CommandOrControl+Shift+N"
            />
          </div>
        </section>

        <section>
          <h3>Appearance</h3>
          <div className="setting-group">
            <label>Font Family</label>
            <select value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
              <option value="'JetBrains Mono', monospace">JetBrains Mono (Default)</option>
              <option value="Menlo, Monaco, 'Courier New', monospace">Monospace</option>
              <option value="Inter, system-ui, -apple-system, sans-serif">Sans-serif (Modern)</option>
              <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">System Default</option>
              <option value="Georgia, Cambria, 'Times New Roman', Times, serif">Serif (Classic)</option>
            </select>
          </div>

          <div className="setting-group">
            <label>Show Ruled Lines (Grid)</label>
            <input 
              type="checkbox" 
              checked={showRulings} 
              onChange={e => setShowRulings(e.target.checked)} 
              style={{ width: 'auto', marginRight: 'auto' }}
            />
          </div>

          <div className="setting-group">
            <label>Background Type</label>
            <select value={bgType} onChange={e => setBgType(e.target.value)}>
              <option value="preset">Preset Theme</option>
              <option value="color">Solid Color</option>
              <option value="image">Custom Image URL</option>
            </select>
          </div>

          {bgType === 'preset' && (
            <div className="setting-group">
              <label>Theme Preset</label>
              <select value={themePreset} onChange={e => setThemePreset(e.target.value)}>
                <option value="paper-light">Paper Light</option>
                <option value="grid-dark">Grid Dark</option>
                <option value="blueprint">Blueprint</option>
              </select>
            </div>
          )}

          {bgType === 'color' && (
            <div className="setting-group color-row">
              <label>Background Color</label>
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} />
            </div>
          )}

          {bgType === 'image' && (
            <div className="setting-group">
              <label>Background Image URL</label>
              <input type="text" value={bgImage} onChange={e => setBgImage(e.target.value)} placeholder="https://..." />
            </div>
          )}

          <div className="setting-group color-row">
            <label>Main Text</label>
            <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} />
          </div>
          
          <div className="setting-group color-row">
            <label>Numbers</label>
            <input type="color" value={numColor} onChange={e => setNumColor(e.target.value)} />
          </div>

          <div className="setting-group color-row">
            <label>Math Symbols</label>
            <input type="color" value={symColor} onChange={e => setSymColor(e.target.value)} />
          </div>

          <div className="setting-group color-row">
            <label>Math Results (Autofill)</label>
            <input type="color" value={mathColor} onChange={e => setMathColor(e.target.value)} />
          </div>

          <div className="setting-group color-row">
            <label>AI Response Text</label>
            <input type="color" value={aiColor} onChange={e => setAiColor(e.target.value)} />
          </div>
        </section>

        <button className="save-btn" onClick={saveSettings}>Save Settings</button>
      </div>

      <div className="settings-footer">
        <button className="quit-btn" onClick={quitApp}>Quit PaperCache</button>
      </div>
    </div>
  )
}
