import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SettingsState {
  themePreset: string
  fontFamily: string
  showRulings: boolean
  bgType: 'preset' | 'color' | 'image'
  bgColor: string
  bgImage: string
  textColor: string
  numColor: string
  symColor: string
  aiColor: string
  mathColor: string

  setThemePreset: (preset: string) => void
  setFontFamily: (font: string) => void
  setShowRulings: (show: boolean) => void
  setBgType: (type: 'color' | 'image') => void
  setBgColor: (color: string) => void
  setBgImage: (image: string) => void
  setTextColor: (color: string) => void
  setNumColor: (color: string) => void
  setSymColor: (color: string) => void
  setAiColor: (color: string) => void
  setMathColor: (color: string) => void
  setSettings: (
    settings:
      | Partial<
          Omit<
            SettingsState,
            | 'setSettings'
            | 'setThemePreset'
            | 'setFontFamily'
            | 'setShowRulings'
            | 'setBgType'
            | 'setBgColor'
            | 'setBgImage'
            | 'setTextColor'
            | 'setNumColor'
            | 'setSymColor'
            | 'setAiColor'
            | 'setMathColor'
          >
        >
      | ((
          state: SettingsState
        ) => Partial<
          Omit<
            SettingsState,
            | 'setSettings'
            | 'setThemePreset'
            | 'setFontFamily'
            | 'setShowRulings'
            | 'setBgType'
            | 'setBgColor'
            | 'setBgImage'
            | 'setTextColor'
            | 'setNumColor'
            | 'setSymColor'
            | 'setAiColor'
            | 'setMathColor'
          >
        >)
  ) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themePreset: 'grid-light',
      fontFamily: "'JetBrains Mono', monospace",
      showRulings: true,
      bgType: 'color',
      bgColor: '#ffffff',
      bgImage: '',
      textColor: '#000000',
      numColor: '#8ab4f8',
      symColor: '#ff0000',
      aiColor: '#8b5cf6',
      mathColor: '#10b981',

      setThemePreset: (themePreset) => set({ themePreset }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setShowRulings: (showRulings) => set({ showRulings }),
      setBgType: (bgType) => set({ bgType }),
      setBgColor: (bgColor) => set({ bgColor }),
      setBgImage: (bgImage) => set({ bgImage }),
      setTextColor: (textColor) => set({ textColor }),
      setNumColor: (numColor) => set({ numColor }),
      setSymColor: (symColor) => set({ symColor }),
      setAiColor: (aiColor) => set({ aiColor }),
      setMathColor: (mathColor) => set({ mathColor }),
      setSettings: (settings) =>
        set((state) => ({
          ...state,
          ...(typeof settings === 'function' ? settings(state) : settings),
        })),
    }),
    {
      name: 'papercache-settings-store',
    }
  )
)
