import { app } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { TabSnapshot } from '../shared/ipc.js'

const FILE_VERSION = 1 as const
const FILE_NAME = 'last-browsing-session.json'
const MAX_SESSION_TABS = 80

export type LastBrowsingSessionV1 = {
  version: typeof FILE_VERSION
  tabs: string[]
  activeIndex: number
}

export type TabSessionPersistSource = {
  getSnapshots(): TabSnapshot[]
  getActiveTabId(): number | null
}

export type TabRestoreTarget = TabSessionPersistSource & {
  createTab(url?: string): number
  setActiveTab(tabId: number): void
}

function sessionFilePath(): string {
  return join(app.getPath('userData'), 'data', FILE_NAME)
}

function isRestorableUrl(raw: string): boolean {
  const u = raw.trim()
  if (!u) return false
  const lower = u.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('chrome:')) {
    return false
  }
  try {
    const parsed = new URL(u)
    const p = parsed.protocol.toLowerCase()
    return p === 'http:' || p === 'https:' || p === 'velo:' || p === 'file:'
  } catch {
    return false
  }
}

function filterSnapshots(snapshots: TabSnapshot[]): TabSnapshot[] {
  return snapshots.filter((s) => isRestorableUrl(s.url)).slice(0, MAX_SESSION_TABS)
}

function buildPayload(snapshots: TabSnapshot[], activeId: number | null): LastBrowsingSessionV1 {
  const filtered = filterSnapshots(snapshots)
  const tabs = filtered.map((s) => s.url.trim())
  let activeIndex = 0
  if (activeId != null && filtered.length > 0) {
    const idx = filtered.findIndex((s) => s.id === activeId)
    if (idx >= 0) activeIndex = idx
  }
  if (filtered.length > 0) {
    activeIndex = Math.min(Math.max(0, activeIndex), filtered.length - 1)
  }
  return { version: FILE_VERSION, tabs, activeIndex }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

export function cancelBrowsingSessionPersist(): void {
  if (persistTimer != null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
}


export function scheduleBrowsingSessionPersist(src: TabSessionPersistSource): void {
  if (persistTimer != null) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    void flushBrowsingSessionAsync(src)
  }, 650)
}

async function flushBrowsingSessionAsync(src: TabSessionPersistSource): Promise<void> {
  try {
    const dir = dirname(sessionFilePath())
    await mkdir(dir, { recursive: true })
    const payload = buildPayload(src.getSnapshots(), src.getActiveTabId())
    await writeFile(sessionFilePath(), JSON.stringify(payload), 'utf8')
  } catch (e) {
    console.warn('[velo session] async persist failed', e)
  }
}


export function flushBrowsingSessionSync(src: TabSessionPersistSource): void {
  try {
    const dir = dirname(sessionFilePath())
    mkdirSync(dir, { recursive: true })
    const payload = buildPayload(src.getSnapshots(), src.getActiveTabId())
    writeFileSync(sessionFilePath(), JSON.stringify(payload), 'utf8')
  } catch (e) {
    console.warn('[velo session] sync flush failed', e)
  }
}

export function readLastBrowsingSession(): LastBrowsingSessionV1 | null {
  try {
    const raw = readFileSync(sessionFilePath(), 'utf8')
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return null
    const rec = data as Record<string, unknown>
    if (rec['version'] !== FILE_VERSION) return null
    if (!Array.isArray(rec['tabs'])) return null
    const tabs = (rec['tabs'] as unknown[])
      .filter((x): x is string => typeof x === 'string')
      .map((t) => t.trim())
      .filter(isRestorableUrl)
      .slice(0, MAX_SESSION_TABS)
    const rawIdx = rec['activeIndex']
    const activeIndex =
      typeof rawIdx === 'number' && Number.isFinite(rawIdx) ? Math.max(0, Math.floor(rawIdx)) : 0
    if (tabs.length === 0) return null
    return {
      version: FILE_VERSION,
      tabs,
      activeIndex: Math.min(activeIndex, tabs.length - 1)
    }
  } catch {
    return null
  }
}

export function restoreTabsIntoManager(mgr: TabRestoreTarget, session: LastBrowsingSessionV1): void {
  const tabs = session.tabs.filter(isRestorableUrl)
  if (tabs.length === 0) {
    mgr.createTab('velo://newtab')
    return
  }
  for (const url of tabs) {
    mgr.createTab(url)
  }
  const snaps = mgr.getSnapshots()
  const idx = Math.min(Math.max(0, session.activeIndex), snaps.length - 1)
  const id = snaps[idx]?.id
  if (id != null) mgr.setActiveTab(id)
}
