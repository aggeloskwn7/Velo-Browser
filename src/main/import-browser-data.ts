import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  type Dirent
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { app } from 'electron'
import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic } from 'sql.js'
import type {
  BrowserDataChromiumBrowserId,
  BrowserDataDetectSourcesPayload,
  BrowserDataImportChromiumResult,
  BrowserDataSource,
  BrowserDataSourceProfile,
  DownloadEntry
} from '../shared/ipc.js'
import { BROWSER_DATA_CHROMIUM_IDS } from '../shared/ipc.js'
import type { BookmarkImportRow } from './settings-store.js'
import * as history from './history-store.js'
import * as settings from './settings-store.js'
import * as downloads from './downloads-store.js'

const require = createRequire(import.meta.url)

let sqlJsPromise: Promise<SqlJsStatic> | null = null

function sqlJsLocateFile(file: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', file)
  }
  return join(dirname(require.resolve('sql.js/package.json')), 'dist', file)
}

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({ locateFile: sqlJsLocateFile })
  }
  return sqlJsPromise
}

function openSqliteFromPath(SQL: SqlJsStatic, filePath: string): Database {
  const buf = readFileSync(filePath)
  return new SQL.Database(new Uint8Array(buf))
}

const CHROME_EPOCH_MS = 11644473600000

export function chromeTimeToUnixMs(t: unknown): number {
  const n = typeof t === 'string' ? Number(t) : Number(t)
  if (!Number.isFinite(n) || n <= 0) return Date.now()
  return Math.floor(n / 1000 - CHROME_EPOCH_MS)
}

type ChromiumSourceConfig = {
  id: BrowserDataChromiumBrowserId
  displayName: string
  userDataSegments: string[]
  layout: 'multi-profile' | 'opera-root'
}

const CHROMIUM_SOURCE_CONFIGS: ChromiumSourceConfig[] = [
  {
    id: 'edge',
    displayName: 'Microsoft Edge',
    userDataSegments: ['AppData', 'Local', 'Microsoft', 'Edge', 'User Data'],
    layout: 'multi-profile'
  },
  {
    id: 'chrome',
    displayName: 'Google Chrome',
    userDataSegments: ['AppData', 'Local', 'Google', 'Chrome', 'User Data'],
    layout: 'multi-profile'
  },
  {
    id: 'brave',
    displayName: 'Brave',
    userDataSegments: ['AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data'],
    layout: 'multi-profile'
  },
  {
    id: 'opera',
    displayName: 'Opera',
    userDataSegments: ['AppData', 'Roaming', 'Opera Software', 'Opera Stable'],
    layout: 'opera-root'
  },
  {
    id: 'opera-gx',
    displayName: 'Opera GX',
    userDataSegments: ['AppData', 'Roaming', 'Opera Software', 'Opera GX Stable'],
    layout: 'opera-root'
  }
]

function homeRootPath(): string {
  return app.getPath('home')
}

function configUserDataRoot(cfg: ChromiumSourceConfig): string {
  return join(homeRootPath(), ...cfg.userDataSegments)
}

function sortProfileList(profiles: BrowserDataSourceProfile[]): void {
  profiles.sort((a, b) => {
    if (a.id === 'Default') return -1
    if (b.id === 'Default') return 1
    const m1 = /^Profile (\d+)$/.exec(a.id)
    const m2 = /^Profile (\d+)$/.exec(b.id)
    if (m1 && m2) return Number(m1[1]) - Number(m2[1])
    if (m1) return -1
    if (m2) return 1
    return a.id.localeCompare(b.id, undefined, { sensitivity: 'base' })
  })
}

