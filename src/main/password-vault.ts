import { app } from 'electron'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MAGIC = Buffer.from('VLPW')
const VERSION = 1
const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 32
const AAD = Buffer.from('velo-pwm-v1', 'utf8')


const IDLE_LOCK_MS = 15 * 60 * 1000

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

let lastActivity = 0
let idleTimer: ReturnType<typeof setInterval> | null = null
let entriesCache: PasswordVaultEntry[] | null = null

let sessionKey: Buffer | null = null

function vaultPath(): string {
  return join(app.getPath('userData'), 'passwords.vault')
}

function resetIdleTimer(): void {
  lastActivity = Date.now()
}

function startIdleWatcher(): void {
  if (idleTimer != null) return
  idleTimer = setInterval(() => {
    if (entriesCache == null || sessionKey == null) return
    if (Date.now() - lastActivity >= IDLE_LOCK_MS) {
      lock()
    }
  }, 30_000)
}

function stopIdleWatcher(): void {
  if (idleTimer != null) {
    clearInterval(idleTimer)
    idleTimer = null
  }
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

function touch(): void {
  resetIdleTimer()
}

export function vaultFileExists(): boolean {
  return existsSync(vaultPath())
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
  stopIdleWatcher()
}

function persist(): void {
  if (!sessionKey || !entriesCache) throw new Error('vault locked')
  touch()
  const raw = readFileSync(vaultPath())
  if (raw.length < MAGIC.length + 1 + SALT_LEN) throw new Error('vault truncated')
  const salt = Buffer.from(raw.subarray(5, 5 + SALT_LEN))
  const plain: VaultPlain = { entries: entriesCache }
  const body = JSON.stringify(plain)
  const inner = encryptBlob(sessionKey, body)
  const out = Buffer.alloc(MAGIC.length + 1 + SALT_LEN + inner.length)
  MAGIC.copy(out, 0)
  out[MAGIC.length] = VERSION
  salt.copy(out, MAGIC.length + 1)
  inner.copy(out, MAGIC.length + 1 + SALT_LEN)
  writeFileSync(vaultPath(), out)
}

export function createVault(passphrase: string): void {
  if (vaultFileExists()) throw new Error('vault already exists')
  if (passphrase.length < 4) throw new Error('passphrase too short')
  lock()
  const salt = randomBytes(SALT_LEN)
  const key = deriveKey(passphrase, salt)
  try {
    const plain: VaultPlain = { entries: [] }
    const body = JSON.stringify(plain)
    const inner = encryptBlob(key, body)
    const out = Buffer.alloc(MAGIC.length + 1 + SALT_LEN + inner.length)
    MAGIC.copy(out, 0)
    out[MAGIC.length] = VERSION
    salt.copy(out, MAGIC.length + 1)
    inner.copy(out, MAGIC.length + 1 + SALT_LEN)
    writeFileSync(vaultPath(), out)
  } finally {
    key.fill(0)
  }
  unlock(passphrase)
}

export function unlock(passphrase: string): void {
  if (!vaultFileExists()) throw new Error('no vault')
  const raw = readFileSync(vaultPath())
  if (raw.length < MAGIC.length + 1 + SALT_LEN + IV_LEN + TAG_LEN) {
    throw new Error('invalid vault file')
  }
  if (!raw.subarray(0, 4).equals(MAGIC)) throw new Error('bad magic')
  if (raw[4] !== VERSION) throw new Error('unsupported version')
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
  const parsed = JSON.parse(plain) as VaultPlain
  if (!parsed || !Array.isArray(parsed.entries)) {
    key.fill(0)
    throw new Error('corrupt vault')
  }
  lock()
  sessionKey = key
  entriesCache = parsed.entries.map(normalizeEntry)
  resetIdleTimer()
  startIdleWatcher()
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
  touch()
  return entriesCache.map((e) => ({ ...e }))
}

export function getForDomain(domain: string): PasswordVaultEntry[] {
  if (!entriesCache) return []
  touch()
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
  touch()
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
  touch()
  const i = entriesCache.findIndex((e) => e.id === id)
  if (i === -1) return
  entriesCache.splice(i, 1)
  persist()
}


export function importRows(rows: Array<{ domain: string; username: string; password: string }>): number {
  if (!entriesCache || !sessionKey) throw new Error('vault locked')
  touch()
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
