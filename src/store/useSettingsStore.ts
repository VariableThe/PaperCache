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

  setSettings: (
    settings:
      | Partial<Omit<SettingsState, 'setSettings'>>
      | ((state: SettingsState) => Partial<Omit<SettingsState, 'setSettings'>>)
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
