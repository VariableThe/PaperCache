import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
      getApiKeyStatus: vi.fn().mockResolvedValue(false),
      setApiKey: vi.fn().mockResolvedValue(true),
    } as any // eslint-disable-line @typescript-eslint/no-explicit-any
  })

  it('renders settings headers correctly', () => {
    render(<Settings />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('AI Configuration')).toBeInTheDocument()
    expect(screen.getByText('Global Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
  })

  it('loads API key status from IPC', async () => {
    ;(window.electronAPI.getApiKeyStatus as any).mockResolvedValue(true)
    render(<Settings />)

    await waitFor(() => expect(screen.getByText('API Key ✅ (Set)')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Enter new key to replace existing')).toBeInTheDocument()
  })

  it('updates state when inputs change', () => {
    render(<Settings />)

    const apiKeyInput = screen.getByPlaceholderText('sk-...')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key' } })

    expect((apiKeyInput as HTMLInputElement).value).toBe('sk-new-key')
  })

  it('saves settings to IPC on Save Settings button click', async () => {
    render(<Settings />)

    const apiKeyInput = screen.getByPlaceholderText('sk-...')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key' } })

    const saveButton = screen.getByText('Save Settings')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(window.electronAPI.setApiKey).toHaveBeenCalledWith('sk-new-key')
      expect(window.electronAPI.closeWindow).toHaveBeenCalled()
    })
  })

  it('calls quitApp when Quit PaperCache is clicked', () => {
    render(<Settings />)

    const quitButton = screen.getByText('Quit')
    fireEvent.click(quitButton)

    expect(window.electronAPI.quitApp).toHaveBeenCalled()
  })
})
