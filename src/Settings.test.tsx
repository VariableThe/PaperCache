import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import Settings from './Settings'

describe('Settings Component', () => {
  beforeEach(() => {
    localStorage.clear()
    // Mock the electronAPI
    window.electronAPI = {
      ...window.electronAPI,
      getLaunchAtStartup: vi.fn().mockResolvedValue(false),
      setLaunchAtStartup: vi.fn(),
      updateGlobalShortcut: vi.fn(),
      closeWindow: vi.fn(),
      quitApp: vi.fn(),
      getApiKeyStatus: vi.fn().mockResolvedValue(false),
      setApiKey: vi.fn().mockResolvedValue(true),
    } as any // eslint-disable-line @typescript-eslint/no-explicit-any
  })

  it('renders settings headers correctly', async () => {
    await act(async () => {
      render(<Settings />)
    })

    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('AI Configuration')).toBeInTheDocument()
    expect(screen.getByText('Global Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
  })

  it('loads API key status from IPC', async () => {
    ;(
      window.electronAPI.getApiKeyStatus as unknown as { mockResolvedValue: (v: boolean) => void }
    ).mockResolvedValue(true)
    await act(async () => {
      render(<Settings />)
    })

    expect(screen.getByText('API Key ✅ (Set)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter new key to replace existing')).toBeInTheDocument()
  })

  it('updates state when inputs change', async () => {
    await act(async () => {
      render(<Settings />)
    })

    const apiKeyInput = screen.getByPlaceholderText('sk-...')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key' } })

    expect((apiKeyInput as HTMLInputElement).value).toBe('sk-new-key')
  })

  it('saves settings to IPC on Save Settings button click', async () => {
    await act(async () => {
      render(<Settings />)
    })

    const apiKeyInput = screen.getByPlaceholderText('sk-...')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key' } })

    const saveButton = screen.getByText('Save Settings')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(window.electronAPI.setApiKey).toHaveBeenCalledWith('sk-new-key')
      expect(window.electronAPI.closeWindow).toHaveBeenCalled()
    })
  })

  it('calls quitApp when Quit PaperCache is clicked', async () => {
    await act(async () => {
      render(<Settings />)
    })

    const quitButton = screen.getByText('Quit')
    fireEvent.click(quitButton)

    expect(window.electronAPI.quitApp).toHaveBeenCalled()
  })
})
