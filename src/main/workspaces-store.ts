import { app } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { readLastBrowsingSession, type LastBrowsingSessionV1 } from './last-session-store.js'
import { readPinnedTabs } from './pinned-tabs-store.js'

export const WORKSPACE_REGISTRY_VERSION = 1 as const
export const WORKSPACE_SESSION_VERSION = 1 as const
export const MAX_WORKSPACE_TABS = 80

import type { PersistedSplitSession } from './split-view.js'
import type { SplitPane } from './split-view.js'

export type PersistedTabEntry = {
  url: string
  pinned?: boolean
  muted?: boolean
  split?: PersistedSplitSession
}

export type WorkspaceSessionV1 = {
  version: typeof WORKSPACE_SESSION_VERSION
  tabs: PersistedTabEntry[]
  activeIndex: number
}

export type WorkspaceDefinition = {
  id: string
  name: string
  icon: string | null
  createdAt: number
}

export type WorkspacesRegistryV1 = {
  version: typeof WORKSPACE_REGISTRY_VERSION
  workspaceOrder: string[]
  activeWorkspaceId: string
  workspaces: WorkspaceDefinition[]
}

export const WORKSPACE_ICON_PRESETS = ['💻', '🎮', '📚', '🏠', '⭐'] as const

function dataDir(): string {
  return join(app.getPath('userData'), 'data')
}

function registryPath(): string {
  return join(dataDir(), 'workspaces.json')
}

function sessionPath(workspaceId: string): string {
  return join(dataDir(), 'workspaces', `${workspaceId}.json`)
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

export function generateWorkspaceId(): string {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export function defaultWorkspaceSession(): WorkspaceSessionV1 {
  return {
    version: WORKSPACE_SESSION_VERSION,
    tabs: [{ url: 'velo://newtab' }],
    activeIndex: 0
  }
}

function normalizePersistedSplit(raw: unknown): PersistedSplitSession | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const rec = raw as Record<string, unknown>
  const rightRaw = rec['right']
  if (!rightRaw || typeof rightRaw !== 'object') return undefined
  const rightRec = rightRaw as Record<string, unknown>
  const rightUrl = typeof rightRec['url'] === 'string' ? rightRec['url'].trim() : ''
  if (!isRestorableUrl(rightUrl)) return undefined
  const ratio = typeof rec['ratio'] === 'number' && Number.isFinite(rec['ratio']) ? rec['ratio'] : 0.5
  const fp = rec['focusedPane'] === 'right' ? 'right' : 'left'
  return {
    right: {
      url: rightUrl,
      pinned: rightRec['pinned'] === true,
      muted: rightRec['muted'] === true
    },
    ratio: Math.min(0.95, Math.max(0.05, ratio)),
    focusedPane: fp as SplitPane
  }
}

function normalizeSession(raw: unknown): WorkspaceSessionV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  if (rec['version'] !== WORKSPACE_SESSION_VERSION) return null
  if (!Array.isArray(rec['tabs'])) return null
  const tabs: PersistedTabEntry[] = []
  for (const item of rec['tabs'] as unknown[]) {
    if (typeof item === 'string') {
      const url = item.trim()
      if (isRestorableUrl(url)) tabs.push({ url })
      continue
    }
    if (item && typeof item === 'object') {
      const e = item as Record<string, unknown>
      const url = typeof e['url'] === 'string' ? e['url'].trim() : ''
      if (!isRestorableUrl(url)) continue
      tabs.push({
        url,
        pinned: e['pinned'] === true,
        muted: e['muted'] === true,
        split: normalizePersistedSplit(e['split'])
      })
    }
  }
  const limited = tabs.slice(0, MAX_WORKSPACE_TABS)
  if (limited.length === 0) return null
  const rawIdx = rec['activeIndex']
  const activeIndex =
    typeof rawIdx === 'number' && Number.isFinite(rawIdx) ? Math.max(0, Math.floor(rawIdx)) : 0
  return {
    version: WORKSPACE_SESSION_VERSION,
    tabs: limited,
    activeIndex: Math.min(activeIndex, limited.length - 1)
  }
}

