import { BaseWindow, WebContentsView, Menu, app } from 'electron'
import type { Session, WebContents } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shellContentBackgroundHex } from '../shared/appearance.js'
import { IPC, type BrowserChromeTheme } from '../shared/ipc.js'
import { CHROME_HEIGHT } from '../shared/constants.js'
import * as settings from './settings-store.js'
import { registerAdblockNotifyHandlers } from './adblock-notify.js'
import { TabManager, setTabManager, getTabPreloadPath } from './tab-manager.js'
import * as Tab from './tab-manager.js'
import { flushBrowsingSessionSync } from './last-session-store.js'
import { shellDevtoolsOpenOptions } from './devtools.js'
import { extractHttpUrlFromArgv, flushPendingExternalUrls } from './default-browser.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindowRef: BaseWindow | null = null
let chromeWebContentsRef: WebContents | null = null

export function getMainWindow(): BaseWindow | null {
  return mainWindowRef
}

export function getChromeWebContents(): WebContents | null {
  return chromeWebContentsRef
}


export function syncMainWindowBackground(theme?: BrowserChromeTheme): void {
  const w = mainWindowRef
  if (!w || w.isDestroyed()) return
  const t = theme ?? settings.getSettings().browserChromeTheme
  w.setBackgroundColor(shellContentBackgroundHex(t))
}

export function createMainWindow(shellPreload: string, shellSession: Session, contentSession: Session): BaseWindow {
  const initialSurface = shellContentBackgroundHex(settings.getSettings().browserChromeTheme)
  const savedLayout = settings.readMainWindowStateForCreate()
  const mainWindow = new BaseWindow({
    width: savedLayout?.bounds.width ?? 1280,
    height: savedLayout?.bounds.height ?? 800,
    minWidth: 720,
    minHeight: 480,
    ...(savedLayout ? { x: savedLayout.bounds.x, y: savedLayout.bounds.y } : {}),
    show: false,
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
    backgroundColor: initialSurface
  })

  mainWindowRef = mainWindow

  const chromeView = new WebContentsView({
    webPreferences: {
      preload: shellPreload,
      session: shellSession,
      contextIsolation: true,
      nodeIntegration: false,
      
      sandbox: false,
      backgroundThrottling: false,
      
      transparent: true
    }
  })
  chromeView.setBackgroundColor('#00000000')
  chromeWebContentsRef = chromeView.webContents
  mainWindow.contentView.addChildView(chromeView)

  chromeView.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('[velo shell] did-fail-load', code, desc, url)
  })
  chromeView.webContents.on('render-process-gone', (_event, details) => {
    console.error('[velo shell] render-process-gone', details)
  })

  const layoutChrome = (): void => {
    if (mainWindow.isDestroyed()) return
    const w = Math.max(0, Math.floor(mainWindow.getContentBounds().width))
    const reserve = Tab.manager?.getChromeExtraShellHeight() ?? 0
    chromeView.setBounds({ x: 0, y: 0, width: w, height: CHROME_HEIGHT + reserve })
  }

  const tabPreload = getTabPreloadPath()
  const mgr = new TabManager(mainWindow, contentSession, tabPreload, chromeView)
  setTabManager(mgr)
  registerAdblockNotifyHandlers({
    sendToast: (payload) => {
      const wc = chromeView.webContents
      if (!wc.isDestroyed()) wc.send(IPC.adblockToast, payload)
    },
    getTabIdForWebContents: (wc) => mgr.getTabIdForWebContents(wc),
    getActiveTabId: () => mgr.getActiveTabId()
  })

  const onResize = (): void => {
    layoutChrome()
    mgr.relayout()
  }

  layoutChrome()
  let layoutPersistTimer: ReturnType<typeof setTimeout> | null = null
  const schedulePersistWindowLayout = (): void => {
    if (layoutPersistTimer) clearTimeout(layoutPersistTimer)
    layoutPersistTimer = setTimeout(() => {
      layoutPersistTimer = null
      if (!mainWindow.isDestroyed()) settings.persistMainWindowState(mainWindow)
    }, 500)
  }

  mainWindow.on('resize', onResize)
  mainWindow.on('resized', () => {
    onResize()
    schedulePersistWindowLayout()
  })
  mainWindow.on('move', schedulePersistWindowLayout)
  mainWindow.on('moved', schedulePersistWindowLayout)
  mainWindow.on('maximize', schedulePersistWindowLayout)
  mainWindow.on('unmaximize', schedulePersistWindowLayout)
  mainWindow.on('enter-full-screen', () => {
    onResize()
    schedulePersistWindowLayout()
  })
  mainWindow.on('leave-full-screen', () => {
    onResize()
    schedulePersistWindowLayout()
  })

  mainWindow.on('minimize', () => mgr.onWindowStateChanged())
  mainWindow.on('restore', () => mgr.onWindowStateChanged())
  mainWindow.on('focus', () => mgr.onWindowStateChanged())
  mainWindow.on('blur', () => mgr.onWindowStateChanged())

  mainWindow.on('close', () => {
    if (layoutPersistTimer) {
      clearTimeout(layoutPersistTimer)
      layoutPersistTimer = null
    }
    settings.persistMainWindowState(mainWindow)
    flushBrowsingSessionSync(mgr)
    mgr.flushAllWorkspacesSync()
    mgr.beginShutdown()
  })

  mainWindow.on('closed', () => {
    setTabManager(null)
    mainWindowRef = null
    chromeWebContentsRef = null
  })

  chromeView.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12') {
      event.preventDefault()
      Tab.manager?.openOrTogglePageDevTools()
      return
    }
    const mod = input.control || input.meta
    if (mod && input.shift && input.key.toLowerCase() === 'i') {
      event.preventDefault()
      Tab.manager?.openOrTogglePageDevTools()
    }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void chromeView.webContents.loadURL(rendererUrl)
  } else {
    void chromeView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }

  chromeView.webContents.once('did-finish-load', () => {
    onResize()
    mainWindow.show()
    if (savedLayout?.isFullScreen) {
      mainWindow.setFullScreen(true)
    } else if (savedLayout?.isMaximized) {
      mainWindow.maximize()
    }
    const restore = settings.getSettings().startupBehavior === 'restore-tabs'
    mgr.initWorkspaces(restore)
    const externalLaunch = extractHttpUrlFromArgv(process.argv)
    if (externalLaunch) {
      mgr.createTab(externalLaunch)
    } else if (mgr.getSnapshots().length === 0) {
      if (settings.shouldOfferWelcomeOnColdStart()) {
        mgr.createTab('velo://welcome?intro=1')
      } else {
        mgr.createTab('velo://newtab')
      }
    }
    flushPendingExternalUrls((u) => mgr.createTab(u))
    mgr.applyPerformanceSettings()
  })

  return mainWindow
}