function scanMultiProfileUserData(userDataRoot: string): BrowserDataSourceProfile[] {
  if (!existsSync(userDataRoot)) return []
  let entries: Dirent[]
  try {
    entries = readdirSync(userDataRoot, { withFileTypes: true }) as Dirent[]
  } catch {
    return []
  }
  const out: BrowserDataSourceProfile[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const id = e.name
    const profilePath = join(userDataRoot, id)
    const hasHistory = existsSync(join(profilePath, 'History'))
    const hasBookmarks = existsSync(join(profilePath, 'Bookmarks'))
    if (!hasHistory && !hasBookmarks) continue
    out.push({
      id,
      name: id,
      path: profilePath,
      hasHistory,
      hasBookmarks
    })
  }
  sortProfileList(out)
  return out
}

function scanOperaStyleRoot(root: string): BrowserDataSourceProfile[] {
  if (!existsSync(root)) return []
  const hasHistoryRoot = existsSync(join(root, 'History'))
  const hasBookmarksRoot = existsSync(join(root, 'Bookmarks'))
  if (hasHistoryRoot || hasBookmarksRoot) {
    return [
      {
        id: 'Default',
        name: 'Default',
        path: root,
        hasHistory: hasHistoryRoot,
        hasBookmarks: hasBookmarksRoot
      }
    ]
  }
  let entries: Dirent[]
  try {
    entries = readdirSync(root, { withFileTypes: true }) as Dirent[]
  } catch {
    return []
  }
  const nested: BrowserDataSourceProfile[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const id = e.name
    const profilePath = join(root, id)
    const hasHistory = existsSync(join(profilePath, 'History'))
    const hasBookmarks = existsSync(join(profilePath, 'Bookmarks'))
    if (!hasHistory && !hasBookmarks) continue
    nested.push({
      id,
      name: id,
      path: profilePath,
      hasHistory,
      hasBookmarks
    })
  }
  sortProfileList(nested)
  return nested
}

function detectOneSource(cfg: ChromiumSourceConfig): BrowserDataSource {
  if (process.platform !== 'win32') {
    return { id: cfg.id, displayName: cfg.displayName, available: false, profiles: [] }
  }
  const userDataRoot = configUserDataRoot(cfg)
  const profiles =
    cfg.layout === 'multi-profile' ? scanMultiProfileUserData(userDataRoot) : scanOperaStyleRoot(userDataRoot)
  return {
    id: cfg.id,
    displayName: cfg.displayName,
    available: profiles.length > 0,
    profiles
  }
}

export function detectChromiumSources(): BrowserDataDetectSourcesPayload {
  const sources = CHROMIUM_SOURCE_CONFIGS.map(detectOneSource)
  return { sources }
}

/**
 * Resolve a profile path for import by re-scanning disk. Renderer must only pass ids from
 * {@link detectChromiumSources}; paths are never taken from the renderer.
 */
export function resolveChromiumProfilePath(
  browserId: BrowserDataChromiumBrowserId,
  profileId: string
): BrowserDataSourceProfile | null {
  const cfg = CHROMIUM_SOURCE_CONFIGS.find((c) => c.id === browserId)
  if (!cfg) return null
  const source = detectOneSource(cfg)
  return source.profiles.find((p) => p.id === profileId) ?? null
}

/** @deprecated Use {@link detectChromiumSources}. Edge Default-folder probe only (legacy). */
export function detectEdgeDefaultProfile(): {
  edge: {
    available: boolean
    profilePath: string
    hasHistory: boolean
    hasBookmarks: boolean
  } | null
} {
  if (process.platform !== 'win32') {
    return { edge: null }
  }
  const profilePath = join(configUserDataRoot(CHROMIUM_SOURCE_CONFIGS[0]), 'Default')
  const hasHistory = existsSync(join(profilePath, 'History'))
  const hasBookmarks = existsSync(join(profilePath, 'Bookmarks'))
  return {
    edge: {
      available: hasHistory || hasBookmarks,
      profilePath,
      hasHistory,
      hasBookmarks
    }
  }
}

function copyLockedSqliteToTemp(src: string, label: string): string {
  const dir = join(app.getPath('userData'), 'import-temp')
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, `${label}-${randomUUID()}.sqlite`)
  copyFileSync(src, dest)
  return dest
}

