export interface ElectronAPI {
  closeWindow: () => Promise<void>
  getNotes: () => Promise<import('./store/useAppStore').Note[]>
  saveNote: (id: string, content: string) => Promise<boolean>
  deleteNote: (id: string) => Promise<boolean>
  renameNote: (oldId: string, newId: string) => Promise<boolean>
  openAIChat: (args: {
    model: string
    messages: { role: string; content: string }[]
    apiKey: string
    baseURL: string
  }) => Promise<unknown>
  readNote: (id: string) => Promise<string>
  exportNote: (filename: string, content: string) => Promise<boolean>
  openSettings: () => void
  quitApp: () => void
  openExternal: (url: string) => void
  openFile: (path: string) => void
  onSwipeGesture: (callback: (direction: string) => void) => () => void
  setLaunchAtStartup: (value: boolean) => void
  updateGlobalShortcut: (action: string, oldShortcut: string, newShortcut: string) => void
  onTriggerNewNote: (callback: () => void) => () => void
  onTriggerTasks: (callback: () => void) => () => void
  safeStorageEncrypt: (val: string) => Promise<string>
  safeStorageDecrypt: (val: string) => Promise<string>
  onPowerSuspend: (callback: () => void) => () => void
  onPowerResume: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
