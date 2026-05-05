import Store from 'electron-store'
import { app, screen } from 'electron'
import type { BaseWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import type {
  BookmarkEntry,
  BookmarkFolder,
  BookmarksLibraryPayload,
  NewTabShortcut,
  BrowserChromeTheme,
  SearchEngine,
  VeloSettings,
  AdBlockLevel,
  BackgroundTabRestMinutes
} from '../shared/ipc.js'
import { DEFAULT_BOOKMARK_FOLDER_ID } from '../shared/ipc.js'
import { allowedBackgroundImageSet, normalizeNewTabBackground } from './velo-pages/newtab-background.js'


type SettingsStored = {
  searchEngine: SearchEngine
  browserChromeTheme?: BrowserChromeTheme
  startupBehavior: 'new-tab' | 'restore-tabs'
  newTabShortcutsEnabled: boolean
  
  newTabBackground?: unknown
  downloadDirectory?: string
  adBlockLevel?: AdBlockLevel
  
  adBlockAllowlistHostnames?: string[]
  passwordOfferToSave?: boolean
  
  passwordAutofillEnabled?: boolean
  passwordAutofillOnFocus?: boolean
  passwordAutofillHotkey?: boolean
  passwordsNeverSaveDomains?: string[]
  
  passwordVaultRememberDevice?: boolean
  prefetchNetworkConnections?: boolean
  notifyOnTabFreeze?: boolean
  dimRestingTabs?: boolean
  alwaysActiveHostnames?: string[]
  lowPowerBackgroundMode?: boolean
  backgroundTabRestMinutes?: number
  autoThrottleBackgroundTabs?: boolean
  gameQuietBackground?: boolean
  
  useHardwareAcceleration?: boolean
}

type BookmarkEntryStored = Omit<BookmarkEntry, 'folderId' | 'favicon'> & {
  folderId?: string
  favicon?: string | null
}


type MainWindowStateStored = {
  bounds: { x: number; y: number; width: number; height: number }
  isMaximized: boolean
  isFullScreen: boolean
}

type StoreShape = {
  settings: SettingsStored
  bookmarkFolders: BookmarkFolder[]
  bookmarks: BookmarkEntryStored[]
  newTabShortcuts: NewTabShortcut[]
  mainWindowState?: MainWindowStateStored
  
  welcomeOnboardingComplete?: boolean
}

const defaults: StoreShape = {
  settings: {
    searchEngine: 'google',
    startupBehavior: 'new-tab',
    newTabShortcutsEnabled: true,
    passwordOfferToSave: true,
    passwordAutofillOnFocus: true,
    passwordAutofillHotkey: true,
    passwordsNeverSaveDomains: [],
    passwordVaultRememberDevice: true,
    adBlockAllowlistHostnames: [],
    adBlockLevel: 'off'
  },
  bookmarkFolders: [],
  bookmarks: [],
  newTabShortcuts: []
}

const store = new Store<StoreShape>({
  name: 'velo-config',
  defaults
})

function readBookmarkFolders(): BookmarkFolder[] {
  const v = store.get('bookmarkFolders')
  return Array.isArray(v) ? v : []
}

export function normalizePinnedHostname(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
}

function coerceBackgroundMinutes(n: unknown): BackgroundTabRestMinutes {
  const x = typeof n === 'number' ? n : Number(n)
  if (x === 5 || x === 15 || x === 30 || x === 60) return x
  return 30
}

function resolveDownloadDirectory(stored?: string): string {
  const t = typeof stored === 'string' ? stored.trim() : ''
  if (t.length > 0) return t
  return app.getPath('downloads')
}

function autofillFlagsFromStored(stored: SettingsStored): { onFocus: boolean; hotkey: boolean } {
  const hasNew =
    stored.passwordAutofillOnFocus !== undefined || stored.passwordAutofillHotkey !== undefined
  if (hasNew) {
    return {
      onFocus: stored.passwordAutofillOnFocus !== false,
      hotkey: stored.passwordAutofillHotkey !== false
    }
  }
  const legacy = stored.passwordAutofillEnabled !== false
  return { onFocus: legacy, hotkey: legacy }
}

function publicSettingsFromStored(stored: SettingsStored): VeloSettings {
  const isDefault = !stored.downloadDirectory?.trim()
  const allowed = allowedBackgroundImageSet()
  const autofill = autofillFlagsFromStored(stored)
  return {
    searchEngine: stored.searchEngine,
    browserChromeTheme: stored.browserChromeTheme ?? 'default',
    startupBehavior: stored.startupBehavior,
    newTabShortcutsEnabled: stored.newTabShortcutsEnabled !== false,
    newTabBackground: normalizeNewTabBackground(stored.newTabBackground, allowed),
    adBlockLevel: stored.adBlockLevel ?? 'off',
    adBlockAllowlistHostnames: Array.isArray(stored.adBlockAllowlistHostnames)
      ? [
          ...new Set(
            stored.adBlockAllowlistHostnames
              .map((d) => normalizePinnedHostname(String(d)))
              .filter((h) => h.length > 0 && h.length <= 253)
          )
        ].slice(0, 80)
      : [],
    downloadDirectory: resolveDownloadDirectory(stored.downloadDirectory),
    downloadLocationIsDefault: isDefault,
    passwordOfferToSave: stored.passwordOfferToSave !== false,
    passwordAutofillOnFocus: autofill.onFocus,
    passwordAutofillHotkey: autofill.hotkey,
    passwordsNeverSaveDomains: Array.isArray(stored.passwordsNeverSaveDomains)
      ? [...new Set(stored.passwordsNeverSaveDomains.map((d) => String(d).trim().toLowerCase()).filter(Boolean))]
      : [],
    passwordVaultRememberDevice: stored.passwordVaultRememberDevice !== false,
    prefetchNetworkConnections: stored.prefetchNetworkConnections !== false,
    notifyOnTabFreeze: stored.notifyOnTabFreeze !== false,
    dimRestingTabs: stored.dimRestingTabs !== false,
    alwaysActiveHostnames: Array.isArray(stored.alwaysActiveHostnames)
      ? [
          ...new Set(
            stored.alwaysActiveHostnames
              .map((d) => normalizePinnedHostname(String(d)))
              .filter((h) => h.length > 0 && h.length <= 253)
          )
        ].slice(0, 40)
      : [],
    lowPowerBackgroundMode: stored.lowPowerBackgroundMode === true,
    backgroundTabRestMinutes: coerceBackgroundMinutes(stored.backgroundTabRestMinutes),
    autoThrottleBackgroundTabs: stored.autoThrottleBackgroundTabs !== false,
    gameQuietBackground: stored.gameQuietBackground === true,
    useHardwareAcceleration: stored.useHardwareAcceleration !== false
  }
}


export function readBootUseHardwareAcceleration(): boolean {
  try {
    const raw = store.get('settings')
    if (!raw || typeof raw !== 'object') return true
    return (raw as SettingsStored).useHardwareAcceleration !== false
  } catch {
    return true
  }
}

export function migrateWelcomeOnboardingForExistingProfiles(): void {
  if (store.get('welcomeOnboardingComplete') === true) return
  const bookmarks = store.get('bookmarks')
  const shortcuts = store.get('newTabShortcuts')
  if (bookmarks.length > 0 || shortcuts.length > 0) {
    store.set('welcomeOnboardingComplete', true)
  }
}


export function shouldOfferWelcomeOnColdStart(): boolean {
  migrateWelcomeOnboardingForExistingProfiles()
  return store.get('welcomeOnboardingComplete') !== true
}

export function setWelcomeOnboardingComplete(): void {
  store.set('welcomeOnboardingComplete', true)
}

const MAIN_WIN_MIN_W = 720
const MAIN_WIN_MIN_H = 480

function clampSavedMainWindowBounds(
  b: MainWindowStateStored['bounds']
): MainWindowStateStored['bounds'] | null {
  let x = Math.trunc(b.x)
  let y = Math.trunc(b.y)
  let width = Math.trunc(b.width)
  let height = Math.trunc(b.height)
  if (![x, y, width, height].every(Number.isFinite)) return null
  width = Math.min(6000, Math.max(MAIN_WIN_MIN_W, width))
  height = Math.min(6000, Math.max(MAIN_WIN_MIN_H, height))
  const rect = { x, y, width, height }
  try {
    const wa = screen.getDisplayMatching(rect).workArea
    const rx2 = rect.x + rect.width
    const ry2 = rect.y + rect.height
    const intersects =
      rx2 > wa.x && rect.x < wa.x + wa.width && ry2 > wa.y && rect.y < wa.y + wa.height
    if (!intersects) {
      return {
        x: wa.x + Math.min(48, Math.max(0, wa.width - width - 48)),
        y: wa.y + Math.min(48, Math.max(0, wa.height - height - 48)),
        width: Math.min(width, wa.width - 80),
        height: Math.min(height, wa.height - 80)
      }
    }
  } catch {
    return rect
  }
  return rect
}


export function readMainWindowStateForCreate(): MainWindowStateStored | null {
  const raw = store.get('mainWindowState')
  if (!raw || typeof raw !== 'object') return null
  const b = (raw as MainWindowStateStored).bounds
  if (!b || typeof b !== 'object') return null
  const bounds = clampSavedMainWindowBounds({
    x: Number(b.x),
    y: Number(b.y),
    width: Number(b.width),
    height: Number(b.height)
  })
  if (!bounds) return null
  return {
    bounds,
    isMaximized: Boolean((raw as MainWindowStateStored).isMaximized),
    isFullScreen: Boolean((raw as MainWindowStateStored).isFullScreen)
  }
}

export function persistMainWindowState(win: BaseWindow): void {
  if (win.isDestroyed()) return
  try {
    const nb = win.getNormalBounds()
    const state: MainWindowStateStored = {
      bounds: {
        x: Math.trunc(nb.x),
        y: Math.trunc(nb.y),
        width: Math.trunc(nb.width),
        height: Math.trunc(nb.height)
      },
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen()
    }
    store.set('mainWindowState', state)
  } catch {}
}

type VeloSettingsPatch = Partial<VeloSettings> & {
  passwordAutofillEnabled?: boolean
}

export function getSettings(): VeloSettings {
  return publicSettingsFromStored(store.get('settings'))
}

export function setSettings(patch: VeloSettingsPatch): VeloSettings {
  const cur = store.get('settings')
  const nextStored: SettingsStored = { ...cur }
  if (patch.searchEngine !== undefined) nextStored.searchEngine = patch.searchEngine
  if (patch.browserChromeTheme !== undefined) nextStored.browserChromeTheme = patch.browserChromeTheme
  if (patch.startupBehavior !== undefined) nextStored.startupBehavior = patch.startupBehavior
  if (patch.newTabShortcutsEnabled !== undefined) {
    nextStored.newTabShortcutsEnabled = patch.newTabShortcutsEnabled
  }
  if (patch.downloadDirectory !== undefined) {
    const d = patch.downloadDirectory.trim()
    if (d.length === 0) {
      delete nextStored.downloadDirectory
    } else {
      nextStored.downloadDirectory = d
    }
  }
  if (patch.newTabBackground !== undefined) {
    const allowed = allowedBackgroundImageSet()
    nextStored.newTabBackground = normalizeNewTabBackground(patch.newTabBackground, allowed)
  }
  if (patch.adBlockLevel !== undefined) {
    nextStored.adBlockLevel = patch.adBlockLevel
  }
  if (patch.adBlockAllowlistHostnames !== undefined) {
    nextStored.adBlockAllowlistHostnames = [
      ...new Set(
        patch.adBlockAllowlistHostnames
          .map((d) => normalizePinnedHostname(String(d)))
          .filter((h) => h.length > 0 && h.length <= 253)
      )
    ].slice(0, 80)
  }
  if (patch.passwordOfferToSave !== undefined) {
    nextStored.passwordOfferToSave = patch.passwordOfferToSave
  }
  if (patch.passwordAutofillOnFocus !== undefined) {
    nextStored.passwordAutofillOnFocus = patch.passwordAutofillOnFocus
  }
  if (patch.passwordAutofillHotkey !== undefined) {
    nextStored.passwordAutofillHotkey = patch.passwordAutofillHotkey
  }
  if (patch.passwordAutofillEnabled !== undefined) {
    nextStored.passwordAutofillOnFocus = patch.passwordAutofillEnabled
    nextStored.passwordAutofillHotkey = patch.passwordAutofillEnabled
    delete nextStored.passwordAutofillEnabled
  }
  if (patch.passwordsNeverSaveDomains !== undefined) {
    nextStored.passwordsNeverSaveDomains = patch.passwordsNeverSaveDomains
  }
  if (patch.passwordVaultRememberDevice !== undefined) {
    nextStored.passwordVaultRememberDevice = patch.passwordVaultRememberDevice
  }
  if (patch.prefetchNetworkConnections !== undefined) {
    nextStored.prefetchNetworkConnections = patch.prefetchNetworkConnections
  }
  if (patch.notifyOnTabFreeze !== undefined) {
    nextStored.notifyOnTabFreeze = patch.notifyOnTabFreeze
  }
  if (patch.dimRestingTabs !== undefined) {
    nextStored.dimRestingTabs = patch.dimRestingTabs
  }
  if (patch.alwaysActiveHostnames !== undefined) {
    nextStored.alwaysActiveHostnames = [
      ...new Set(
        patch.alwaysActiveHostnames
          .map((d) => normalizePinnedHostname(String(d)))
          .filter((h) => h.length > 0 && h.length <= 253)
      )
    ].slice(0, 40)
  }
  if (patch.lowPowerBackgroundMode !== undefined) {
    nextStored.lowPowerBackgroundMode = patch.lowPowerBackgroundMode
  }
  if (patch.backgroundTabRestMinutes !== undefined) {
    nextStored.backgroundTabRestMinutes = coerceBackgroundMinutes(patch.backgroundTabRestMinutes)
  }
  if (patch.autoThrottleBackgroundTabs !== undefined) {
    nextStored.autoThrottleBackgroundTabs = patch.autoThrottleBackgroundTabs
  }
  if (patch.gameQuietBackground !== undefined) {
    nextStored.gameQuietBackground = patch.gameQuietBackground
  }
  if (patch.useHardwareAcceleration !== undefined) {
    nextStored.useHardwareAcceleration = patch.useHardwareAcceleration
  }
  store.set('settings', nextStored)
  return publicSettingsFromStored(nextStored)
}

export function setSearchEngine(engine: SearchEngine): VeloSettings {
  return setSettings({ searchEngine: engine })
}

function normalizeBookmarkEntry(b: BookmarkEntryStored): BookmarkEntry {
  return {
    id: b.id,
    url: b.url,
    title: b.title,
    createdAt: b.createdAt,
    folderId: typeof b.folderId === 'string' && b.folderId.length > 0 ? b.folderId : DEFAULT_BOOKMARK_FOLDER_ID,
    favicon: b.favicon ?? null
  }
}

function defaultBookmarkFolderRow(): BookmarkFolder {
  return {
    id: DEFAULT_BOOKMARK_FOLDER_ID,
    name: 'Bookmarks',
    createdAt: 0
  }
}

export function listBookmarkFolders(): BookmarkFolder[] {
  const user = readBookmarkFolders()
  return [defaultBookmarkFolderRow(), ...user]
}

export function listBookmarks(): BookmarkEntry[] {
  return store.get('bookmarks').map(normalizeBookmarkEntry)
}

export function getBookmarksLibrary(): BookmarksLibraryPayload {
  return {
    folders: listBookmarkFolders(),
    bookmarks: listBookmarks()
  }
}

export function addBookmarkFolder(name: string): BookmarkFolder {
  const trimmed = name.trim().slice(0, 64)
  if (!trimmed) throw new Error('Folder name required')
  const folder: BookmarkFolder = {
    id: randomUUID(),
    name: trimmed,
    createdAt: Date.now()
  }
  store.set('bookmarkFolders', [...readBookmarkFolders(), folder])
  return folder
}

export function removeBookmarkFolder(folderId: string): void {
  if (folderId === DEFAULT_BOOKMARK_FOLDER_ID) return
  const folders = readBookmarkFolders()
  if (!folders.some((f) => f.id === folderId)) return
  const bookmarks = store.get('bookmarks').map((b) => {
    const nb = normalizeBookmarkEntry(b)
    if (nb.folderId === folderId) {
      return { ...b, folderId: DEFAULT_BOOKMARK_FOLDER_ID }
    }
    return b
  })
  store.set('bookmarks', bookmarks)
  store.set(
    'bookmarkFolders',
    folders.filter((f) => f.id !== folderId)
  )
}

export type BookmarkAddInput = {
  url: string
  title?: string
  folderId?: string
  favicon?: string | null
}

export function addBookmark(input: BookmarkAddInput): BookmarkEntry {
  const list = store.get('bookmarks')
  const url = input.url.trim()
  let folderId =
    typeof input.folderId === 'string' && input.folderId.trim().length > 0
      ? input.folderId.trim()
      : DEFAULT_BOOKMARK_FOLDER_ID
  if (folderId !== DEFAULT_BOOKMARK_FOLDER_ID) {
    const ok = readBookmarkFolders().some((f) => f.id === folderId)
    if (!ok) folderId = DEFAULT_BOOKMARK_FOLDER_ID
  }
  const title = (input.title?.trim() || url).slice(0, 512)
  let favicon: string | null =
    typeof input.favicon === 'string' && input.favicon.length > 0 ? input.favicon : null
  if (favicon && favicon.length > 400_000) favicon = null
  const entryStored: BookmarkEntryStored = {
    id: randomUUID(),
    url,
    title,
    createdAt: Date.now(),
    folderId,
    favicon
  }
  store.set('bookmarks', [entryStored, ...list])
  return normalizeBookmarkEntry(entryStored)
}

export function removeBookmark(id: string): void {
  store.set(
    'bookmarks',
    store.get('bookmarks').filter((b) => b.id !== id)
  )
}

export function listNewTabShortcuts(): NewTabShortcut[] {
  return [...store.get('newTabShortcuts')]
}

export function addNewTabShortcut(label: string, url: string): NewTabShortcut {
  let u = url.trim()
  if (!/^https?:\/\//i.test(u) && !u.startsWith('velo://')) {
    u = `https://${u.replace(/^\/+/, '')}`
  }
  const entry: NewTabShortcut = {
    id: randomUUID(),
    label: label.trim().slice(0, 64) || 'Favorite',
    url: u,
    createdAt: Date.now()
  }
  store.set('newTabShortcuts', [...store.get('newTabShortcuts'), entry])
  return entry
}

export function removeNewTabShortcut(id: string): void {
  store.set(
    'newTabShortcuts',
    store.get('newTabShortcuts').filter((s) => s.id !== id)
  )
}

export function updateNewTabShortcut(id: string, label: string, url: string): NewTabShortcut {
  const list = store.get('newTabShortcuts')
  const i = list.findIndex((s) => s.id === id)
  if (i === -1) throw new Error('Shortcut not found')
  let u = url.trim()
  if (!/^https?:\/\//i.test(u) && !u.startsWith('velo://')) {
    u = `https://${u.replace(/^\/+/, '')}`
  }
  const cur = list[i]
  if (!cur) throw new Error('Shortcut not found')
  const next = [...list]
  next[i] = {
    ...cur,
    label: label.trim().slice(0, 64) || 'Favorite',
    url: u
  }
  store.set('newTabShortcuts', next)
  return next[i] as NewTabShortcut
}

export function reorderNewTabShortcuts(orderedIds: string[]): void {
  const list = store.get('newTabShortcuts')
  if (orderedIds.length !== list.length) {
    throw new Error('Shortcut order must include every shortcut exactly once')
  }
  const byId = new Map(list.map((s) => [s.id, s] as const))
  const next: NewTabShortcut[] = []
  for (const id of orderedIds) {
    const entry = byId.get(id)
    if (!entry) throw new Error('Unknown shortcut in order')
    next.push(entry)
    byId.delete(id)
  }
  if (byId.size > 0) {
    throw new Error('Shortcut order must include every shortcut exactly once')
  }
  store.set('newTabShortcuts', next)
}

export type BookmarkImportRow = {
  url: string
  title: string
  folderPath: string[]
  createdAt: number
}

export function mergeBookmarksFromImport(rows: BookmarkImportRow[]): { imported: number; skipped: number } {
  let imported = 0
  let skipped = 0
  const keySet = new Set<string>()
  for (const b of store.get('bookmarks')) {
    const nb = normalizeBookmarkEntry(b)
    keySet.add(`${nb.folderId}\t${nb.url}`)
  }

  for (const r of rows) {
    let u = r.url.trim()
    if (!u) {
      skipped++
      continue
    }
    if (!/^https?:\/\//i.test(u) && !u.startsWith('velo://')) {
      u = `https://${u.replace(/^\/+/, '')}`
    }
    try {
      const parsed = new URL(u)
      if (parsed.protocol === 'velo:' || parsed.protocol === 'data:') {
        skipped++
        continue
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        skipped++
        continue
      }
    } catch {
      skipped++
      continue
    }

    const segments = r.folderPath.filter((s) => typeof s === 'string' && s.trim().length > 0)
    const folderLabel = segments.length > 0 ? segments.join(' / ').slice(0, 64) : 'Imported'
    let folderId = DEFAULT_BOOKMARK_FOLDER_ID
    if (folderLabel !== 'Bookmarks') {
      const folders = listBookmarkFolders()
      let f = folders.find((x) => x.name === folderLabel)
      if (!f) {
        f = addBookmarkFolder(folderLabel)
      }
      folderId = f.id
    }

    const title = (r.title?.trim() || u).slice(0, 512)
    const k = `${folderId}\t${u}`
    if (keySet.has(k)) {
      skipped++
      continue
    }
    keySet.add(k)
    const entryStored: BookmarkEntryStored = {
      id: randomUUID(),
      url: u,
      title,
      createdAt: Number.isFinite(r.createdAt)
        ? Math.min(Math.max(0, Math.floor(r.createdAt)), Date.now())
        : Date.now(),
      folderId,
      favicon: null
    }
    store.set('bookmarks', [entryStored, ...store.get('bookmarks')])
    imported++
  }
  return { imported, skipped }
}
