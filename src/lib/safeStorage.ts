export async function setSecure(key: string, value: string): Promise<void> {
  const encrypted = await window.electronAPI.safeStorageEncrypt(value)
  localStorage.setItem(`${key}-secure`, encrypted)
}

export async function getSecure(key: string): Promise<string | null> {
  const encrypted = localStorage.getItem(`${key}-secure`)
  if (!encrypted) return null
  return await window.electronAPI.safeStorageDecrypt(encrypted)
}

export async function migrateApiKeyFromLocalStorage(key: string) {
  const plain = localStorage.getItem(key)
  if (plain) {
    await setSecure(key, plain)
    localStorage.removeItem(key)
  }
}
