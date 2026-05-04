import { app, protocol, session, BaseWindow, type Session } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerVeloProtocol } from './protocol.js'
import { createMainWindow, getChromeWebContents, getMainWindow, setApplicationMenu } from './window.js'
import { registerIpcHandlers } from './ipc.js'
import { applyAdBlockLevel, registerContentSessionForAdblock } from './adblock.js'
import * as TabManager from './tab-manager.js'
import {
  extractHttpUrlFromArgv,
  offerExternalHttpUrl
} from './default-browser.js'
import {
  flushDownloadsToDisk,
  initDownloadsStore,
  listDownloads,
  setDownloadsListListener,
  trackDownload
} from './downloads-store.js'
import { IPC } from '../shared/ipc.js'
import { getSettings, readBootUseHardwareAcceleration } from './settings-store.js'
import * as passwordVault from './password-vault.js'
import { initVeloAutoUpdater } from './auto-updater.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

if (!readBootUseHardwareAcceleration()) {
  app.disableHardwareAcceleration()
}


app.commandLine.appendSwitch('disable-features', 'WebContentsForceDark,AutoDarkModeForWebContents')


function uniqueSavePath(directory: string, filename: string): string {
  const safeName = basename(filename) || 'download'
  let candidate = join(directory, safeName)
  if (!existsSync(candidate)) return candidate
  const ext = extname(safeName)
  const stem = ext.length > 0 ? safeName.slice(0, -ext.length) : safeName
  for (let n = 1; n < 10000; n += 1) {
    candidate = join(directory, `${stem} (${n})${ext}`)
    if (!existsSync(candidate)) return candidate
  }
  return join(directory, `${stem} (${Date.now()})${ext}`)
}

const contentSessionsWithWillDownload = new WeakSet<Session>()
const contentSessionsMacWebAuthnPicker = new WeakSet<Session>()

function prepareBrowsingSession(contentSession: Session): void {
  registerVeloProtocol(contentSession)
  
  if (process.platform === 'darwin' && !contentSessionsMacWebAuthnPicker.has(contentSession)) {
    contentSessionsMacWebAuthnPicker.add(contentSession)
    contentSession.on('select-webauthn-account', (event, details, callback) => {
      event.preventDefault()
      callback(details.accounts[0]?.credentialId)
    })
  }
  if (!contentSessionsWithWillDownload.has(contentSession)) {
    contentSessionsWithWillDownload.add(contentSession)
    contentSession.on('will-download', (_event, item) => {
      const dir = getSettings().downloadDirectory
      void (async (): Promise<void> => {
        try {
          await mkdir(dir, { recursive: true })
        } catch {}
        const savePath = uniqueSavePath(dir, item.getFilename())
        item.setSavePath(savePath)
        trackDownload(item)
      })()
    })
  }
  registerContentSessionForAdblock(contentSession)
  void applyAdBlockLevel(getSettings().adBlockLevel).catch((err) => {
    console.error('[velo adblock] apply failed', err)
  })
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = extractHttpUrlFromArgv(argv)
    const mgr = TabManager.manager
    if (url && mgr) {
      mgr.createTab(url)
    } else if (url) {
      offerExternalHttpUrl(url)
    }
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  if (process.platform === 'darwin') {
    app.on('open-url', (event, url) => {
      event.preventDefault()
      if (!/^https?:\/\//i.test(url)) return
      const mgr = TabManager.manager
      if (mgr) {
        mgr.createTab(url)
        const w = getMainWindow()
        if (w && !w.isDestroyed()) {
          if (w.isMinimized()) w.restore()
          w.show()
          w.focus()
        }
      } else {
        offerExternalHttpUrl(url)
      }
    })
  }

  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'velo',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])

  app.on('before-quit', () => {
    passwordVault.shutdownVaultSession()
    flushDownloadsToDisk()
  })

  app.whenReady().then(async () => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.velobrowser.app')
    }
    
    if (process.platform === 'darwin') {
      try {
        app.configureWebAuthn({})
      } catch (err) {
        console.warn('[velo] configureWebAuthn failed', err)
      }
    }
    try {
      passwordVault.ensureVaultReady()
    } catch (err) {
      console.warn('[velo] password vault init', err)
    }
    registerIpcHandlers()
    setApplicationMenu()
    await initDownloadsStore()

    
    const shellSession = session.fromPartition('memory:velo-shell')
    const contentSession = session.fromPartition('persist:velo')
    prepareBrowsingSession(contentSession)

    const shellPreload = join(__dirname, '../preload/index.mjs')
    createMainWindow(shellPreload, shellSession, contentSession)

    setDownloadsListListener(() => {
      const wc = getChromeWebContents()
      if (wc && !wc.isDestroyed()) {
        wc.send(IPC.downloadsChanged, listDownloads())
      }
    })
    initVeloAutoUpdater()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) {
      const shellSession = session.fromPartition('memory:velo-shell')
      const contentSession = session.fromPartition('persist:velo')
      prepareBrowsingSession(contentSession)
      const shellPreload = join(__dirname, '../preload/index.mjs')
      createMainWindow(shellPreload, shellSession, contentSession)
    }
  })
}
