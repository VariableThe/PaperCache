import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  screen,
  nativeTheme,
  shell,
  dialog,
  safeStorage,
  powerMonitor,
  session,
} from 'electron'
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NOTES_DIR = path.join(os.homedir(), '.papercache')
const STATE_FILE = path.join(NOTES_DIR, 'window-state.json')

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isExporting = false

if (!fs.existsSync(NOTES_DIR)) {
  fs.mkdirSync(NOTES_DIR)
}

const COMMANDS_DIR = path.join(NOTES_DIR, 'commands')
if (!fs.existsSync(COMMANDS_DIR)) {
  fs.mkdirSync(COMMANDS_DIR)
}

function getSafeNotePath(id: string): string {
  const fullPath = path.resolve(NOTES_DIR, id)
  const relative = path.relative(NOTES_DIR, fullPath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Access denied: Invalid path')
  }
  return fullPath
}

import { initializeOnboarding } from './onboarding.js'

initializeOnboarding(NOTES_DIR, COMMANDS_DIR)


// Hide dock icon for stealth mode
if (app.dock) {
  app.dock.hide()
}
if (process.platform === 'darwin') {
  app.setActivationPolicy('accessory')
}

function getWindowState() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const defaultWidth = Math.floor(screenWidth / 4)
  const defaultHeight = Math.floor(screenHeight / 2)
  const defaultX = 20
  const defaultY = screenHeight - defaultHeight - 20

  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
      return { ...state }
    }
  } catch (e) {
    // Ignore error
  }
  return { width: defaultWidth, height: defaultHeight, x: defaultX, y: defaultY }
}

function saveWindowState() {
  if (win) {
    try {
      const bounds = win.getBounds()
      if (!fs.existsSync(NOTES_DIR)) {
        fs.mkdirSync(NOTES_DIR, { recursive: true })
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(bounds))
    } catch (e) {
      // Ignore error
    }
  }
}

