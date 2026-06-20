import '@testing-library/jest-dom'

// Mock matchMedia which is not present in jsdom but might be needed by some UI components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock electronAPI for testing environments
if (!window.electronAPI) {
  window.electronAPI = {
    getNotes: async () => [],
    saveNote: async () => true,
    deleteNote: async () => true,
    renameNote: async () => true,
    openSettings: () => {},
    closeWindow: () => {},
    quitApp: () => {},
    onPowerSuspend: () => () => {},
    onPowerResume: () => () => {},
    setLaunchAtStartup: () => {},
    updateGlobalShortcut: () => {},
    readNote: async () => '',
    exportNote: async () => true,
    openExternal: () => {},
    openFile: () => {},
    safeStorageEncrypt: async (val: string) => val,
    safeStorageDecrypt: async (val: string) => val,
  } as unknown as typeof window.electronAPI
}
