import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Settings from './Settings'

describe('Settings Component', () => {
  beforeEach(() => {
    localStorage.clear()
    // Mock the electronAPI
    window.electronAPI = {
      ...window.electronAPI,
      setLaunchAtStartup: vi.fn(),
      updateGlobalShortcut: vi.fn(),
      closeWindow: vi.fn(),
      quitApp: vi.fn(),
    } as any
  })

  it('renders settings headers correctly', () => {
    render(<Settings />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('AI Configuration')).toBeInTheDocument()
    expect(screen.getByText('Global Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
  })

  it('loads initial state from localStorage', () => {
    localStorage.setItem('papercache-apikey', 'sk-test-key')
    render(<Settings />)

    const apiKeyInput = screen.getByPlaceholderText('sk-...') as HTMLInputElement
    expect(apiKeyInput.value).toBe('sk-test-key')
  })

  it('updates state when inputs change', () => {
    render(<Settings />)

    const apiKeyInput = screen.getByPlaceholderText('sk-...')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key' } })

    expect((apiKeyInput as HTMLInputElement).value).toBe('sk-new-key')
  })

  it('saves settings to localStorage on Save Settings button click', () => {
    render(<Settings />)

    const apiKeyInput = screen.getByPlaceholderText('sk-...')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key' } })

    const saveButton = screen.getByText('Save Settings')
    fireEvent.click(saveButton)

    expect(localStorage.getItem('papercache-apikey')).toBe('sk-new-key')
    expect(window.electronAPI.closeWindow).toHaveBeenCalled()
  })

  it('calls quitApp when Quit PaperCache is clicked', () => {
    render(<Settings />)

    const quitButton = screen.getByText('Quit PaperCache')
    fireEvent.click(quitButton)

    expect(window.electronAPI.quitApp).toHaveBeenCalled()
  })
})