function safeUnlink(p: string): void {
  try {
    unlinkSync(p)
  } catch {
    /* ignore */
  }
}

type UrlRow = {
  url: string
  title: string
  last_visit_time: number
  hidden?: number
}

type DownloadRow = {
  target_path: string | null
  current_path: string | null
  start_time: number
  received_bytes: number
  total_bytes: number
  state: number
}

function asRow(obj: Record<string, unknown>): UrlRow {
  return {
    url: typeof obj.url === 'string' ? obj.url : String(obj.url ?? ''),
    title: typeof obj.title === 'string' ? obj.title : String(obj.title ?? ''),
    last_visit_time: Number(obj.last_visit_time) || 0,
    hidden: obj.hidden != null ? Number(obj.hidden) : undefined
  }
}

function asDownloadRow(obj: Record<string, unknown>): DownloadRow {
  return {
    target_path: obj.target_path != null ? String(obj.target_path) : null,
    current_path: obj.current_path != null ? String(obj.current_path) : null,
    start_time: Number(obj.start_time) || 0,
    received_bytes: Number(obj.received_bytes) || 0,
    total_bytes: Number(obj.total_bytes) || 0,
    state: Number(obj.state) || 0
  }
}

export async function parseChromiumHistory(profilePath: string): Promise<{
  rows: { url: string; title: string; visitedAt: number }[]
  errors: string[]
}> {
  const errors: string[] = []
  const src = join(profilePath, 'History')
  if (!existsSync(src)) {
    return { rows: [], errors: ['History database not found.'] }
  }
  let tmp: string | null = null
  try {
    tmp = copyLockedSqliteToTemp(src, 'chromium-history')
  } catch {
    return {
      rows: [],
      errors: [
        'Could not copy the History database. Close the other browser and try again, or check that the profile is accessible.'
      ]
    }
  }
  const rows: { url: string; title: string; visitedAt: number }[] = []
  try {
    const SQL = await getSqlJs()
    const db = openSqliteFromPath(SQL, tmp)
    try {
      const stmt = db.prepare(`
        SELECT url, title, last_visit_time, hidden
        FROM urls
        WHERE IFNULL(hidden, 0) = 0
        ORDER BY last_visit_time DESC
        LIMIT 120000
      `)
      try {
        while (stmt.step()) {
          const raw = asRow(stmt.getAsObject() as Record<string, unknown>)
          if (!raw.url) continue
          rows.push({
            url: raw.url,
            title: raw.title,
            visitedAt: chromeTimeToUnixMs(raw.last_visit_time)
          })
        }
      } finally {
        stmt.free()
      }
    } finally {
      db.close()
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`Could not read history database: ${msg}`)
  } finally {
    if (tmp) safeUnlink(tmp)
  }
  return { rows, errors }
}

export async function parseChromiumDownloads(profilePath: string): Promise<{
  rows: Array<{
    filename: string
    path: string
    state: DownloadEntry['state']
    receivedBytes: number
    totalBytes: number
    startedAt: number
  }>
  errors: string[]
}> {
  const errors: string[] = []
  const src = join(profilePath, 'History')
  if (!existsSync(src)) {
    return { rows: [], errors: ['History database not found (downloads metadata lives there).'] }
  }
  let tmp: string | null = null
  try {
    tmp = copyLockedSqliteToTemp(src, 'chromium-downloads')
  } catch {
    return {
      rows: [],
      errors: ['Could not copy the History database for downloads. Close the other browser and try again.']
    }
  }
  const rows: Array<{
    filename: string
    path: string
    state: DownloadEntry['state']
    receivedBytes: number
    totalBytes: number
    startedAt: number
  }> = []
  try {
    const SQL = await getSqlJs()
    const db = openSqliteFromPath(SQL, tmp)
    try {
      const stmt = db.prepare(`
        SELECT target_path, current_path, start_time, received_bytes, total_bytes, state
        FROM downloads
        ORDER BY start_time DESC
        LIMIT 25000
      `)
      try {
        while (stmt.step()) {
          const raw = asDownloadRow(stmt.getAsObject() as Record<string, unknown>)
          const pathStr = (raw.target_path || raw.current_path || '').trim()
          if (!pathStr) continue
          rows.push({
            filename: basename(pathStr),
            path: pathStr,
            state: mapChromeDownloadState(
              Number(raw.state),
              Number(raw.received_bytes),
              Number(raw.total_bytes)
            ),
            receivedBytes: Math.max(0, Number(raw.received_bytes) || 0),
            totalBytes: Math.max(0, Number(raw.total_bytes) || 0),
            startedAt: chromeTimeToUnixMs(raw.start_time)
          })
        }
      } finally {
        stmt.free()
      }
    } finally {
      db.close()
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`Could not read downloads: ${msg}`)
  } finally {
    if (tmp) safeUnlink(tmp)
  }
  return { rows, errors }
}

