const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.invoke('close-window'),
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNote: (id: string, content: string) => {
    if (typeof id !== 'string' || typeof content !== 'string') throw new Error('Invalid arguments');
    return ipcRenderer.invoke('save-note', { id, content })
  },
  deleteNote: (id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid argument');
    return ipcRenderer.invoke('delete-note', id)
  },
  renameNote: (oldId: string, newId: string) => {
    if (typeof oldId !== 'string' || typeof newId !== 'string') throw new Error('Invalid arguments');
    return ipcRenderer.invoke('rename-note', { oldId, newId })
  },
  openAIChat: (args: { model: string, messages: { role: string; content: string }[], baseURL: string }) => {
    if (!args || typeof args !== 'object' || typeof args.model !== 'string' || typeof args.baseURL !== 'string' || !Array.isArray(args.messages)) {
      throw new Error('Invalid arguments for openAIChat')
    }
    return ipcRenderer.invoke('openai-chat', args)
  },
  setApiKey: (key: string) => {
    if (typeof key !== 'string') throw new Error('Invalid argument');
    return ipcRenderer.invoke('set-api-key', key)
  },
  getApiKeyStatus: () => ipcRenderer.invoke('get-api-key-status'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  readNote: (id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid argument');
    return ipcRenderer.invoke('read-note', id)
  },
  exportNote: (filename: string, content: string) => {
    if (typeof filename !== 'string' || typeof content !== 'string') throw new Error('Invalid arguments');
    return ipcRenderer.invoke('export-note', filename, content)
  },
  quitApp: () => ipcRenderer.send('quit-app'),
  openExternal: (url: string) => {
    if (typeof url !== 'string') throw new Error('Invalid argument');
    ipcRenderer.send('open-external', url)
  },
  openFile: (path: string) => {
    if (typeof path !== 'string') throw new Error('Invalid argument');
    ipcRenderer.send('open-file', path)
  },
  onSwipeGesture: (callback: (direction: string) => void) => {
    const handler = (_event: any, direction: string) => callback(direction)
    ipcRenderer.on('swipe-gesture', handler)
    return () => ipcRenderer.removeListener('swipe-gesture', handler)
  },
  setLaunchAtStartup: (value: boolean) => ipcRenderer.send('set-launch-startup', value),
  updateGlobalShortcut: (action: string, oldShortcut: string, newShortcut: string) =>
    ipcRenderer.send('update-global-shortcut', { action, oldShortcut, newShortcut }),
  onTriggerNewNote: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('trigger-new-note', handler)
    return () => ipcRenderer.removeListener('trigger-new-note', handler)
  },
  onTriggerTasks: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('trigger-tasks', handler)
    return () => ipcRenderer.removeListener('trigger-tasks', handler)
  },
  safeStorageEncrypt: (val: string) => {
    if (typeof val !== 'string') throw new Error('Invalid argument');
    return ipcRenderer.invoke('safe-storage-encrypt', val)
  },
  safeStorageDecrypt: (val: string) => {
    if (typeof val !== 'string') throw new Error('Invalid argument');
    return ipcRenderer.invoke('safe-storage-decrypt', val)
  },
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
  pauseShortcuts: () => ipcRenderer.send('pause-shortcuts'),
  resumeShortcuts: () => ipcRenderer.send('resume-shortcuts'),
})
