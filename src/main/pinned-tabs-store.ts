import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const MAX_PINNED = 24

let cache: string[] | null = null

function storePath(): string {
  return join(app.getPath('userData'), 'data', 'pinned-tabs.json')
}

export function isPinnableUrl(raw: string): boolean {
  const u = raw.trim()
  if (!u) return false
  try {
    const p = new URL(u).protocol.toLowerCase()
    return p === 'http:' || p === 'https:'
  } catch {
    return false
  }
}

export function readPinnedTabs(): string[] {
  if (cache) return [...cache]
  try {
    const raw = readFileSync(storePath(), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      cache = parsed
        .filter((u): u is string => typeof u === 'string')
        .map((u) => u.trim())
        .filter(isPinnableUrl)
        .slice(0, MAX_PINNED)
      return [...cache]
    }
  } catch {}
  cache = []
  return []
}

export function writePinnedTabs(urls: string[]): void {
  const next = urls
    .map((u) => u.trim())
    .filter(isPinnableUrl)
    .slice(0, MAX_PINNED)
  cache = next
  try {
    const path = storePath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(next, null, 2), 'utf8')
  } catch (err) {
    console.warn('[velo] pinned tabs persist failed', err)
  }
}
