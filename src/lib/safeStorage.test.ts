import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setSecure, getSecure } from './safeStorage'

describe('safeStorage (Renderer Flow)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('encrypts value and stores in localStorage securely', async () => {
    await setSecure('test-key', 'secret-text')
    expect(window.electronAPI.safeStorageEncrypt).toHaveBeenCalledWith('secret-text')
    expect(localStorage.getItem('test-key-secure')).toBe('secret-text') // The mock just returns the value it received
  })

  it('decrypts value from localStorage securely', async () => {
    localStorage.setItem('test-key-secure', 'encrypted-secret')
    const decrypted = await getSecure('test-key')
    expect(window.electronAPI.safeStorageDecrypt).toHaveBeenCalledWith('encrypted-secret')
    expect(decrypted).toBe('encrypted-secret')
  })

  it('returns null if no secure key exists', async () => {
    const decrypted = await getSecure('missing-key')
    expect(window.electronAPI.safeStorageDecrypt).not.toHaveBeenCalled()
    expect(decrypted).toBeNull()
  })
})
