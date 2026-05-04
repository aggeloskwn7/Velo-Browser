import { safeStorage, app } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as vault from './password-vault.js'

function deviceKeyPath(): string {
  return join(app.getPath('userData'), 'password-vault-device-key.bin')
}

export function deviceWrappedPassphraseFileExists(): boolean {
  return existsSync(deviceKeyPath())
}

export function clearDeviceWrappedPassphrase(): void {
  try {
    const p = deviceKeyPath()
    if (existsSync(p)) unlinkSync(p)
  } catch {}
}

export function saveDeviceWrappedPassphrase(passphrase: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is not available; cannot remember unlock on this device.')
  }
  const enc = safeStorage.encryptString(passphrase)
  writeFileSync(deviceKeyPath(), enc)
}


export function tryAutoUnlockVaultFromDeviceSetting(rememberDevice: boolean): void {
  if (!rememberDevice) return
  if (!vault.vaultFileExists() || vault.isUnlocked()) return
  const p = deviceKeyPath()
  if (!existsSync(p)) return
  if (!safeStorage.isEncryptionAvailable()) return
  try {
    const enc = readFileSync(p)
    const phrase = safeStorage.decryptString(enc)
    vault.unlock(phrase)
  } catch (err) {
    console.warn('[velo] auto-unlock vault failed', err)
    clearDeviceWrappedPassphrase()
  }
}