export function setApplicationMenu(): void {
  const shellDevTools = (): void => {
    const wc = getChromeWebContents()
    if (wc && !wc.isDestroyed()) wc.openDevTools(shellDevtoolsOpenOptions)
  }

  const menu = Menu.buildFromTemplate([
    ...(process.platform === 'darwin'
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => Tab.manager?.createTab('velo://newtab')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload tab',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const id = Tab.manager?.getActiveTabId()
            if (id != null) Tab.manager?.reload(id)
          }
        },
        {
          label: 'Add new tab shortcut…',
          click: () => {
            void Tab.runOpenNewTabShortcutModalInActiveTab()
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle page DevTools',
          accelerator: 'F12',
          click: () => Tab.manager?.openOrTogglePageDevTools()
        },
        {
          label: 'Toggle page DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          visible: false,
          click: () => Tab.manager?.openOrTogglePageDevTools()
        },
        {
          label: 'Toggle shell DevTools',
          click: () => shellDevTools()
        }
      ]
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Back',
          accelerator: 'Alt+Left',
          click: () => {
            const id = Tab.manager?.getActiveTabId()
            if (id != null) Tab.manager?.goBack(id)
          }
        },
        {
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: () => {
            const id = Tab.manager?.getActiveTabId()
            if (id != null) Tab.manager?.goForward(id)
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(process.platform === 'darwin' ? [] : [{ role: 'close' as const }])]
    }
  ])
  Menu.setApplicationMenu(menu)
}