function mapChromeDownloadState(state: number, received: number, total: number): DownloadEntry['state'] {
  if (state === 1) return 'completed'
  if (state === 2) return 'cancelled'
  if (state === 3 || state === 4) return 'interrupted'
  if (total > 0 && received >= total) return 'completed'
  if (total > 0 && received > 0 && received < total) return 'interrupted'
  if (received <= 0 && total <= 0) return 'cancelled'
  return 'interrupted'
}

type BookmarkJsonNode = {
  type?: string
  name?: string
  url?: string
  date_added?: string | number
  date_last_used?: string | number
  visit_count?: string | number
  children?: BookmarkJsonNode[]
}

function walkBookmarkNode(
  node: BookmarkJsonNode | undefined,
  folderPath: string[],
  out: BookmarkImportRow[]
): void {
  if (!node) return
  if (node.type === 'url' && typeof node.url === 'string') {
    let title = node.name
    if (!title) {
      try {
        title = new URL(node.url).hostname
      } catch {
        title = node.url
      }
    }
    out.push({
      title: title || node.url,
      url: node.url,
      folderPath: [...folderPath],
      createdAt: chromeTimeToUnixMs(node.date_added ?? 0)
    })
    return
  }
  if (node.type === 'folder' && Array.isArray(node.children)) {
    const nextPath = node.name ? [...folderPath, node.name] : [...folderPath]
    for (const child of node.children) {
      walkBookmarkNode(child, nextPath, out)
    }
  }
}

export function extractChromiumBookmarks(bookmarksJson: {
  roots?: Record<string, BookmarkJsonNode>
  data?: { roots?: Record<string, BookmarkJsonNode> }
}): BookmarkImportRow[] {
  const roots = bookmarksJson.roots ?? bookmarksJson.data?.roots ?? {}
  const out: BookmarkImportRow[] = []
  walkBookmarkNode(roots.bookmark_bar, ['Favorites bar'], out)
  walkBookmarkNode(roots.other, ['Other favorites'], out)
  walkBookmarkNode(roots.synced, ['Mobile favorites'], out)
  return out
}

