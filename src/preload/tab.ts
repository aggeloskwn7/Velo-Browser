import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type BookmarkEntry,
  type BookmarkFolder,
  type BookmarksLibraryPayload,
  type DownloadEntry,
  type HistoryEntry,
  type NewTabShortcut,
  type PasswordVaultEntryDto,
  type VeloSettings,
  type DefaultBrowserStatusPayload,
  type DefaultBrowserRegisterResult,
  type DefaultBrowserOpenSettingsPage,
  type AutoUpdateStatusPayload
} from '../shared/ipc.js'

interface VeloWindowMessageEvent {
  readonly data: unknown
}

declare const window: {
  addEventListener(type: 'message', listener: (ev: VeloWindowMessageEvent) => void): void
}

const PW_BRIDGE = 'velo-password-bridge'

window.addEventListener('message', (ev: VeloWindowMessageEvent) => {
  const d = ev.data as Record<string, unknown> | null
  if (!d || d.source !== PW_BRIDGE) return
  const t = d.type
  if (t === 'ping') return
  if (t === 'openPasswordSettings') {
    void ipcRenderer.invoke(IPC.passwordTabBridge, { type: 'openPasswordSettings' }).catch(() => {})
    return
  }
  if (t === 'requestFill') {
    const mode = d.mode === 'hotkey' ? 'hotkey' : 'auto'
    const af = d.anchorField
    const anchorField =
      af === 'password' || af === 'username' || af === 'hotkey' ? af : mode === 'hotkey' ? 'hotkey' : 'password'
    void ipcRenderer
      .invoke(IPC.passwordTabBridge, {
        type: 'requestFill',
        hostname: String(d.hostname ?? ''),
        mode,
        anchorField
      })
      .catch(() => {})
    return
  }
  if (t === 'offer') {
    void ipcRenderer
      .invoke(IPC.passwordTabBridge, {
        type: 'offer',
        domain: String(d.domain ?? ''),
        username: String(d.username ?? ''),
        password: String(d.password ?? '')
      })
      .catch(() => {})
    return
  }
})

const internal = {
  getSettings: (): Promise<VeloSettings> => ipcRenderer.invoke(IPC.internalSettingsGet),
  setSettings: (patch: Partial<VeloSettings>): Promise<VeloSettings> =>
    ipcRenderer.invoke(IPC.internalSettingsSet, patch),
  getHistory: (limit?: number): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke(IPC.internalHistoryList, { limit }),
  removeHistoryEntries: (ids: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC.internalHistoryRemove, { ids }),
  getBookmarks: (): Promise<BookmarkEntry[]> => ipcRenderer.invoke(IPC.internalBookmarksList),
  getBookmarksLibrary: (): Promise<BookmarksLibraryPayload> =>
    ipcRenderer.invoke(IPC.internalBookmarksLibrary),
  removeBookmark: (id: string): Promise<void> => ipcRenderer.invoke(IPC.internalBookmarksRemove, { id }),
  addBookmarkFolder: (name: string): Promise<BookmarkFolder> =>
    ipcRenderer.invoke(IPC.internalBookmarkFolderAdd, { name }),
  removeBookmarkFolder: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.internalBookmarkFolderRemove, { id }),
  getDownloads: (): Promise<DownloadEntry[]> => ipcRenderer.invoke(IPC.internalDownloadsList),
  revealDownloadInFolder: (path: string): Promise<void> =>
    ipcRenderer.invoke(IPC.internalDownloadsReveal, { path }),
  openDownloadFile: (id: string): Promise<{ ok: true } | { ok: false; message: string }> =>
    ipcRenderer.invoke(IPC.internalDownloadsOpen, { id }),
  getNewTabShortcuts: (): Promise<NewTabShortcut[]> =>
    ipcRenderer.invoke(IPC.internalNewTabShortcutsList),
  addNewTabShortcut: (label: string, url: string): Promise<NewTabShortcut> =>
    ipcRenderer.invoke(IPC.internalNewTabShortcutAdd, { label, url }),
  updateNewTabShortcut: (id: string, label: string, url: string): Promise<NewTabShortcut> =>
    ipcRenderer.invoke(IPC.internalNewTabShortcutUpdate, { id, label, url }),
  removeNewTabShortcut: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.internalNewTabShortcutRemove, { id }),
  reorderNewTabShortcuts: (orderedIds: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC.internalNewTabShortcutsReorder, { orderedIds }),
  navigateSearch: (query: string): Promise<void> =>
    ipcRenderer.invoke(IPC.internalNavigateSearch, { query }),
  navigateUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC.internalNavigateUrl, { url }),
  pickDownloadFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.internalPickDownloadFolder),
  relaunchApp: (): Promise<void> => ipcRenderer.invoke(IPC.internalRelaunchApp),
  completeWelcomeOnboarding: (): Promise<void> => ipcRenderer.invoke(IPC.internalWelcomeComplete),

  getDefaultBrowserStatus: (): Promise<DefaultBrowserStatusPayload> =>
    ipcRenderer.invoke(IPC.internalDefaultBrowserGet),
  registerDefaultBrowser: (): Promise<DefaultBrowserRegisterResult> =>
    ipcRenderer.invoke(IPC.internalDefaultBrowserRegister),
  registerDefaultBrowserAndOpenSettings: (): Promise<DefaultBrowserRegisterResult> =>
    ipcRenderer.invoke(IPC.internalDefaultBrowserRegisterAndOpenSettings),
  openDefaultBrowserSystemSettings: (page?: DefaultBrowserOpenSettingsPage): Promise<void> =>
    ipcRenderer.invoke(IPC.internalDefaultBrowserOpenSettings, page),

  getAutoUpdateStatus: (): Promise<AutoUpdateStatusPayload> =>
    ipcRenderer.invoke(IPC.internalAutoUpdateGetStatus),
  checkAutoUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.internalAutoUpdateCheck),
  quitAndInstallUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.internalAutoUpdateQuitAndInstall),

  passwordVaultExists: (): Promise<boolean> => ipcRenderer.invoke(IPC.internalPasswordVaultExists),
  passwordVaultNeedsMigration: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC.internalPasswordVaultNeedsMigration),
  passwordVaultOsKeyAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC.internalPasswordVaultOsKeyAvailable),
  passwordVaultMigrate: (passphrase: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IPC.internalPasswordVaultMigrate, { passphrase }),
  passwordVaultUnlocked: (): Promise<boolean> => ipcRenderer.invoke(IPC.internalPasswordVaultUnlocked),
  passwordVaultList: (): Promise<PasswordVaultEntryDto[]> => ipcRenderer.invoke(IPC.internalPasswordVaultList),
  passwordVaultDelete: (id: string): Promise<void> => ipcRenderer.invoke(IPC.internalPasswordVaultDelete, { id }),
  passwordVaultImport: (): Promise<{ imported: number }> => ipcRenderer.invoke(IPC.internalPasswordVaultImport),
  passwordVaultExport: (): Promise<
    { ok: true; path: string } | { ok: false; reason: string }
  > => ipcRenderer.invoke(IPC.internalPasswordVaultExport)
}

export type VeloPageApi = typeof internal

const veloTab = {
  retryNavigation: (url: string): Promise<void> => ipcRenderer.invoke(IPC.tabRetryNavigation, { url })
}

export type VeloTabApi = typeof veloTab

contextBridge.exposeInMainWorld('veloPage', internal)
contextBridge.exposeInMainWorld('veloTab', veloTab)
