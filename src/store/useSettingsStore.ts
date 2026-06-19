import { create } from 'zustand'

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
  themePreset: localStorage.getItem('papercache-theme-preset') || 'grid-light',
  fontFamily: localStorage.getItem('papercache-font') || 'monospace',
  showRulings: localStorage.getItem('papercache-rulings') !== 'false',
  bgType: (localStorage.getItem('papercache-bg-type') as 'color' | 'image') || 'color',
  bgColor: localStorage.getItem('papercache-bg-color') || '#ffffff',
  bgImage: localStorage.getItem('papercache-bg-image') || '',
  textColor: localStorage.getItem('papercache-text-color') || '#000000',
  numColor: localStorage.getItem('papercache-num-color') || '#0000ff',
  symColor: localStorage.getItem('papercache-sym-color') || '#ff0000',
  aiColor: localStorage.getItem('papercache-ai-color') || '#8b5cf6',
  mathColor: localStorage.getItem('papercache-math-color') || '#10b981',

  setThemePreset: (themePreset) => {
    localStorage.setItem('papercache-theme-preset', themePreset)
    set({ themePreset })
  },
  setFontFamily: (fontFamily) => {
    localStorage.setItem('papercache-font', fontFamily)
    set({ fontFamily })
  },
  setShowRulings: (showRulings) => {
    localStorage.setItem('papercache-rulings', String(showRulings))
    set({ showRulings })
  },
  setBgType: (bgType) => {
    localStorage.setItem('papercache-bg-type', bgType)
    set({ bgType })
  },
  setBgColor: (bgColor) => {
    localStorage.setItem('papercache-bg-color', bgColor)
    set({ bgColor })
  },
  setBgImage: (bgImage) => {
    localStorage.setItem('papercache-bg-image', bgImage)
    set({ bgImage })
  },
  setTextColor: (textColor) => {
    localStorage.setItem('papercache-text-color', textColor)
    set({ textColor })
  },
  setNumColor: (numColor) => {
    localStorage.setItem('papercache-num-color', numColor)
    set({ numColor })
  },
  setSymColor: (symColor) => {
    localStorage.setItem('papercache-sym-color', symColor)
    set({ symColor })
  },
  setAiColor: (aiColor) => {
    localStorage.setItem('papercache-ai-color', aiColor)
    set({ aiColor })
  },
  setMathColor: (mathColor) => {
    localStorage.setItem('papercache-math-color', mathColor)
    set({ mathColor })
  },
}))
