import { app, safeStorage } from 'electron'
import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MAGIC = Buffer.from('VLPW')
const VERSION_V1 = 1
const VERSION_V2 = 2
const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 32
const AAD = Buffer.from('velo-pwm-v1', 'utf8')

export type PasswordVaultEntry = {
  id: string
  domain: string
  username: string
  password: string
  createdAt: number
  updatedAt: number
}

type VaultPlain = {
  entries: PasswordVaultEntry[]
}

let entriesCache: PasswordVaultEntry[] | null = null
let sessionKey: Buffer | null = null

function vaultPath(): string {
  return join(app.getPath('userData'), 'passwords.vault')
}

function dekPath(): string {
  return join(app.getPath('userData'), 'password-vault-dek.bin')
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024
  })
}

function encryptBlob(key: Buffer, plain: string): Buffer {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LEN })
  cipher.setAAD(AAD)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc])
}

function decryptBlob(key: Buffer, blob: Buffer): string {
  if (blob.length < IV_LEN + TAG_LEN) throw new Error('truncated vault')
  const iv = blob.subarray(0, IV_LEN)
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const data = blob.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LEN })
  decipher.setAAD(AAD)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/** File on disk exists (v1 or v2). */
export function vaultFileExists(): boolean {
  return existsSync(vaultPath())
}

/** OS-bound encryption available (required for v2). */
export function isOsKeyStorageAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function readFileVersion(): number | null {
  if (!vaultFileExists()) return null
  const raw = readFileSync(vaultPath())
  if (raw.length < MAGIC.length + 1 || !raw.subarray(0, 4).equals(MAGIC)) return null
  const v = raw[4]
  return v === VERSION_V1 || v === VERSION_V2 ? v : null
}

/** Legacy passphrase vault on disk needs one-time migration. */
export function vaultNeedsMigration(): boolean {
  return readFileVersion() === VERSION_V1
}

export function vaultIsVersion2(): boolean {
  return readFileVersion() === VERSION_V2
}

export function isUnlocked(): boolean {
  return entriesCache != null && sessionKey != null
}

export function lock(): void {
  entriesCache = null
  if (sessionKey != null) {
    sessionKey.fill(0)
    sessionKey = null
  }
}

function writeV2File(inner: Buffer): void {
  const out = Buffer.alloc(MAGIC.length + 1 + inner.length)
  MAGIC.copy(out, 0)
  out[MAGIC.length] = VERSION_V2
  inner.copy(out, MAGIC.length + 1)
  writeFileSync(vaultPath(), out)
}

function persist(): void {
  if (!sessionKey || !entriesCache) throw new Error('vault locked')
  const plain: VaultPlain = { entries: entriesCache }
  const body = JSON.stringify(plain)
  const inner = encryptBlob(sessionKey, body)
  writeV2File(inner)
}

function loadV2(): void {
  if (!isOsKeyStorageAvailable()) throw new Error('OS secure storage is not available')
  if (!existsSync(dekPath())) throw new Error('missing vault key file')
  const raw = readFileSync(vaultPath())
  if (raw.length < MAGIC.length + 1 + IV_LEN + TAG_LEN || !raw.subarray(0, 4).equals(MAGIC)) {
    throw new Error('invalid vault file')
  }
  if (raw[4] !== VERSION_V2) throw new Error('not a v2 vault')
  const enc = raw.subarray(MAGIC.length + 1)
  const dekEnc = readFileSync(dekPath())
  const dekB64 = safeStorage.decryptString(dekEnc)
  const key = Buffer.from(dekB64, 'base64')
  if (key.length !== KEY_LEN) {
    key.fill(0)
    throw new Error('invalid vault key')
  }
  let plain: string
  try {
    plain = decryptBlob(key, enc)
  } catch {
    key.fill(0)
    throw new Error('corrupt vault')
  }
  const parsed = JSON.parse(plain) as VaultPlain
  if (!parsed || !Array.isArray(parsed.entries)) {
    key.fill(0)
    throw new Error('corrupt vault')
  }
  lock()
  sessionKey = key
  entriesCache = parsed.entries.map(normalizeEntry)
}

function createEmptyV2(): void {
  if (!isOsKeyStorageAvailable()) throw new Error('OS secure storage is not available')
  lock()
  const dek = randomBytes(KEY_LEN)
  try {
    writeFileSync(dekPath(), safeStorage.encryptString(dek.toString('base64')))
    sessionKey = dek
    entriesCache = []
    persist()
  } catch (e) {
    lock()
    throw e
  }
}

export function ensureVaultReady(): void {
  if (!vaultFileExists()) {
    if (!isOsKeyStorageAvailable()) return
    createEmptyV2()
    return
  }
  const ver = readFileVersion()
  if (ver === VERSION_V1) return
  if (ver === VERSION_V2) {
    if (!isOsKeyStorageAvailable()) return
    if (isUnlocked()) return
    loadV2()
  }
}

