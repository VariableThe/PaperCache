export interface ReminderPayload {
  key: string
  label: string
  dueAt: number
}

export interface ElectronAPI {
  closeWindow: () => Promise<void>
  getNotes: () => Promise<import('./store/useAppStore').Note[]>
  saveNote: (id: string, content: string) => Promise<boolean>
  deleteNote: (id: string) => Promise<boolean>
  renameNote: (oldId: string, newId: string) => Promise<boolean>
  openAIChat: (args: {
    model: string
    messages: { role: string; content: string }[]
    baseUrl: string
  }) => Promise<unknown>
  setApiKey: (key: string) => Promise<boolean>
  getApiKeyStatus: () => Promise<boolean>
  checkForUpdates: () => Promise<void>
  restoreWindowState: () => Promise<void>
  isHyprland: () => Promise<boolean>
  readNote: (id: string) => Promise<string>
  exportNote: (filename: string, content: string) => Promise<boolean>
  setDialogOpen: (open: boolean) => Promise<void>
  scheduleReminders: (reminders: ReminderPayload[]) => Promise<void>
  cancelReminders: () => Promise<void>
  scheduleTimer: (id: string, durationMs: number, label: string) => Promise<void>
  cancelTimer: (id: string) => Promise<void>

  removeOnboardingFiles: () => Promise<void>
  quitApp: () => Promise<void>
  openExternal: (url: string) => Promise<void>
  openFile: (path: string) => Promise<void>
  onSwipeGesture: (callback: (direction: string) => void) => () => void
  getLaunchAtStartup: () => Promise<boolean>
  setLaunchAtStartup: (value: boolean) => Promise<void>
  updateGlobalShortcut: (action: string, oldShortcut: string, newShortcut: string) => void
  onTriggerNewNote: (callback: () => void) => () => void
  onTriggerTasks: (callback: () => void) => () => void
  safeStorageEncrypt: (val: string) => Promise<string>
  safeStorageDecrypt: (val: string) => Promise<string>
  onPowerSuspend: (callback: () => void) => () => void
  onPowerResume: (callback: () => void) => () => void
  pauseShortcuts: () => void
  resumeShortcuts: () => void
  onUpdateReady: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
