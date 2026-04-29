import { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main.js'
import { DatabaseManager } from './db'

log.initialize()
log.info('App starting...')

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let db: DatabaseManager

function createMainWindow(): void {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 760,
    height: 480,
    x: Math.round((screenWidth - 760) / 2),
    y: Math.round((screenHeight - 480) / 2),
    frame: false,
    transparent: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    alwaysOnTop: true,
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setContentProtection(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  log.info('Main window created')
}

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 660,
    height: 520,
    resizable: false,
    parent: mainWindow || undefined,
    modal: false,
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/settings')
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/settings' })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function registerShortcuts(): void {
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  log.info('Global shortcuts registered')
}

function setupIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:close', () => mainWindow?.hide())
  ipcMain.handle('window:toggle', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })

  ipcMain.handle('settings:open', () => createSettingsWindow())
  ipcMain.handle('settings:close', () => settingsWindow?.close())

  ipcMain.handle('db:getSessions', () => db.getSessions())
  ipcMain.handle('db:createSession', (_, data) => db.createSession(data))
  ipcMain.handle('db:getSession', (_, id) => db.getSession(id))
  ipcMain.handle('db:deleteSession', (_, id) => db.deleteSession(id))
  ipcMain.handle('db:addTranscript', (_, data) => db.addTranscript(data))
  ipcMain.handle('db:addAIResponse', (_, data) => db.addAIResponse(data))
  ipcMain.handle('db:getTranscripts', (_, sessionId) => db.getTranscripts(sessionId))
  ipcMain.handle('db:getAIResponses', (_, sessionId) => db.getAIResponses(sessionId))

  ipcMain.handle('settings:get', (_, key) => db.getSetting(key))
  ipcMain.handle('settings:set', (_, key, value) => db.setSetting(key, value))
  ipcMain.handle('settings:getAll', () => db.getAllSettings())

  ipcMain.handle('capture:getSources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    })
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL()
    }))
  })

  log.info('IPC handlers registered')
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.aiinterview.assistant')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  db = new DatabaseManager()

  setupIpcHandlers()
  registerShortcuts()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

log.info('Main process initialized')