export function shutdownVaultSession(): void {
  lock()
}

function readV1EntriesWithPassphrase(passphrase: string): PasswordVaultEntry[] {
  const raw = readFileSync(vaultPath())
  if (raw.length < MAGIC.length + 1 + SALT_LEN + IV_LEN + TAG_LEN) throw new Error('invalid vault file')
  if (!raw.subarray(0, 4).equals(MAGIC)) throw new Error('bad magic')
  if (raw[4] !== VERSION_V1) throw new Error('not a v1 vault')
  const salt = raw.subarray(5, 5 + SALT_LEN)
  const enc = raw.subarray(5 + SALT_LEN)
  const key = deriveKey(passphrase, salt)
  let plain: string
  try {
    plain = decryptBlob(key, enc)
  } catch {
    key.fill(0)
    throw new Error('wrong passphrase')
  }
  key.fill(0)
  const parsed = JSON.parse(plain) as VaultPlain
  if (!parsed || !Array.isArray(parsed.entries)) throw new Error('corrupt vault')
  return parsed.entries.map(normalizeEntry)
}

export function migrateFromV1Passphrase(passphrase: string): void {
  if (!isOsKeyStorageAvailable()) {
    throw new Error('OS secure storage is not available; cannot migrate on this device.')
  }
  if (!vaultNeedsMigration()) {
    throw new Error('no migration needed')
  }
  const entries = readV1EntriesWithPassphrase(passphrase)
  lock()
  const dek = randomBytes(KEY_LEN)
  try {
    writeFileSync(dekPath(), safeStorage.encryptString(dek.toString('base64')))
    sessionKey = dek
    entriesCache = entries
    persist()
  } catch (e) {
    lock()
    throw e
  }
}

function normalizeEntry(e: PasswordVaultEntry): PasswordVaultEntry {
  return {
    id: e.id,
    domain: String(e.domain),
    username: String(e.username),
    password: String(e.password),
    createdAt: Number(e.createdAt) || Date.now(),
    updatedAt: Number(e.updatedAt) || Date.now()
  }
}

export function listEntries(): PasswordVaultEntry[] {
  if (!entriesCache) throw new Error('vault locked')
  return entriesCache.map((e) => ({ ...e }))
}

export function getForDomain(domain: string): PasswordVaultEntry[] {
  if (!entriesCache) return []
  const d = normalizeDomain(domain)
  return entriesCache.filter((e) => e.domain === d).map((e) => ({ ...e }))
}

export function normalizeDomain(host: string): string {
  let h = host.trim().toLowerCase()
  if (h.startsWith('www.')) h = h.slice(4)
  return h
}

export function addEntry(domain: string, username: string, password: string): PasswordVaultEntry {
  if (!entriesCache || !sessionKey) throw new Error('vault locked')
  const d = normalizeDomain(domain)
  const now = Date.now()
  const entry: PasswordVaultEntry = {
    id: randomUUID(),
    domain: d,
    username,
    password,
    createdAt: now,
    updatedAt: now
  }
  entriesCache.push(entry)
  persist()
  return { ...entry }
}

export function deleteEntry(id: string): void {
  if (!entriesCache || !sessionKey) throw new Error('vault locked')
  const i = entriesCache.findIndex((e) => e.id === id)
  if (i === -1) return
  entriesCache.splice(i, 1)
  persist()
}

export function deleteEntriesInRange(sinceMs: number | null): number {
  if (!entriesCache || !sessionKey) return 0
  if (sinceMs == null) {
    const removed = entriesCache.length
    entriesCache.length = 0
    persist()
    return removed
  }
  const before = entriesCache.length
  const kept = entriesCache.filter((e) => e.updatedAt < sinceMs)
  const removed = before - kept.length
  if (removed > 0) {
    entriesCache.length = 0
    entriesCache.push(...kept)
    persist()
  }
  return removed
}

export function importRows(rows: Array<{ domain: string; username: string; password: string }>): number {
  if (!entriesCache || !sessionKey) throw new Error('vault locked')
  const now = Date.now()
  let count = 0
  for (const row of rows) {
    const d = normalizeDomain(row.domain)
    const idx = entriesCache.findIndex((e) => e.domain === d && e.username === row.username)
    if (idx >= 0) {
      const cur = entriesCache[idx]!
      entriesCache[idx] = {
        ...cur,
        password: row.password,
        updatedAt: now
      }
    } else {
      entriesCache.push({
        id: randomUUID(),
        domain: d,
        username: row.username,
        password: row.password,
        createdAt: now,
        updatedAt: now
      })
    }
    count++
  }
  persist()
  return count
}

export function entryExists(domain: string, username: string, password: string): boolean {
  if (!entriesCache) return false
  const d = normalizeDomain(domain)
  const u = username.trim().toLowerCase()
  return entriesCache.some(
    (e) => e.domain === d && e.username.trim().toLowerCase() === u && e.password === password
  )
}
