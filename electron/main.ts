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
} from 'electron'
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

fs.writeFileSync(
  path.join(COMMANDS_DIR, 'basics.md'),
  `# Basics

- **Zoom**: \`Cmd + +\` to zoom in, \`Cmd + -\` to zoom out, \`Cmd + 0\` to reset.
- **New Note**: \`Cmd + N\` from anywhere when app is running.
- **Note Search**: \`Cmd + P\` to search across all your notes.
- **Main Menu**: \`Cmd + K\` to open the action menu.
- **Export Note**: \`Cmd + E\` to export the current note as markdown.
- **Graph View**: \`Cmd + G\` to see how your notes connect.
- **Highlight**: \`Cmd + H\` to highlight selected text.
- **Cancel/Close**: Press \`Esc\` to exit modals.

## Global Shortcuts
- **Toggle Visibility**: \`Cmd+Shift+C\` from anywhere on your OS to hide or show PaperCache.
- **Global New Note**: \`Cmd+Shift+N\` to spawn a new floating note anywhere.
- **Settings**: \`Cmd+Shift+S\` to open the settings panel.

*Example use:* Press \`Cmd+K\` right now, select "Settings", and set your global hotkey!

Next: [Folders](/file commands/folders.md)
`,
)

fs.writeFileSync(
  path.join(COMMANDS_DIR, 'folders.md'),
  `# Folders

Organize your notes by using a \`/\` in the note title.
Folders automatically receive a unique color identifier in the Graph View and Search list.

*Example use:*
If you rename this note (click the title at the top left) to \`projects/PaperCache.md\`, it will automatically be placed inside a \`projects\` folder!

Next: [Variables](/file commands/variables.md)
`,
)

fs.writeFileSync(
  path.join(COMMANDS_DIR, 'variables.md'),
  `# Variables & Math

PaperCache is a smart scratchpad. You can define variables and write math equations that auto-calculate.

**Local Variables:** (Only works in this note)
/var x = 10

*Example use:* Type \`x * 3 =\` below and watch it calculate!
x * 3 = \u200B30

**Global Variables:** (Works across ALL your notes)
/globvar API_KEY = "sk-123"

*Example use:* Just type API_KEY anywhere and see it highlight when your cursor leaves the word!
API_KEY

Next: [Markdown & Code](/file commands/markdown.md)
`,
)

fs.writeFileSync(
  path.join(COMMANDS_DIR, 'markdown.md'),
  `# Markdown & Code

PaperCache supports full markdown with seamless inline editing.

## Highlighting
Select text and press \`Cmd+H\` to highlight it.
*Example use:* ==This text is highlighted!==

## Code Snippets
You can write code snippets inside triple backticks \`\`\` and specify the language name right after the backticks for syntax highlighting.
*Example use:*
\`\`\`javascript
function greet(name) {
  return "Hello, " + name + "!";
}
\`\`\`
*(Tip: Click the copy button in the top right of the code block to copy its contents!)*

## Horizontal Rules
Type \`---\` on a new line to create a beautiful horizontal divider.
*Example use:*

---

## Inline AI Assistance
Type \`/ai <prompt>\` and press enter to summon an AI assistant directly into your document.
*Example use:*
\`/ai Write a python function to reverse a string\`

Next: [Formats & Colors](/file commands/formats.md)
`,
)

fs.writeFileSync(
  path.join(COMMANDS_DIR, 'formats.md'),
  `# Formats & Colors

PaperCache automatically recognizes and highlights common formats so you can easily spot them in your notes.

## Colors
Type any hex color, and it will be highlighted with a matching pill!
*Example use:* #D97757 or #3B82F6 or #10B981

## Dates & Times
Dates and times are also highlighted to help you keep track of your schedule.
*Example use:* 
Meeting on 2024-05-31 at 14:30.

Next: [Tags](/file commands/tags.md)
`,
)

fs.writeFileSync(
  path.join(COMMANDS_DIR, 'tags.md'),
  `# Tags

You can tag your notes anywhere by typing an exclamation mark followed by a word (e.g., !important or !work).

*Example use:*
This is a note about a !project. 

When you open the search menu (\`Cmd+P\`), you'll see all your unique tags at the top. Click any tag to instantly filter your notes!

Next: [Tasks](/file commands/tasks.md)

[Back to Welcome](/file Welcome.md)
`,
)

fs.writeFileSync(
  path.join(COMMANDS_DIR, 'tasks.md'),
  `# Tasks & Reminders

Stay on top of your work by using tasks!

Type \`/task\` to create a new task.
If you want to set a deadline, just type \` @ \` followed by a time shorthand after the task.
*Example use:*
/task Buy groceries @ 2h

PaperCache understands shorthands like \`2d\`, \`3h45m\`, \`tmrw\`, or even exact dates like \`2024-12-31 15:00\`.
Once you set a task, press \`Cmd+T\` (or \`Ctrl+T\`) to open the Tasks Page and see everything that's due!
Overdue tasks will automatically highlight in red.

Next: [Ready](/file commands/ready.md)

[Back to Welcome](/file Welcome.md)
`,
)

fs.writeFileSync(
  path.join(COMMANDS_DIR, 'ready.md'),
  `# Ready to get started?

You're all set to use PaperCache! Start jotting down your thoughts, creating folders, and exploring the capabilities.

[Back to Welcome](/file Welcome.md)
`,
)

