import '@testing-library/jest-dom'
import { vi } from 'vitest'

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
if (typeof window !== 'undefined' && !window.electronAPI) {
  window.electronAPI = {
    getPlatform: () => 'darwin',
    openExternal: vi.fn(),
    saveNote: vi.fn(),
    deleteNote: vi.fn(),
    renameNote: vi.fn(),
    openAIChat: vi.fn(),
    readNote: vi.fn().mockResolvedValue(''),
    exportNote: vi.fn(),
    openSettings: vi.fn(),
    safeStorageEncrypt: vi.fn((val) => Promise.resolve(val)),
    safeStorageDecrypt: vi.fn((val) => Promise.resolve(val)),
    getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
    openDevTools: vi.fn(),
    onReminderFired: vi.fn(),
    onUpdateGlobalShortcut: vi.fn(),
    onPowerSuspend: vi.fn().mockReturnValue(() => {}),
    onPowerResume: vi.fn().mockReturnValue(() => {}),
    removeListener: vi.fn(),
  } as unknown as typeof window.electronAPI
}
