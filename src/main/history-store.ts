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
