import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { AutoUpdateStatusPayload } from '../shared/ipc.js'
import { IPC } from '../shared/ipc.js'
import { getChromeWebContents } from './window.js'

const { autoUpdater } = electronUpdater

let inited = false
let lastStatus: AutoUpdateStatusPayload = { phase: 'idle' }

function pushToShell(): void {
  const shell = getChromeWebContents()
  if (!shell || shell.isDestroyed()) return
  shell.send(IPC.autoUpdateStatus, lastStatus)
}

function setStatus(next: AutoUpdateStatusPayload): void {
  lastStatus = next
  pushToShell()
}

export function getAutoUpdateStatus(): AutoUpdateStatusPayload {
  return lastStatus
}

export function checkForUpdatesNow(): void {
  if (!app.isPackaged) return
  void autoUpdater.checkForUpdates()
}

export function quitAndInstallUpdate(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall(false, true)
}

/** Call once after the main window (and shell WebContents) exists. */
export function initVeloAutoUpdater(): void {
  if (inited) return
  inited = true

  if (!app.isPackaged) {
    setStatus({ phase: 'dev' })
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setStatus({ phase: 'checking' }))
  autoUpdater.on('update-not-available', () => setStatus({ phase: 'idle' }))
  autoUpdater.on('update-available', (info) => setStatus({ phase: 'available', version: info.version }))
  autoUpdater.on('download-progress', (p) =>
    setStatus({
      phase: 'downloading',
      percent: Math.round(p.percent),
      transferred: p.transferred,
      total: p.total
    })
  )
  autoUpdater.on('update-downloaded', (info) => setStatus({ phase: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) => setStatus({ phase: 'error', message: err.message }))

  setTimeout(() => {
    void autoUpdater.checkForUpdates()
  }, 12_000)

  setInterval(() => {
    void autoUpdater.checkForUpdates()
  }, 4 * 60 * 60 * 1000)
}
