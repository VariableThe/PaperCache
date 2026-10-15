import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'
import type { ElectronAPI } from './types'

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('0.5.7'),
}))

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

// Mock localStorage
const localStorageMock = (function () {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
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
    openAIChat: vi.fn().mockResolvedValue({ choices: [{ message: { content: '' } }] }),
    setApiKey: vi.fn().mockResolvedValue(true),
    getApiKeyStatus: vi.fn().mockResolvedValue(true),
    checkForUpdates: vi.fn(),
    isHyprland: vi.fn().mockResolvedValue(false),
    readNote: vi.fn().mockResolvedValue(''),
    exportNote: vi.fn().mockResolvedValue(true),
    setDialogOpen: vi.fn().mockResolvedValue(undefined),
    quitApp: vi.fn(),
    openExternal: vi.fn(),
    openFile: vi.fn(),
    setLaunchAtStartup: vi.fn(),
    updateGlobalShortcut: vi.fn(),
    onTriggerNewNote: vi.fn().mockReturnValue(() => {}),
    onTriggerTasks: vi.fn().mockReturnValue(() => {}),
    safeStorageEncrypt: vi.fn((val) => Promise.resolve(val)),
    safeStorageDecrypt: vi.fn((val) => Promise.resolve(val)),
    onPowerSuspend: vi.fn().mockReturnValue(() => {}),
    onPowerResume: vi.fn().mockReturnValue(() => {}),
    pauseShortcuts: vi.fn().mockResolvedValue(undefined),
    resumeShortcuts: vi.fn().mockResolvedValue(undefined),
    onUpdateReady: vi.fn().mockReturnValue(() => {}),
    scheduleReminders: vi.fn().mockResolvedValue(undefined),
    cancelReminders: vi.fn().mockResolvedValue(undefined),
    scheduleTimer: vi.fn().mockResolvedValue(undefined),
    cancelTimer: vi.fn().mockResolvedValue(undefined),
    restoreWindowState: vi.fn().mockResolvedValue(undefined),
    getLaunchAtStartup: vi.fn().mockResolvedValue(false),
    removeOnboardingFiles: vi.fn().mockResolvedValue(undefined),
    restartApp: vi.fn().mockResolvedValue(undefined),
    onUpdateStatus: vi.fn().mockReturnValue(() => {}),
    saveAsset: vi.fn().mockResolvedValue('/.images/test.png'),
    readAsset: vi.fn().mockResolvedValue('data:image/png;base64,'),
    openaiTranscribe: vi.fn().mockResolvedValue('test transcript'),
  } as unknown as ElectronAPI
}

afterEach(() => {
  vi.clearAllMocks()
})