function createWindow() {
  const state = getWindowState()

  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    frame: false,
    transparent: true,
    hasShadow: true,
    maximizable: false,
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  })

  // Prevent new window creation
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  // Prevent navigation to external sites inside the app
  win.webContents.on('will-navigate', (event, url) => {
    const isLocalhost = url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')
    const isFile = url.startsWith('file://')
    if (!isLocalhost && !isFile) {
      event.preventDefault()
    }
  })

  win.on('close', saveWindowState)

  win.on('ready-to-show', () => {
    win?.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win?.show()
  })

  win.on('blur', () => {
    // Only hide if we aren't in the middle of opening a native dialog like export
    if (!isExporting && win) {
      win.hide()
      if (process.platform === 'darwin') {
        app.hide()
      }
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('web-contents-created', (event, contents) => {
  contents.on('before-input-event', (e, input) => {
    if ((input.control || input.meta) && input.key.toLowerCase() === 't') {
      contents.send('trigger-tasks')
      e.preventDefault()
    }
  })
})

app.whenReady().then(() => {
  // Content Security Policy
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isDevCSP =
      "default-src 'none'; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https: wss:; " +
      "font-src 'self' data: https:; " +
      "object-src 'none'; " +
      "base-uri 'none';"
    const isProdCSP =
      "default-src 'none'; " +
      "script-src 'self' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https:; " +
      "font-src 'self' data: https:; " +
      "object-src 'none'; " +
      "base-uri 'none';"

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // unsafe-eval is required for mathjs dynamic compilation
        'Content-Security-Policy': [isDev ? isDevCSP : isProdCSP],
      },
    })
  })

  autoUpdater.checkForUpdatesAndNotify()

  createWindow()

  powerMonitor.on('suspend', () => {
    if (win) win.webContents.send('power:suspend')
  })
  
  powerMonitor.on('resume', () => {
    if (win) win.webContents.send('power:resume')
  })

  // Setup Tray
  tray = new Tray(nativeImage.createEmpty()) // empty initially

  function updateTrayIcon() {
    if (!tray) return
    const isDark = nativeTheme.shouldUseDarkColors
    const logoName = isDark ? 'logo-white.png' : 'logo-black.png'
    const isDev = !!process.env.VITE_DEV_SERVER_URL
    const publicDir = isDev ? path.join(__dirname, '../public') : path.join(__dirname, '../dist')
    const iconPath = path.join(publicDir, logoName)

    let icon = nativeImage.createFromPath(iconPath)
    icon = icon.resize({ width: 20, height: 20 })

    tray.setImage(icon)
    tray.setTitle('')
  }

  updateTrayIcon()
  nativeTheme.on('updated', updateTrayIcon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show/Hide PaperCache', click: toggleWindow },
    { label: 'Check for Updates', click: () => autoUpdater.checkForUpdatesAndNotify() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])
  tray.setToolTip('PaperCache')
  tray.setContextMenu(contextMenu)

  // Default hotkeys are now handled via IPC from App.tsx on load

  // Wait for settings to load before registering new note shortcut to get custom one
  // Registration is handled via IPC from the renderer on startup

  let currentNewNoteShortcut = ''
  let currentToggleShortcut = ''
  let isShortcutsPaused = false

  const registerNewNoteShortcut = (combo: string) => {
    currentNewNoteShortcut = combo
    try {
      if (globalShortcut.isRegistered(combo)) {
        globalShortcut.unregister(combo)
      }
      if (!isShortcutsPaused && combo) {
        globalShortcut.register(combo, () => {
          if (win) {
            bringToActiveSpace(win)
            win.webContents.send('trigger-new-note')
          }
        })
      }
    } catch (e) {}
  }

  const registerToggleShortcut = (combo: string) => {
    currentToggleShortcut = combo
    try {
      if (globalShortcut.isRegistered(combo)) {
        globalShortcut.unregister(combo)
      }
      if (!isShortcutsPaused && combo) {
        globalShortcut.register(combo, toggleWindow)
      }
    } catch (e) {}
  }

  ipcMain.on('update-global-shortcut', (event, { action, oldShortcut, newShortcut }) => {
    try {
      if (oldShortcut && globalShortcut.isRegistered(oldShortcut)) {
        globalShortcut.unregister(oldShortcut)
      }
      if (action === 'new-note') {
        registerNewNoteShortcut(newShortcut)
      } else if (action === 'toggle') {
        registerToggleShortcut(newShortcut)
      }
    } catch (e) {}
  })

  ipcMain.on('pause-shortcuts', () => {
    isShortcutsPaused = true
    globalShortcut.unregisterAll()
  })

  ipcMain.on('resume-shortcuts', () => {
    isShortcutsPaused = false
    if (currentNewNoteShortcut) registerNewNoteShortcut(currentNewNoteShortcut)
    if (currentToggleShortcut) registerToggleShortcut(currentToggleShortcut)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

function bringToActiveSpace(win: BrowserWindow) {
  const currentDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const winBounds = win.getBounds()
  const winDisplay = screen.getDisplayMatching(winBounds)

  if (currentDisplay.id !== winDisplay.id) {
    const xRatio = (winBounds.x - winDisplay.workArea.x) / Math.max(1, winDisplay.workArea.width)
    const yRatio = (winBounds.y - winDisplay.workArea.y) / Math.max(1, winDisplay.workArea.height)

    const newX = currentDisplay.workArea.x + currentDisplay.workArea.width * xRatio
    const newY = currentDisplay.workArea.y + currentDisplay.workArea.height * yRatio

    win.setBounds({
      x: Math.round(newX),
      y: Math.round(newY),
      width: winBounds.width,
      height: winBounds.height,
    })
  }

  app.show()
  win.show()
  app.focus({ steal: true })
}

function toggleWindow() {
  if (win) {
    if (win.isVisible()) {
      if (win.isFocused()) {
        win.hide()
        if (process.platform === 'darwin') {
          app.hide()
        }
      } else {
        bringToActiveSpace(win)
      }
    } else {
      bringToActiveSpace(win)
    }
  }
}

// IPC Handlers
ipcMain.handle('close-window', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender)
  if (senderWin) {
    if (senderWin === win) {
      if (process.platform === 'darwin') {
        app.hide()
      } else {
        win.hide()
      }
    } else {
      senderWin.close()
    }
  }
})

// Helper to get all files recursively (async version)
async function getAllFilesAsync(dirPath: string, arrayOfFiles: string[] = []) {
  try {
    const files = await fs.promises.readdir(dirPath)
    await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(dirPath, file)
        const stat = await fs.promises.stat(fullPath)
        if (stat.isDirectory()) {
          await getAllFilesAsync(fullPath, arrayOfFiles)
        } else {
          if (file.endsWith('.md')) {
            arrayOfFiles.push(fullPath)
          }
        }
      })
    )
  } catch (e) {}
  return arrayOfFiles
}

// Helper to clean empty directories
async function cleanEmptyFoldersRecursively(folder: string) {
  if (folder === NOTES_DIR || !folder.startsWith(NOTES_DIR)) return
  try {
    const files = await fs.promises.readdir(folder)
    if (files.length === 0) {
      await fs.promises.rmdir(folder)
      await cleanEmptyFoldersRecursively(path.dirname(folder))
    }
  } catch (e) {
    // Ignore if not exists or can't read
  }
}

ipcMain.handle('get-notes', async () => {
  const files = await getAllFilesAsync(NOTES_DIR)
  const notesData = await Promise.all(
    files.map(async (filePath) => {
      const stats = await fs.promises.stat(filePath)
      const id = path.relative(NOTES_DIR, filePath).split(path.sep).join('/')
      const content = await fs.promises.readFile(filePath, 'utf-8')
      return {
        id,
        content,
        mtime: stats.mtime.getTime(),
      }
    })
  )

  return notesData.sort((a, b) => b.mtime - a.mtime)
})

