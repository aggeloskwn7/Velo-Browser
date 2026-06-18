import type {
  AdblockToastPayload,
  AutoUpdateStatusPayload,
  BookmarkEntry,
  BookmarkFolder,
  DefaultBrowserOpenSettingsPage,
  DefaultBrowserRegisterResult,
  DefaultBrowserStatusPayload,
  DownloadEntry,
  HistoryEntry,
  PasswordBarState,
  TabSnapshot,
  TabsStatePayload,
  VeloSettings,
  WorkspacesStatePayload
} from '@shared/ipc'

declare global {
  interface Window {
    velo: {
      onTabsUpdated: (cb: (state: TabsStatePayload) => void) => () => void
      tabsCreate: (url?: string) => Promise<number>
      tabsClose: (tabId: number) => Promise<void>
      tabsSetActive: (tabId: number) => Promise<void>
      tabsGetState: () => Promise<TabsStatePayload>
      tabsPin: (tabId: number) => Promise<boolean>
      tabsUnpin: (tabId: number) => Promise<boolean>
      tabsSetMuted: (tabId: number, muted: boolean) => Promise<boolean>
      tabsSplitCreate: (tabId: number) => Promise<boolean>
      tabsSplitExit: (tabId: number, mode: 'both' | 'left' | 'right') => Promise<boolean>
      tabsSplitSetRatio: (tabId: number, ratio: number) => Promise<boolean>
      tabsSplitSetFocus: (tabId: number, pane: 'left' | 'right') => Promise<boolean>
      tabsSplitSwap: (tabId: number) => Promise<boolean>
      onWorkspacesUpdated: (cb: (state: WorkspacesStatePayload) => void) => () => void
      workspacesList: () => Promise<WorkspacesStatePayload>
      workspacesCreate: (name: string, icon: string | null) => Promise<string>
      workspacesRename: (workspaceId: string, name: string) => Promise<boolean>
      workspacesDelete: (workspaceId: string) => Promise<boolean>
      workspacesReorder: (orderedIds: string[]) => Promise<boolean>
      workspacesSwitch: (workspaceId: string) => Promise<boolean>
      navSubmit: (tabId: number, input: string) => Promise<void>
      navBack: (tabId: number) => Promise<void>
      navForward: (tabId: number) => Promise<void>
      navReload: (tabId: number) => Promise<void>
      navStop: (tabId: number) => Promise<void>
      windowMinimize: () => void
      windowMaximizeToggle: () => void
      windowClose: () => void
      bookmarksList: () => Promise<BookmarkEntry[]>
      bookmarksAdd: (payload: {
        url: string
        title?: string
        folderId?: string
        favicon?: string | null
      }) => Promise<BookmarkEntry>
      bookmarksRemove: (id: string) => Promise<void>
      bookmarksFoldersList: () => Promise<BookmarkFolder[]>
      bookmarksFolderAdd: (name: string) => Promise<BookmarkFolder>
      bookmarksFolderRemove: (id: string) => Promise<void>
      historyList: (limit?: number) => Promise<HistoryEntry[]>
      settingsGet: () => Promise<VeloSettings>
      settingsSet: (patch: Partial<VeloSettings>) => Promise<VeloSettings>
      onSettingsChanged: (cb: (s: VeloSettings) => void) => () => void
      downloadsList: () => Promise<DownloadEntry[]>
      downloadsRemove: (id: string) => Promise<DownloadEntry[]>
      downloadsApplyAction: (id: string) => Promise<DownloadEntry[]>
      downloadsOpenFile: (
        id: string
      ) => Promise<{ ok: true } | { ok: false; message: string }>
      onDownloadsChanged: (cb: (entries: DownloadEntry[]) => void) => () => void
      onAdblockToast: (cb: (payload: AdblockToastPayload) => void) => () => void
      onAutoUpdateStatus: (cb: (payload: AutoUpdateStatusPayload) => void) => () => void
      devtoolsOpenPage: () => Promise<void>
      devtoolsOpenShell: () => Promise<void>
      shellOpenNewTabShortcutModal: () => Promise<boolean>
      shellOverflowMenuSetReserve: (px: number) => Promise<void>
      shellDownloadsPopoverSetReserve: (px: number) => Promise<void>
      shellSiteInfoPopoverSetReserve: (px: number) => Promise<void>
      shellBookmarkModalSetReserve: (px: number) => Promise<void>
      shellPasswordBarSetReserve: (px: number) => Promise<void>
      shellDefaultBrowserPromptSetReserve: (px: number) => Promise<void>
      getDefaultBrowserStatus: () => Promise<DefaultBrowserStatusPayload>
      registerDefaultBrowser: () => Promise<DefaultBrowserRegisterResult>
      registerDefaultBrowserAndOpenSettings: () => Promise<DefaultBrowserRegisterResult>
      openDefaultBrowserSystemSettings: (page?: DefaultBrowserOpenSettingsPage) => Promise<void>
      quitAndInstallUpdate: () => Promise<void>
      getAutoUpdateStatus: () => Promise<AutoUpdateStatusPayload>
      shellOmnibarSuggestSetReserve: (px: number) => Promise<void>
      onPasswordBarState: (cb: (s: PasswordBarState) => void) => () => void
      passwordBarSave: (payload: {
        tabId: number
        domain: string
        username: string
        password: string
      }) => Promise<void>
      passwordBarNever: (payload: { tabId: number; domain: string }) => Promise<void>
      passwordBarDismiss: (payload: { tabId: number }) => Promise<void>
      shellEnsureChromeOnTop: () => Promise<void>
      omnibarFetchSuggestions: (query: string) => Promise<string[]>
    }
  }
}

export {}
