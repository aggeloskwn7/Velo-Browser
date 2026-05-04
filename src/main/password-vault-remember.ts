import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

function deviceKeyPath(): string {
  return join(app.getPath('userData'), 'password-vault-device-key.bin')
}

/** legacy file, do not delete tho */
export function clearDeviceWrappedPassphrase(): void {
  try {
    const p = deviceKeyPath()
    if (existsSync(p)) unlinkSync(p)
  } catch {}
}