ipcMain.handle('save-note', async (event, { id, content }) => {
  const filePath = getSafeNotePath(id)
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await fs.promises.writeFile(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('delete-note', async (event, id) => {
  if (id.startsWith('commands/')) {
    return false
  }
  const filePath = getSafeNotePath(id)
  try {
    await fs.promises.access(filePath)
    await fs.promises.unlink(filePath)
    await cleanEmptyFoldersRecursively(path.dirname(filePath))
  } catch (e) {
    console.error(`Failed to delete note ${id}:`, e)
  }
  return true
})

ipcMain.handle('rename-note', async (event, { oldId, newId }) => {
  const oldPath = getSafeNotePath(oldId)
  const newPath = getSafeNotePath(newId)
  try {
    await fs.promises.access(oldPath)
    await fs.promises.mkdir(path.dirname(newPath), { recursive: true })
    await fs.promises.rename(oldPath, newPath)
    await cleanEmptyFoldersRecursively(path.dirname(oldPath))
  } catch (e) {
    console.error(`Failed to rename note from ${oldId} to ${newId}:`, e)
  }
  return true
})



let memoryApiKey = ''
try {
  const file = fs.readFileSync(path.join(NOTES_DIR, 'config.enc'), 'utf-8')
  if (safeStorage.isEncryptionAvailable()) {
    memoryApiKey = safeStorage.decryptString(Buffer.from(file, 'base64'))
  } else {
    memoryApiKey = file
  }
} catch (err) {
  // Config doesn't exist yet, ignore
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
    console.error('Failed to load API key config:', err)
  }
}

ipcMain.handle('set-api-key', async (_, key: string) => {
  memoryApiKey = key;
  try {
    const dataToSave = safeStorage.isEncryptionAvailable() 
      ? safeStorage.encryptString(key).toString('base64') 
      : key
    await fs.promises.writeFile(path.join(NOTES_DIR, 'config.enc'), dataToSave)
    return true
  } catch (err) {
    console.error('Failed to set API key:', err)
    return false
  }
})

ipcMain.handle('get-api-key-status', () => {
  return !!memoryApiKey && memoryApiKey.length > 0
})

ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdatesAndNotify()
})

ipcMain.handle('openai-chat', async (_, { model, messages, baseURL }) => {
  // Input Validation
  if (typeof model !== 'string' || model.trim() === '') {
    throw new Error('Invalid model provided')
  }
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array')
  }
  if (baseURL && typeof baseURL !== 'string') {
    throw new Error('Invalid baseURL provided')
  }

  try {
    let endpoint = baseURL || 'https://api.openai.com/v1/chat/completions'
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint = endpoint.replace(/\/$/, '') + '/chat/completions'
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memoryApiKey || 'dummy'}`,
        'HTTP-Referer': 'https://github.com/papercache/papercache',
        'X-Title': 'PaperCache',
      },
      body: JSON.stringify({ model, messages }),
    })
    
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${text}`)
    }
    
    try {
      return JSON.parse(text)
    } catch (e) {
      throw new Error(`Invalid API response. Expected JSON but received: ${text.substring(0, 200)}...`)
    }
  } catch (error: any) {
    throw new Error(error.message || 'Unknown API Error')
  }
})

ipcMain.on('quit-app', () => {
  app.quit()
})

ipcMain.on('set-launch-startup', (_, value: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: value,
    openAsHidden: true,
  })
})

ipcMain.handle('read-note', async (_, id) => {
  return await fs.promises.readFile(getSafeNotePath(id), 'utf-8')
})

ipcMain.handle('export-note', async (_, filename: string, content: string) => {
  isExporting = true
  try {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (filePath) {
      await fs.promises.writeFile(filePath, content, 'utf-8')
      return true
    }
    return false
  } finally {
    isExporting = false
  }
})

ipcMain.on('open-external', (_, url) => {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
    shell.openExternal(url)
  }
})

ipcMain.on('open-file', (_, filePath) => {
  const absolutePath = path.resolve(NOTES_DIR, filePath)
  if (!absolutePath.startsWith(NOTES_DIR + path.sep) && absolutePath !== NOTES_DIR) {
    console.warn(`[Security Blocked] Attempted to open file outside NOTES_DIR: ${absolutePath}`)
    return
  }
  shell.openPath(absolutePath)
})

ipcMain.handle('safe-storage-encrypt', (_, val: string) => {
  return safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(val).toString('base64') : val
})

ipcMain.handle('safe-storage-decrypt', (_, val: string) => {
  if (!safeStorage.isEncryptionAvailable()) return val
  try {
    return safeStorage.decryptString(Buffer.from(val, 'base64'))
  } catch (e) {
    return val
  }
})
