import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, screen, nativeTheme, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NOTES_DIR = path.join(os.homedir(), '.papercache')
const STATE_FILE = path.join(NOTES_DIR, 'window-state.json')

if (!fs.existsSync(NOTES_DIR)) {
  fs.mkdirSync(NOTES_DIR)
}

const COMMANDS_DIR = path.join(NOTES_DIR, 'commands')
if (!fs.existsSync(COMMANDS_DIR)) {
  fs.mkdirSync(COMMANDS_DIR)
  fs.writeFileSync(path.join(COMMANDS_DIR, 'basics.md'), `# Basics\n\n- Zoom: \`Cmd + +\` to zoom in, \`Cmd + -\` to zoom out, \`Cmd + 0\` to reset.\n- New Note: \`Cmd + N\` from anywhere when app is running.\n- Global Hotkey: Configure a global hotkey for New Note in Settings.\n- Note Search: \`Cmd + P\` to search across all your notes.\n- Main Menu: \`Cmd + K\` to open the action menu.\n- Cancel/Close: Press \`Esc\` to exit modals.\n\nNext: [Folders](/file commands/folders.md)\n`)
  fs.writeFileSync(path.join(COMMANDS_DIR, 'folders.md'), `# Folders\n\n- Organize your notes by using a \`/\` in the note title.\n- For example, renaming a note to \`projects/app.md\` will place it inside the \`projects\` folder.\n- Folders automatically receive a unique color identifier in the Graph View and Search list.\n\nNext: [Variables](/file commands/variables.md)\n`)
  fs.writeFileSync(path.join(COMMANDS_DIR, 'variables.md'), `# Variables\n\n- Define local variables using: \`/var x = 10\`\n- Define global variables (accessible everywhere) using: \`/globvar API_KEY = "sk-123"\`\n- When you type a variable name in your text, it will seamlessly resolve to its value when your cursor leaves the word.\n- Variables work with the math auto-solver. If you define \`/var y = 5\` and write \`y * 3 =\`, it will auto-calculate to 15! Updating a variable automatically updates all downstream calculations.\n\nNext: [Markdown & Code](/file commands/markdown.md)\n`)
  fs.writeFileSync(path.join(COMMANDS_DIR, 'markdown.md'), `# Markdown & Code\n\n- Supports full markdown with seamless inline editing.\n- Type code blocks with backticks. Syntax highlighting is automatically applied.\n- Click the copy button on any code block to copy its contents.\n- Select text and press \`Cmd+H\` to highlight it.\n- Use AI by using the \`/ai\` command followed by your prompt and pressing Enter.\n\n[Back to Welcome](/file Welcome.md)\n`)

  const welcomePath = path.join(NOTES_DIR, 'Welcome.md')
  fs.writeFileSync(welcomePath, `# Welcome to PaperCache!

PaperCache is your intelligent, minimalist markdown scratchpad. 

To navigate, use **Cmd + Click** (or **Ctrl + Click**) on any internal link. You can look at all the files in the order you want!

Try Cmd+Clicking these to learn the ropes:
- [1. Basics](/file commands/basics.md)
- [2. Folders](/file commands/folders.md)
- [3. Variables](/file commands/variables.md)
- [4. Markdown & Code](/file commands/markdown.md)

*(Press \`Cmd+K\` at any time to open the main menu!)*
`)

  const now = new Date()
  fs.utimesSync(welcomePath, now, new Date(now.getTime() + 10000))
}

let win: BrowserWindow | null = null
let tray: Tray | null = null

