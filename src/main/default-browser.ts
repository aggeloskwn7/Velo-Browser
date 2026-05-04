import { app, shell } from 'electron'
import { spawn } from 'node:child_process'
import type { DefaultBrowserOpenSettingsPage } from '../shared/ipc.js'
import { VELO_WINDOWS_REGISTERED_APPLICATIONS_NAME } from '../shared/constants.js'
import { registerVeloWindowsDefaultProgramsRegistration } from './windows-browser-capabilities.js'

const pendingExternalUrls: string[] = []

const VELO_CAPABILITIES_DESCRIPTION = 'Velo'

export function extractHttpUrlFromArgv(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (/^https?:\/\//i.test(arg)) return arg
  }
  return null
}

export function offerExternalHttpUrl(url: string): void {
  if (!/^https?:\/\//i.test(url)) return
  pendingExternalUrls.push(url)
}

export function flushPendingExternalUrls(open: (url: string) => void): void {
  while (pendingExternalUrls.length > 0) {
    const u = pendingExternalUrls.shift()
    if (u) open(u)
  }
}

export function getDefaultBrowserStatus(): {
  isPackaged: boolean
  http: boolean
  https: boolean
  isDefault: boolean
} {
  let http = false
  let https = false
  try {
    http = app.isDefaultProtocolClient('http')
    https = app.isDefaultProtocolClient('https')
  } catch {
    /* ignore */
  }
  return {
    isPackaged: app.isPackaged,
    http,
    https,
    isDefault: http && https
  }
}

export async function registerVeloAsDefaultBrowser(): Promise<{
  ok: boolean
  http: boolean
  https: boolean
  message?: string
}> {
  if (!app.isPackaged) {
    return {
      ok: false,
      http: false,
      https: false,
      message: 'Install Velo from a release or installer first. Dev mode uses the Electron binary, which must not become the system default.'
    }
  }
  if (process.platform === 'win32') {
    try {
      await registerVeloWindowsDefaultProgramsRegistration(
        process.execPath,
        app.getName(),
        VELO_CAPABILITIES_DESCRIPTION
      )
    } catch (e) {
      return {
        ok: false,
        http: false,
        https: false,
        message:
          e instanceof Error
            ? `Could not register Velo with Windows: ${e.message}`
            : String(e)
      }
    }
  }
  let http = false
  let https = false
  try {
    http = app.setAsDefaultProtocolClient('http')
    https = app.setAsDefaultProtocolClient('https')
  } catch (e) {
    return {
      ok: false,
      http,
      https,
      message: e instanceof Error ? e.message : String(e)
    }
  }
  if (!http || !https) {
    return {
      ok: false,
      http,
      https,
      message:
        'Registration did not fully succeed. Use “Open system settings” and choose Velo as the default browser for HTTP and HTTPS.'
    }
  }
  return { ok: true, http: true, https: true }
}

/** Register with the OS, then open the system UI to confirm or finish (e.g. Windows Default apps for Velo). */
export async function registerVeloAsDefaultBrowserAndOpenSystemSettings(): Promise<{
  ok: boolean
  http: boolean
  https: boolean
  message?: string
}> {
  const registration = await registerVeloAsDefaultBrowser()
  openSystemDefaultBrowserSettings()
  return registration
}

function spawnDetached(cmd: string, args: readonly string[]): void {
  try {
    const p = spawn(cmd, [...args], { detached: true, stdio: 'ignore' })
    p.unref()
  } catch {
    /* ignore */
  }
}

/**
 * Windows 11: `registeredAppUser` must match the value name under
 * HKCU\Software\RegisteredApplications (see VELO_WINDOWS_REGISTERED_APPLICATIONS_NAME).
 * Older builds may ignore the query and open “Default apps” only — still usable.
 */
export function openSystemDefaultBrowserSettings(_page?: DefaultBrowserOpenSettingsPage): void {
  if (process.platform === 'win32') {
    setImmediate(() => {
      const q = encodeURIComponent(VELO_WINDOWS_REGISTERED_APPLICATIONS_NAME)
      void shell.openExternal(`ms-settings:defaultapps?registeredAppUser=${q}`)
    })
    return
  }
  if (process.platform === 'darwin') {
    setImmediate(() => {
      void shell.openExternal('x-apple.systempreferences:com.apple.Desktop-Settings.extension')
    })
    return
  }
  const desk = process.env['XDG_CURRENT_DESKTOP']?.toUpperCase() ?? ''
  if (desk.includes('GNOME') || desk.includes('COSMIC') || desk.includes('UBUNTU')) {
    spawnDetached('gnome-control-center', ['default-apps'])
    return
  }
  if (desk.includes('KDE')) {
    spawnDetached('systemsettings5', ['kcm_defaultapplications'])
    return
  }
  spawnDetached('gnome-control-center', ['default-apps'])
}
