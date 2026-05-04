import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AdblockToastPayload,
  type BookmarkEntry,
  type BookmarkFolder,
  type BookmarksLibraryPayload,
  type DefaultBrowserOpenSettingsPage,
  type DefaultBrowserRegisterResult,
  type DefaultBrowserStatusPayload,
  type DownloadEntry,
  type HistoryEntry,
  type AutoUpdateStatusPayload,
  type TabSnapshot,
  type TabsStatePayload,
  type VeloSettings,
  type PasswordBarState
} from '../shared/ipc.js'

const shellApi = {
  onTabsUpdated: (cb: (state: TabsStatePayload) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, state: TabsStatePayload): void => {
      cb(state)
    }
    ipcRenderer.on(IPC.tabsUpdated, listener)
    return () => {
      ipcRenderer.removeListener(IPC.tabsUpdated, listener)
    }
  },

  tabsCreate: (url?: string): Promise<number> => ipcRenderer.invoke(IPC.tabsCreate, { url }),
  tabsClose: (tabId: number): Promise<void> => ipcRenderer.invoke(IPC.tabsClose, { tabId }),
  tabsSetActive: (tabId: number): Promise<void> => ipcRenderer.invoke(IPC.tabsSetActive, { tabId }),
  tabsGetState: (): Promise<TabsStatePayload> => ipcRenderer.invoke(IPC.tabsGetState),

  navSubmit: (tabId: number, input: string): Promise<void> =>
    ipcRenderer.invoke(IPC.navSubmit, { tabId, input }),
  navBack: (tabId: number): Promise<void> => ipcRenderer.invoke(IPC.navBack, { tabId }),
  navForward: (tabId: number): Promise<void> => ipcRenderer.invoke(IPC.navForward, { tabId }),
  navReload: (tabId: number): Promise<void> => ipcRenderer.invoke(IPC.navReload, { tabId }),
  navStop: (tabId: number): Promise<void> => ipcRenderer.invoke(IPC.navStop, { tabId }),

  windowMinimize: (): void => {
    ipcRenderer.send(IPC.windowMinimize)
  },
  windowMaximizeToggle: (): void => {
    ipcRenderer.send(IPC.windowMaximizeToggle)
  },
  windowClose: (): void => {
    ipcRenderer.send(IPC.windowClose)
  },

  bookmarksList: (): Promise<BookmarkEntry[]> => ipcRenderer.invoke(IPC.bookmarksList),
  bookmarksAdd: (payload: {
    url: string
    title?: string
    folderId?: string
    favicon?: string | null
  }): Promise<BookmarkEntry> => ipcRenderer.invoke(IPC.bookmarksAdd, payload),
  bookmarksRemove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.bookmarksRemove, { id }),
  bookmarksFoldersList: (): Promise<BookmarkFolder[]> => ipcRenderer.invoke(IPC.bookmarksFoldersList),
  bookmarksFolderAdd: (name: string): Promise<BookmarkFolder> =>
    ipcRenderer.invoke(IPC.bookmarksFolderAdd, { name }),
  bookmarksFolderRemove: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.bookmarksFolderRemove, { id }),

  historyList: (limit?: number): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke(IPC.historyList, { limit }),

  settingsGet: (): Promise<VeloSettings> => ipcRenderer.invoke(IPC.settingsGet),
  settingsSet: (patch: Partial<VeloSettings>): Promise<VeloSettings> =>
    ipcRenderer.invoke(IPC.settingsSet, patch),
  onSettingsChanged: (cb: (s: VeloSettings) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, next: VeloSettings): void => cb(next)
    ipcRenderer.on(IPC.settingsChanged, listener)
    return () => {
      ipcRenderer.removeListener(IPC.settingsChanged, listener)
    }
  },

  downloadsList: (): Promise<DownloadEntry[]> => ipcRenderer.invoke(IPC.downloadsList),
  downloadsRemove: (id: string): Promise<DownloadEntry[]> =>
    ipcRenderer.invoke(IPC.downloadsRemove, { id }),
  downloadsApplyAction: (id: string): Promise<DownloadEntry[]> =>
    ipcRenderer.invoke(IPC.downloadsApplyAction, { id }),
  downloadsOpenFile: (id: string): Promise<{ ok: true } | { ok: false; message: string }> =>
    ipcRenderer.invoke(IPC.downloadsOpenFile, { id }),

  onDownloadsChanged: (cb: (entries: DownloadEntry[]) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, entries: DownloadEntry[]): void => cb(entries)
    ipcRenderer.on(IPC.downloadsChanged, listener)
    return () => {
      ipcRenderer.removeListener(IPC.downloadsChanged, listener)
    }
  },

  onAdblockToast: (cb: (payload: AdblockToastPayload) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: AdblockToastPayload): void => cb(payload)
    ipcRenderer.on(IPC.adblockToast, listener)
    return () => {
      ipcRenderer.removeListener(IPC.adblockToast, listener)
    }
  },

  onAutoUpdateStatus: (cb: (payload: AutoUpdateStatusPayload) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: AutoUpdateStatusPayload): void => cb(payload)
    ipcRenderer.on(IPC.autoUpdateStatus, listener)
    return () => {
      ipcRenderer.removeListener(IPC.autoUpdateStatus, listener)
    }
  },

  devtoolsOpenPage: (): Promise<void> => ipcRenderer.invoke(IPC.devtoolsOpenPage),
  devtoolsOpenShell: (): Promise<void> => ipcRenderer.invoke(IPC.devtoolsOpenShell),

  shellOpenNewTabShortcutModal: (): Promise<boolean> => ipcRenderer.invoke(IPC.shellOpenNewTabShortcutModal),

  shellOverflowMenuSetReserve: (px: number): Promise<void> =>
    ipcRenderer.invoke(IPC.shellOverflowMenuSetReserve, px),

  shellDownloadsPopoverSetReserve: (px: number): Promise<void> =>
    ipcRenderer.invoke(IPC.shellDownloadsPopoverSetReserve, px),

  shellSiteInfoPopoverSetReserve: (px: number): Promise<void> =>
    ipcRenderer.invoke(IPC.shellSiteInfoPopoverSetReserve, px),

  shellBookmarkModalSetReserve: (px: number): Promise<void> =>
    ipcRenderer.invoke(IPC.shellBookmarkModalSetReserve, px),

  shellPasswordBarSetReserve: (px: number): Promise<void> =>
    ipcRenderer.invoke(IPC.shellPasswordBarSetReserve, px),

  shellDefaultBrowserPromptSetReserve: (px: number): Promise<void> =>
    ipcRenderer.invoke(IPC.shellDefaultBrowserPromptSetReserve, px),

  getDefaultBrowserStatus: (): Promise<DefaultBrowserStatusPayload> =>
    ipcRenderer.invoke(IPC.internalDefaultBrowserGet),
  registerDefaultBrowser: (): Promise<DefaultBrowserRegisterResult> =>
    ipcRenderer.invoke(IPC.internalDefaultBrowserRegister),
  registerDefaultBrowserAndOpenSettings: (): Promise<DefaultBrowserRegisterResult> =>
    ipcRenderer.invoke(IPC.internalDefaultBrowserRegisterAndOpenSettings),
  openDefaultBrowserSystemSettings: (page?: DefaultBrowserOpenSettingsPage): Promise<void> =>
    ipcRenderer.invoke(IPC.internalDefaultBrowserOpenSettings, page),

  quitAndInstallUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.internalAutoUpdateQuitAndInstall),

  getAutoUpdateStatus: (): Promise<AutoUpdateStatusPayload> =>
    ipcRenderer.invoke(IPC.internalAutoUpdateGetStatus),

  shellOmnibarSuggestSetReserve: (px: number): Promise<void> =>
    ipcRenderer.invoke(IPC.shellOmnibarSuggestSetReserve, px),

  onPasswordBarState: (cb: (s: PasswordBarState) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, s: PasswordBarState): void => cb(s)
    ipcRenderer.on(IPC.passwordBarState, listener)
    return () => {
      ipcRenderer.removeListener(IPC.passwordBarState, listener)
    }
  },

  passwordBarSave: (payload: { tabId: number; domain: string; username: string; password: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.passwordBarSave, payload),

  passwordBarNever: (payload: { tabId: number; domain: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.passwordBarNever, payload),

  passwordBarDismiss: (payload: { tabId: number }): Promise<void> =>
    ipcRenderer.invoke(IPC.passwordBarDismiss, payload),

  shellEnsureChromeOnTop: (): Promise<void> => ipcRenderer.invoke(IPC.shellEnsureChromeOnTop),

  omnibarFetchSuggestions: (query: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC.omnibarFetchSuggestions, { query })
}

export type VeloShellApi = typeof shellApi

contextBridge.exposeInMainWorld('velo', shellApi)