// Hide dock icon for stealth mode
if (app.dock) {
  app.dock.hide()
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
    win?.show()
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

app.whenReady().then(() => {
  createWindow()

  // Setup Tray
  tray = new Tray(nativeImage.createEmpty()) // empty initially
  
  function updateTrayIcon() {
    if (!tray) return;
    const isDark = nativeTheme.shouldUseDarkColors;
    const logoName = isDark ? 'PaperCache Logo white.png' : 'PaperCache Logo black.png';
    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    const publicDir = isDev ? path.join(__dirname, '../public') : path.join(__dirname, '../dist');
    const iconPath = path.join(publicDir, logoName);
    
    let icon = nativeImage.createFromPath(iconPath);
    icon = icon.resize({ width: 20, height: 20 });
    
    tray.setImage(icon);
    tray.setTitle('');
  }

  updateTrayIcon();
  nativeTheme.on('updated', updateTrayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show/Hide PaperCache', click: toggleWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit() } }
  ])
  tray.setToolTip('PaperCache')
  tray.setContextMenu(contextMenu)

  // Default hotkeys are now handled via IPC from App.tsx on load

  // Wait for settings to load before registering new note shortcut to get custom one
  // Registration is handled via IPC from the renderer on startup

  const registerNewNoteShortcut = (combo: string) => {
    try {
      if (globalShortcut.isRegistered(combo)) {
        globalShortcut.unregister(combo);
      }
      globalShortcut.register(combo, () => {
        if (win) {
          bringToActiveSpace(win);
          win.webContents.send('trigger-new-note');
        }
      });
    } catch(e) {}
  };

  const registerToggleShortcut = (combo: string) => {
    try {
      if (globalShortcut.isRegistered(combo)) {
        globalShortcut.unregister(combo);
      }
      globalShortcut.register(combo, toggleWindow);
    } catch(e) {}
  };
  
  ipcMain.on('update-global-shortcut', (event, { action, oldShortcut, newShortcut }) => {
    try {
      if (oldShortcut && globalShortcut.isRegistered(oldShortcut)) {
        globalShortcut.unregister(oldShortcut);
      }
      if (action === 'new-note') {
        registerNewNoteShortcut(newShortcut);
      } else if (action === 'toggle') {
        registerToggleShortcut(newShortcut);
      }
    } catch(e) {}
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

function bringToActiveSpace(win: BrowserWindow) {
  const point = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint(point);
  
  const bounds = win.getBounds();
  const workArea = currentDisplay.workArea;
  
  // Center window on current active display
  win.setBounds({
    x: Math.round(workArea.x + (workArea.width - bounds.width) / 2),
    y: Math.round(workArea.y + (workArea.height - bounds.height) / 2),
    width: bounds.width,
    height: bounds.height
  });

  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.show();
  app.focus({ steal: true });
  win.focus();
  win.setAlwaysOnTop(false);
  win.setVisibleOnAllWorkspaces(false);
}

function toggleWindow() {
  if (win) {
    if (win.isVisible()) {
      if (win.isFocused()) {
        win.hide()
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
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  if (senderWin) {
    if (senderWin === win) {
      win.hide();
    } else {
      senderWin.close();
    }
  }
})

// Helper to get all files recursively
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
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
  if (folder === NOTES_DIR || !folder.startsWith(NOTES_DIR)) return;
  if (!fs.existsSync(folder)) return;
  const files = fs.readdirSync(folder);
  if (files.length === 0) {
    fs.rmdirSync(folder);
    cleanEmptyFoldersRecursively(path.dirname(folder));
  }
}

ipcMain.handle('get-notes', () => {
  const files = getAllFiles(NOTES_DIR)
  const notes = files.map(filePath => {
    const stats = fs.statSync(filePath)
    const id = path.relative(NOTES_DIR, filePath).split(path.sep).join('/')
    return {
      id,
      content: fs.readFileSync(filePath, 'utf-8'),
      mtime: stats.mtime.getTime()
    }
  }).sort((a, b) => b.mtime - a.mtime)
  
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
    return false;
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

ipcMain.handle('read-note', async (_, id) => {
  return fs.readFileSync(path.join(NOTES_DIR, id), 'utf-8')
})

ipcMain.handle('export-note', async (_, filename: string, content: string) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (filePath) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
});

ipcMain.on('open-external', (_, url) => {
  shell.openExternal(url)
})

ipcMain.on('open-file', (_, filePath) => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(NOTES_DIR, filePath)
  shell.openPath(absolutePath)
})
