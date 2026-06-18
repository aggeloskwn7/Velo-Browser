import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import type { HistoryEntry } from '../shared/ipc.js'

const MAX_ENTRIES = 5000

let cache: HistoryEntry[] | null = null
let dataPath: string | null = null

function getPath(): string {
  if (!dataPath) {
    dataPath = join(app.getPath('userData'), 'data', 'history.json')
  }
  return dataPath
}

async function load(): Promise<HistoryEntry[]> {
  if (cache) return cache
  const path = getPath()
  try {
    const raw = await readFile(path, 'utf-8')
    cache = JSON.parse(raw) as HistoryEntry[]
    return cache
  } catch {
    cache = []
    return cache
  }
}

async function persist(list: HistoryEntry[]): Promise<void> {
  const path = getPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(list, null, 2), 'utf-8')
  cache = list
}

export async function recordVisit(url: string, title: string): Promise<void> {
  if (url.startsWith('velo://')) return
  if (url.startsWith('data:')) return
  const list = await load()
  const entry: HistoryEntry = {
    id: randomUUID(),
    url,
    title: title || url,
    visitedAt: Date.now()
  }
  const next = [entry, ...list].slice(0, MAX_ENTRIES)
  await persist(next)
}

export async function listHistory(limit = 200): Promise<HistoryEntry[]> {
  const list = await load()
  return list.slice(0, limit)
}

export async function removeHistoryEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const idSet = new Set(ids)
  const list = await load()
  const next = list.filter((e) => !idSet.has(e.id))
  await persist(next)
}

export async function clearHistory(): Promise<void> {
  await persist([])
}

export async function removeHistoryInRange(sinceMs: number | null): Promise<number> {
  const list = await load()
  if (sinceMs == null) {
    const removed = list.length
    await persist([])
    return removed
  }
  const keep = list.filter((e) => e.visitedAt < sinceMs)
  const removed = list.length - keep.length
  if (removed > 0) await persist(keep)
  return removed
}

function normalizeImportHistoryUrl(url: string): string | null {
  const t = url.trim()
  if (!t) return null
  try {
    const u = new URL(t.startsWith('http:') || t.startsWith('https:') ? t : `https://${t.replace(/^\/+/, '')}`)
    if (u.protocol === 'velo:' || u.protocol === 'data:') return null
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}

export async function mergeHistoryFromImport(
  rows: { url: string; title: string; visitedAt: number }[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0
  const list = await load()
  const byUrl = new Map<string, HistoryEntry>()
  for (const e of list) {
    const n = normalizeImportHistoryUrl(e.url)
    if (n) byUrl.set(n, e)
  }

  rows.sort((a, b) => b.visitedAt - a.visitedAt)

  for (const r of rows) {
    const n = normalizeImportHistoryUrl(r.url)
    if (!n) {
      skipped++
      continue
    }
    const title = (r.title?.trim() || n).slice(0, 512)
    const vt = Number.isFinite(r.visitedAt)
      ? Math.min(Math.max(Math.floor(r.visitedAt), 0), Date.now())
      : Date.now()
    const existing = byUrl.get(n)
    if (existing) {
      const newerTime = Math.max(existing.visitedAt, vt)
      const newerTitle = vt >= existing.visitedAt ? title : existing.title
      if (newerTime > existing.visitedAt || newerTitle !== existing.title) {
        byUrl.set(n, {
          ...existing,
          title: newerTitle,
          visitedAt: newerTime
        })
        imported++
      } else {
        skipped++
      }
    } else {
      const entry: HistoryEntry = {
        id: randomUUID(),
        url: n,
        title,
        visitedAt: vt
      }
      byUrl.set(n, entry)
      imported++
    }
  }

  const next = [...byUrl.values()].sort((a, b) => b.visitedAt - a.visitedAt).slice(0, MAX_ENTRIES)
  await persist(next)
  return { imported, skipped }
}
