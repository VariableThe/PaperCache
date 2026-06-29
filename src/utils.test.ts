import { describe, it, expect, beforeEach } from 'vitest'
import { getFolderColor } from './utils'

describe('utils', () => {
  describe('getFolderColor', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear()
    })

    it('returns default color for empty string', () => {
      expect(getFolderColor('')).toBe('#ffffff')
    })

    it('generates a deterministic color based on string hash', () => {
      const color1 = getFolderColor('docs')
      const color2 = getFolderColor('projects')

      expect(color1).toMatch(/hsl\(\d+, 70%, 60%\)/)
      expect(color2).toMatch(/hsl\(\d+, 70%, 60%\)/)
      expect(color1).not.toBe(color2)
    })

    it('saves generated color to localStorage', () => {
      getFolderColor('testFolder')
      const stored = JSON.parse(localStorage.getItem('papercache-folder-colors') || '{}')
      expect(stored['testFolder']).toBeDefined()
    })

    it('returns the same color for the same folder string', () => {
      const firstCall = getFolderColor('test')
      const secondCall = getFolderColor('test')
      expect(firstCall).toBe(secondCall)
    })

    it('distributes hues to maximize distance between colors', () => {
      const color1 = getFolderColor('f1')
      const color2 = getFolderColor('f2')

      const hue1 = parseInt(color1.match(/hsl\((\d+)/)![1]!)
      const hue2 = parseInt(color2.match(/hsl\((\d+)/)![1]!)

      expect(hue1).not.toBe(hue2)

      const color3 = getFolderColor('f3')
      const hue3 = parseInt(color3.match(/hsl\((\d+)/)![1]!)
      expect(hue3).not.toBe(hue1)
      expect(hue3).not.toBe(hue2)
    })
  })
})
