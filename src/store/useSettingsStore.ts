import { create } from 'zustand'
import { SETTINGS_KEYS } from '../lib/settingsKeys'
export interface SettingsState {
  themePreset: string
  fontFamily: string
  showRulings: boolean
  bgType: 'color' | 'image'
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
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themePreset: localStorage.getItem(SETTINGS_KEYS.THEME_PRESET) || 'grid-light',
  fontFamily: localStorage.getItem(SETTINGS_KEYS.FONT_FAMILY) || "'JetBrains Mono', monospace",
  showRulings: localStorage.getItem(SETTINGS_KEYS.SHOW_RULINGS) !== 'false',
  bgType: (localStorage.getItem(SETTINGS_KEYS.BG_TYPE) as 'color' | 'image') || 'color',
  bgColor: localStorage.getItem(SETTINGS_KEYS.BG_COLOR) || '#ffffff',
  bgImage: localStorage.getItem(SETTINGS_KEYS.BG_IMAGE) || '',
  textColor: localStorage.getItem(SETTINGS_KEYS.TEXT_COLOR) || '#000000',
  numColor: localStorage.getItem(SETTINGS_KEYS.NUM_COLOR) || '#8ab4f8',
  symColor: localStorage.getItem(SETTINGS_KEYS.SYM_COLOR) || '#ff0000',
  aiColor: localStorage.getItem(SETTINGS_KEYS.AI_COLOR) || '#8b5cf6',
  mathColor: localStorage.getItem(SETTINGS_KEYS.MATH_COLOR) || '#10b981',

  setThemePreset: (themePreset) => {
    localStorage.setItem(SETTINGS_KEYS.THEME_PRESET, themePreset)
    set({ themePreset })
  },
  setFontFamily: (fontFamily) => {
    localStorage.setItem(SETTINGS_KEYS.FONT_FAMILY, fontFamily)
    set({ fontFamily })
  },
  setShowRulings: (showRulings) => {
    localStorage.setItem(SETTINGS_KEYS.SHOW_RULINGS, String(showRulings))
    set({ showRulings })
  },
  setBgType: (bgType) => {
    localStorage.setItem(SETTINGS_KEYS.BG_TYPE, bgType)
    set({ bgType })
  },
  setBgColor: (bgColor) => {
    localStorage.setItem(SETTINGS_KEYS.BG_COLOR, bgColor)
    set({ bgColor })
  },
  setBgImage: (bgImage) => {
    localStorage.setItem(SETTINGS_KEYS.BG_IMAGE, bgImage)
    set({ bgImage })
  },
  setTextColor: (textColor) => {
    localStorage.setItem(SETTINGS_KEYS.TEXT_COLOR, textColor)
    set({ textColor })
  },
  setNumColor: (numColor) => {
    localStorage.setItem(SETTINGS_KEYS.NUM_COLOR, numColor)
    set({ numColor })
  },
  setSymColor: (symColor) => {
    localStorage.setItem(SETTINGS_KEYS.SYM_COLOR, symColor)
    set({ symColor })
  },
  setAiColor: (aiColor) => {
    localStorage.setItem(SETTINGS_KEYS.AI_COLOR, aiColor)
    set({ aiColor })
  },
  setMathColor: (mathColor) => {
    localStorage.setItem(SETTINGS_KEYS.MATH_COLOR, mathColor)
    set({ mathColor })
  },
}))
