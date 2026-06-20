const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.invoke('close-window'),
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNote: (id: string, content: string) => ipcRenderer.invoke('save-note', { id, content }),
  deleteNote: (id: string) => ipcRenderer.invoke('delete-note', id),
  renameNote: (oldId: string, newId: string) => ipcRenderer.invoke('rename-note', { oldId, newId }),
  openAIChat: (args: { model: string, messages: { role: string; content: string }[], apiKey: string, baseURL: string }) => ipcRenderer.invoke('openai-chat', args),
  readNote: (id: string) => ipcRenderer.invoke('read-note', id),
  exportNote: (filename: string, content: string) =>
    ipcRenderer.invoke('export-note', filename, content),
  openSettings: () => ipcRenderer.send('open-settings'),
  quitApp: () => ipcRenderer.send('quit-app'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  openFile: (path: string) => ipcRenderer.send('open-file', path),
  onSwipeGesture: (callback: (direction: string) => void) => {
    ipcRenderer.on('swipe-gesture', (_event, direction) => callback(direction))
  },
  setLaunchAtStartup: (value: boolean) => ipcRenderer.send('set-launch-startup', value),
  updateGlobalShortcut: (action: string, oldShortcut: string, newShortcut: string) =>
    ipcRenderer.send('update-global-shortcut', { action, oldShortcut, newShortcut }),
  onTriggerNewNote: (callback: () => void) => {
    ipcRenderer.on('trigger-new-note', () => callback())
  },
  onTriggerTasks: (callback: () => void) => {
    ipcRenderer.on('trigger-tasks', () => callback())
  },
  safeStorageEncrypt: (val: string) => ipcRenderer.invoke('safe-storage-encrypt', val),
  safeStorageDecrypt: (val: string) => ipcRenderer.invoke('safe-storage-decrypt', val),
  onPowerSuspend: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('power:suspend', handler)
    return () => ipcRenderer.removeListener('power:suspend', handler)
  },
  onPowerResume: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('power:resume', handler)
    return () => ipcRenderer.removeListener('power:resume', handler)
  },
})