export function readWorkspaceSession(workspaceId: string): WorkspaceSessionV1 | null {
  try {
    const raw = readFileSync(sessionPath(workspaceId), 'utf8')
    return normalizeSession(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export async function writeWorkspaceSessionAsync(
  workspaceId: string,
  session: WorkspaceSessionV1
): Promise<void> {
  const path = sessionPath(workspaceId)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(session), 'utf8')
}

export function writeWorkspaceSessionSync(workspaceId: string, session: WorkspaceSessionV1): void {
  try {
    const path = sessionPath(workspaceId)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(session), 'utf8')
  } catch (e) {
    console.warn('[velo workspaces] session persist failed', workspaceId, e)
  }
}

function legacySessionToWorkspace(session: LastBrowsingSessionV1, pinnedUrls: string[]): WorkspaceSessionV1 {
  const pinnedSet = new Set(pinnedUrls.map((u) => u.trim()))
  const tabs: PersistedTabEntry[] = []
  for (const url of session.tabs) {
    const t = url.trim()
    if (!isRestorableUrl(t)) continue
    tabs.push({ url: t, pinned: pinnedSet.has(t) })
  }
  for (const url of pinnedUrls) {
    const t = url.trim()
    if (!isRestorableUrl(t)) continue
    if (tabs.some((x) => x.url === t)) continue
    tabs.unshift({ url: t, pinned: true })
  }
  if (tabs.length === 0) return defaultWorkspaceSession()
  let activeIndex = Math.min(Math.max(0, session.activeIndex), tabs.length - 1)
  const activeUrl = session.tabs[session.activeIndex]?.trim()
  if (activeUrl) {
    const idx = tabs.findIndex((t) => t.url === activeUrl)
    if (idx >= 0) activeIndex = idx
  }
  return {
    version: WORKSPACE_SESSION_VERSION,
    tabs: tabs.slice(0, MAX_WORKSPACE_TABS),
    activeIndex
  }
}

function buildDefaultRegistry(): WorkspacesRegistryV1 {
  const id = generateWorkspaceId()
  const now = Date.now()
  return {
    version: WORKSPACE_REGISTRY_VERSION,
    workspaceOrder: [id],
    activeWorkspaceId: id,
    workspaces: [
      {
        id,
        name: 'Personal',
        icon: '🏠',
        createdAt: now
      }
    ]
  }
}

export function loadOrMigrateWorkspacesRegistry(): WorkspacesRegistryV1 {
  try {
    if (existsSync(registryPath())) {
      const raw = readFileSync(registryPath(), 'utf8')
      const data = JSON.parse(raw) as unknown
      if (data && typeof data === 'object') {
        const rec = data as Record<string, unknown>
        if (rec['version'] === WORKSPACE_REGISTRY_VERSION && Array.isArray(rec['workspaces'])) {
          const workspaces = (rec['workspaces'] as unknown[])
            .filter((w): w is WorkspaceDefinition => {
              if (!w || typeof w !== 'object') return false
              const o = w as Record<string, unknown>
              return (
                typeof o['id'] === 'string' &&
                typeof o['name'] === 'string' &&
                typeof o['createdAt'] === 'number'
              )
            })
            .map((w) => ({
              id: w.id,
              name: w.name.trim() || 'Workspace',
              icon: typeof w.icon === 'string' ? w.icon : null,
              createdAt: w.createdAt
            }))
          const workspaceOrder = Array.isArray(rec['workspaceOrder'])
            ? (rec['workspaceOrder'] as unknown[]).filter((x): x is string => typeof x === 'string')
            : workspaces.map((w) => w.id)
          const ordered = workspaceOrder.filter((id) => workspaces.some((w) => w.id === id))
          for (const w of workspaces) {
            if (!ordered.includes(w.id)) ordered.push(w.id)
          }
          const activeWorkspaceId =
            typeof rec['activeWorkspaceId'] === 'string' &&
            ordered.includes(rec['activeWorkspaceId'] as string)
              ? (rec['activeWorkspaceId'] as string)
              : ordered[0]!
          if (workspaces.length > 0 && ordered.length > 0) {
            return {
              version: WORKSPACE_REGISTRY_VERSION,
              workspaceOrder: ordered,
              activeWorkspaceId,
              workspaces
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[velo workspaces] registry read failed', e)
  }

  const registry = buildDefaultRegistry()
  const legacy = readLastBrowsingSession()
  const pinned = readPinnedTabs()
  const session =
    legacy && legacy.tabs.length > 0
      ? legacySessionToWorkspace(legacy, pinned)
      : pinned.length > 0
        ? legacySessionToWorkspace({ version: 1, tabs: [], activeIndex: 0 }, pinned)
        : defaultWorkspaceSession()
  writeWorkspaceSessionSync(registry.workspaces[0]!.id, session)
  writeWorkspacesRegistrySync(registry)
  return registry
}

export function writeWorkspacesRegistrySync(registry: WorkspacesRegistryV1): void {
  try {
    mkdirSync(dataDir(), { recursive: true })
    writeFileSync(registryPath(), JSON.stringify(registry, null, 2), 'utf8')
  } catch (e) {
    console.warn('[velo workspaces] registry persist failed', e)
  }
}

export async function writeWorkspacesRegistryAsync(registry: WorkspacesRegistryV1): Promise<void> {
  await mkdir(dataDir(), { recursive: true })
  await writeFile(registryPath(), JSON.stringify(registry, null, 2), 'utf8')
}