const welcomePath = path.join(NOTES_DIR, 'Welcome.md')
let shouldWriteWelcome = true
if (fs.existsSync(welcomePath)) {
  const content = fs.readFileSync(welcomePath, 'utf-8')
  if (content.includes('[7. Tasks]')) {
    shouldWriteWelcome = false
  }
}

if (shouldWriteWelcome) {
  fs.writeFileSync(
    welcomePath,
    `# Welcome to PaperCache!

PaperCache is your intelligent, minimalist markdown scratchpad. 

To navigate, use **Cmd + Click** (or **Ctrl + Click**) on any internal link. You can look at all the files in the order you want!

Here's an interactive checkbox to try out right now:
/check I am learning PaperCache!

Try Cmd+Clicking these to learn the ropes:
- [1. Basics](/file commands/basics.md)
- [2. Folders](/file commands/folders.md)
- [3. Variables](/file commands/variables.md)
- [4. Markdown & Code](/file commands/markdown.md)
- [5. Formats & Colors](/file commands/formats.md)
- [6. Tags](/file commands/tags.md)
- [7. Tasks](/file commands/tasks.md)

*(Press \`Cmd+K\` at any time to open the main menu!)*
`,
  )

  const now = new Date()
  fs.utimesSync(welcomePath, now, new Date(now.getTime() + 10000))
}

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
    },
  })

  win.on('close', saveWindowState)

  win.on('ready-to-show', () => {
    win?.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win?.show()
  })

  win.on('blur', () => {
    // Only hide if we aren't in the middle of opening a native dialog like export
    if (!isExporting && win) {
      if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isFocused()) {
        win.hide()
      } else {
        win.hide()
        if (process.platform === 'darwin') {
          app.hide()
        }
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
  createWindow()

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

  const registerNewNoteShortcut = (combo: string) => {
    try {
      if (globalShortcut.isRegistered(combo)) {
        globalShortcut.unregister(combo)
      }
      globalShortcut.register(combo, () => {
        if (win) {
          bringToActiveSpace(win)
          win.webContents.send('trigger-new-note')
        }
      })
    } catch (e) {}
  }

  const registerToggleShortcut = (combo: string) => {
    try {
      if (globalShortcut.isRegistered(combo)) {
        globalShortcut.unregister(combo)
      }
      globalShortcut.register(combo, toggleWindow)
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

// Helper to get all files recursively
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles
  const files = fs.readdirSync(dirPath)
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file)
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles)
    } else {
      if (file.endsWith('.md')) {
        arrayOfFiles.push(fullPath)
      }
    }
  })
  return arrayOfFiles
}

// Helper to clean empty directories
function cleanEmptyFoldersRecursively(folder: string) {
  if (folder === NOTES_DIR || !folder.startsWith(NOTES_DIR)) return
  if (!fs.existsSync(folder)) return
  const files = fs.readdirSync(folder)
  if (files.length === 0) {
    fs.rmdirSync(folder)
    cleanEmptyFoldersRecursively(path.dirname(folder))
  }
}

ipcMain.handle('get-notes', () => {
  const files = getAllFiles(NOTES_DIR)
  const notes = files
    .map((filePath) => {
      const stats = fs.statSync(filePath)
      const id = path.relative(NOTES_DIR, filePath).split(path.sep).join('/')
      return {
        id,
        content: fs.readFileSync(filePath, 'utf-8'),
        mtime: stats.mtime.getTime(),
      }
    })
    .sort((a, b) => b.mtime - a.mtime)

  return notes
})

ipcMain.handle('save-note', (event, { id, content }) => {
  const filePath = path.join(NOTES_DIR, id)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('delete-note', (event, id) => {
  if (id.startsWith('commands/')) {
    return false
  }
  const filePath = path.join(NOTES_DIR, id)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    cleanEmptyFoldersRecursively(path.dirname(filePath))
  }
  return true
})

ipcMain.handle('rename-note', (event, { oldId, newId }) => {
  const oldPath = path.join(NOTES_DIR, oldId)
  const newPath = path.join(NOTES_DIR, newId)
  if (fs.existsSync(oldPath)) {
    fs.mkdirSync(path.dirname(newPath), { recursive: true })
    fs.renameSync(oldPath, newPath)
    cleanEmptyFoldersRecursively(path.dirname(oldPath))
  }
  return true
})

let settingsWin: BrowserWindow | null = null

ipcMain.on('open-settings', () => {
  if (settingsWin) {
    settingsWin.show()
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 900,
    height: 700,
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(process.env.VITE_DEV_SERVER_URL + '#/settings')
  } else {
    settingsWin.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/settings' })
  }

  settingsWin.on('closed', () => {
    settingsWin = null
  })
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
  return fs.readFileSync(path.join(NOTES_DIR, id), 'utf-8')
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
      fs.writeFileSync(filePath, content, 'utf-8')
      return true
    }
    return false
  } finally {
    isExporting = false
  }
})

ipcMain.on('open-external', (_, url) => {
  shell.openExternal(url)
})

ipcMain.on('open-file', (_, filePath) => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(NOTES_DIR, filePath)
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
