import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { app, shell } from 'electron'
import { z } from 'zod'
import type { DownloadEntry } from '../shared/ipc.js'
import type { DownloadItem } from 'electron'

const items: DownloadEntry[] = []
const MAX_ITEMS = 200

const itemByEntryId = new Map<string, DownloadItem>()

let onListUpdated: (() => void) | null = null

let dataPath: string | null = null
let initDone = false
let persistTimer: ReturnType<typeof setTimeout> | null = null
const PERSIST_DEBOUNCE_MS = 400

function getStorePath(): string {
  if (!dataPath) {
    dataPath = join(app.getPath('userData'), 'data', 'downloads.json')
  }
  return dataPath
}

const downloadEntrySchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  path: z.string(),
  sourceUrl: z.string().optional(),
  state: z.enum(['progressing', 'completed', 'cancelled', 'interrupted']),
  receivedBytes: z.number(),
  totalBytes: z.number(),
  startedAt: z.number(),
  fileRemovedFromDisk: z.boolean().optional()
})

function normalizeLoadedEntry(e: DownloadEntry): DownloadEntry {
  if (e.state === 'progressing') {
    return { ...e, state: 'interrupted' }
  }
  return e
}

export async function initDownloadsStore(): Promise<void> {
  if (initDone) return
  const path = getStorePath()
  try {
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    const arr = z.array(downloadEntrySchema).safeParse(parsed)
    if (arr.success) {
      const normalized = arr.data.map((e) => normalizeLoadedEntry(e as DownloadEntry)).slice(0, MAX_ITEMS)
      items.push(...normalized)
    }
  } catch {}
  initDone = true
}

function persistToDiskSync(): void {
  const path = getStorePath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(items, null, 2), 'utf-8')
  } catch (err) {
    console.error('[velo] downloads persist failed', err)
  }
}

async function persistToDisk(): Promise<void> {
  const path = getStorePath()
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(items, null, 2), 'utf-8')
  } catch (err) {
    console.error('[velo] downloads persist failed', err)
  }
}

function schedulePersist(): void {
  if (!initDone) return
  if (persistTimer != null) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persistToDisk()
  }, PERSIST_DEBOUNCE_MS)
}


export function flushDownloadsToDisk(): void {
  if (persistTimer != null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (!initDone) return
  persistToDiskSync()
}

export function setDownloadsListListener(fn: (() => void) | null): void {
  onListUpdated = fn
}

function emitUpdated(): void {
  onListUpdated?.()
  schedulePersist()
}

function cancelInProgressDownload(id: string): boolean {
  const item = itemByEntryId.get(id)
  if (!item) return false
  const st = item.getState()
  if (st === 'completed' || st === 'cancelled') return false
  item.cancel()
  return true
}

function deleteSavedFileForEntry(id: string): void {
  const i = items.findIndex((x) => x.id === id)
  if (i < 0) return
  const e = items[i]
  if (e.fileRemovedFromDisk || e.state !== 'completed') return
  try {
    if (e.path && existsSync(e.path)) unlinkSync(e.path)
  } catch {}
  items[i] = { ...e, fileRemovedFromDisk: true }
  emitUpdated()
}


export function applyUserDownloadAction(id: string): void {
  const e = items.find((x) => x.id === id)
  if (!e || e.fileRemovedFromDisk) return
  if (e.state === 'progressing') {
    cancelInProgressDownload(id)
    return
  }
  if (e.state === 'completed') {
    deleteSavedFileForEntry(id)
  }
}

function pathAndFilenameFromItem(item: DownloadItem): { path: string; filename: string } | null {
  const p = item.getSavePath()
  if (!p) return null
  return { path: p, filename: basename(p) }
}


export async function openDownloadFile(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const e = items.find((x) => x.id === id)
  if (!e) return { ok: false, message: 'Download not found.' }
  if (e.fileRemovedFromDisk) return { ok: false, message: 'File was removed from disk.' }
  if (e.state !== 'completed') return { ok: false, message: 'Download is not finished yet.' }
  if (!e.path || !existsSync(e.path)) return { ok: false, message: 'File is no longer on disk.' }
  const err = await shell.openPath(e.path)
  if (err && err.length > 0) return { ok: false, message: err }
  return { ok: true }
}

export function trackDownload(item: DownloadItem): void {
  const id = randomUUID()
  const savePath = item.getSavePath()
  const entry: DownloadEntry = {
    id,
    filename: savePath ? basename(savePath) : item.getFilename(),
    path: savePath,
    sourceUrl: item.getURL(),
    state: 'progressing',
    receivedBytes: item.getReceivedBytes(),
    totalBytes: item.getTotalBytes(),
    startedAt: Date.now()
  }
  items.unshift(entry)
  if (items.length > MAX_ITEMS) items.length = MAX_ITEMS
  itemByEntryId.set(id, item)
  emitUpdated()

  const patch = (partial: Partial<DownloadEntry>): void => {
    const i = items.findIndex((x) => x.id === id)
    if (i >= 0) items[i] = { ...items[i], ...partial }
  }

  let progressEmitTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleProgressEmit = (): void => {
    if (progressEmitTimer != null) return
    progressEmitTimer = setTimeout(() => {
      progressEmitTimer = null
      emitUpdated()
    }, 100)
  }

  item.on('updated', () => {
    const st = item.getState()
    const state: DownloadEntry['state'] =
      st === 'completed'
        ? 'completed'
        : st === 'cancelled'
          ? 'cancelled'
          : st === 'interrupted'
            ? 'interrupted'
            : 'progressing'
    const loc = pathAndFilenameFromItem(item)
    patch({
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      state,
      ...(loc ? { path: loc.path, filename: loc.filename } : {})
    })
    if (state === 'progressing') scheduleProgressEmit()
    else emitUpdated()
  })

  item.once('done', (_event, state) => {
    itemByEntryId.delete(id)
    const st =
      state === 'completed'
        ? 'completed'
        : state === 'cancelled'
          ? 'cancelled'
          : 'interrupted'
    const loc = pathAndFilenameFromItem(item)
    const i = items.findIndex((x) => x.id === id)
    const prev = i >= 0 ? items[i] : null
    patch({
      state: st,
      path: loc?.path ?? prev?.path ?? '',
      filename: loc?.filename ?? prev?.filename ?? item.getFilename(),
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes()
    })
    emitUpdated()
  })
}

export function listDownloads(): DownloadEntry[] {
  return [...items]
}

export function removeDownload(id: string): boolean {
  const i = items.findIndex((x) => x.id === id)
  if (i < 0) return false
  items.splice(i, 1)
  emitUpdated()
  return true
}