export function parseChromiumBookmarks(profilePath: string): {
  rows: BookmarkImportRow[]
  errors: string[]
} {
  const p = join(profilePath, 'Bookmarks')
  if (!existsSync(p)) {
    return { rows: [], errors: ['Bookmarks file was not found.'] }
  }
  let raw: string
  try {
    raw = readFileSync(p, 'utf-8')
    if (raw.length > 0 && raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
  } catch {
    return { rows: [], errors: ['Could not read bookmarks file.'] }
  }
  try {
    const parsed = JSON.parse(raw) as Parameters<typeof extractChromiumBookmarks>[0]
    const rows = extractChromiumBookmarks(parsed)
    return { rows, errors: [] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { rows: [], errors: [`Could not parse bookmarks: ${msg}`] }
  }
}

/** @deprecated Use {@link parseChromiumHistory} */
export const importEdgeHistory = parseChromiumHistory
/** @deprecated Use {@link parseChromiumDownloads} */
export const importEdgeDownloads = parseChromiumDownloads
/** @deprecated Use {@link extractChromiumBookmarks} */
export const extractEdgeBookmarks = extractChromiumBookmarks
/** @deprecated Use {@link parseChromiumBookmarks} */
export const importEdgeBookmarks = parseChromiumBookmarks

export type ImportEdgeOptions = {
  history: boolean
  bookmarks: boolean
  downloads: boolean
}

export type ImportChromiumBrowserOptions = ImportEdgeOptions & {
  browserId: BrowserDataChromiumBrowserId
  profileId: string
}

export async function importFromChromiumBrowser(
  opts: ImportChromiumBrowserOptions
): Promise<BrowserDataImportChromiumResult> {
  const result: BrowserDataImportChromiumResult = {
    browserId: opts.browserId,
    imported: { history: 0, bookmarks: 0, downloads: 0 },
    skipped: { history: 0, bookmarks: 0, downloads: 0 },
    errors: []
  }

  if (process.platform !== 'win32') {
    result.errors.push('Chromium browser import is only supported on Windows in this version.')
    return result
  }

  if (!BROWSER_DATA_CHROMIUM_IDS.includes(opts.browserId)) {
    result.errors.push('Unknown browser.')
    return result
  }

  const profile = resolveChromiumProfilePath(opts.browserId, opts.profileId)
  if (!profile) {
    result.errors.push('That browser profile was not found. Refresh the page and try again.')
    return result
  }

  const profilePath = profile.path

  if (opts.history) {
    if (!profile.hasHistory) {
      result.errors.push('History was not found for this profile.')
    } else {
      const { rows, errors } = await parseChromiumHistory(profilePath)
      if (errors.length > 0) {
        result.errors.push(...errors)
      } else if (rows.length > 0) {
        const m = await history.mergeHistoryFromImport(rows)
        result.imported.history = m.imported
        result.skipped.history = m.skipped
      }
    }
  }

  if (opts.bookmarks) {
    if (!profile.hasBookmarks) {
      result.errors.push('Bookmarks were not found for this profile.')
    } else {
      const { rows, errors } = parseChromiumBookmarks(profilePath)
      if (errors.length > 0) {
        result.errors.push(...errors)
      } else if (rows.length > 0) {
        const m = settings.mergeBookmarksFromImport(rows)
        result.imported.bookmarks = m.imported
        result.skipped.bookmarks = m.skipped
      }
    }
  }

  if (opts.downloads) {
    if (!profile.hasHistory) {
      result.errors.push(
        'Downloads could not be read because the History database was not found (it stores download metadata).'
      )
    } else {
      const { rows, errors } = await parseChromiumDownloads(profilePath)
      if (errors.length > 0) {
        result.errors.push(...errors)
      } else if (rows.length > 0) {
        const m = downloads.mergeDownloadsFromImport(rows)
        result.imported.downloads = m.imported
        result.skipped.downloads = m.skipped
      }
    }
  }

  return result
}

/**
 * Import from Edge using the Default profile if present, otherwise the first detected profile.
 * Prefer {@link importFromChromiumBrowser} with explicit ids.
 */
export async function importFromEdge(opts: ImportEdgeOptions): Promise<BrowserDataImportChromiumResult> {
  const det = detectOneSource(CHROMIUM_SOURCE_CONFIGS[0])
  const prof = det.profiles.find((p) => p.id === 'Default') ?? det.profiles[0]
  if (!prof) {
    return {
      browserId: 'edge',
      imported: { history: 0, bookmarks: 0, downloads: 0 },
      skipped: { history: 0, bookmarks: 0, downloads: 0 },
      errors: ['Could not find a Microsoft Edge profile with history or bookmarks.']
    }
  }
  return importFromChromiumBrowser({ browserId: 'edge', profileId: prof.id, ...opts })
}
