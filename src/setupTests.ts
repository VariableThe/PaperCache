import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'
import type { ElectronAPI } from './types'

// Mock matchMedia which is not present in jsdom but might be needed by some components
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

// Mock electronAPI for testing environments
if (typeof window !== 'undefined') {
  window.electronAPI = {
    closeWindow: vi.fn(),
    getNotes: vi.fn().mockResolvedValue([]),
    saveNote: vi.fn().mockResolvedValue(true),
    deleteNote: vi.fn().mockResolvedValue(true),
    renameNote: vi.fn().mockResolvedValue(true),
    openAIChat: vi.fn().mockResolvedValue(''),
    setApiKey: vi.fn().mockResolvedValue(true),
    getApiKeyStatus: vi.fn().mockResolvedValue(true),
    checkForUpdates: vi.fn(),
    readNote: vi.fn().mockResolvedValue(''),
    exportNote: vi.fn().mockResolvedValue(true),
    setDialogOpen: vi.fn().mockResolvedValue(undefined),
    quitApp: vi.fn(),
    openExternal: vi.fn(),
    openFile: vi.fn(),
    onSwipeGesture: vi.fn().mockReturnValue(() => {}),
    setLaunchAtStartup: vi.fn(),
    updateGlobalShortcut: vi.fn(),
    onTriggerNewNote: vi.fn().mockReturnValue(() => {}),
    onTriggerTasks: vi.fn().mockReturnValue(() => {}),
    safeStorageEncrypt: vi.fn((val) => Promise.resolve(val)),
    safeStorageDecrypt: vi.fn((val) => Promise.resolve(val)),
    onPowerSuspend: vi.fn().mockReturnValue(() => {}),
    onPowerResume: vi.fn().mockReturnValue(() => {}),
    pauseShortcuts: vi.fn(),
    resumeShortcuts: vi.fn(),
  } as ElectronAPI
}

afterEach(() => {
  vi.clearAllMocks()
})
