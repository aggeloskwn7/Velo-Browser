

export const IPC = {
  tabsCreate: 'velo:tabs:create',
  tabsClose: 'velo:tabs:close',
  tabsSetActive: 'velo:tabs:set-active',
  tabsGetState: 'velo:tabs:get-state',
  tabsUpdated: 'velo:tabs:updated',

  navSubmit: 'velo:nav:submit',
  navBack: 'velo:nav:back',
  navForward: 'velo:nav:forward',
  navReload: 'velo:nav:reload',
  navStop: 'velo:nav:stop',

  
  omnibarFetchSuggestions: 'velo:omnibar:fetch-suggestions',

  windowMinimize: 'velo:window:minimize',
  windowMaximizeToggle: 'velo:window:maximize-toggle',
  windowClose: 'velo:window:close',

  bookmarksList: 'velo:bookmarks:list',
  bookmarksAdd: 'velo:bookmarks:add',
  bookmarksRemove: 'velo:bookmarks:remove',
  bookmarksFoldersList: 'velo:bookmarks:folders:list',
  bookmarksFolderAdd: 'velo:bookmarks:folders:add',
  bookmarksFolderRemove: 'velo:bookmarks:folders:remove',

  internalBookmarksLibrary: 'velo:internal:bookmarks:library',
  internalBookmarksRemove: 'velo:internal:bookmarks:remove',
  internalBookmarkFolderAdd: 'velo:internal:bookmark-folder:add',
  internalBookmarkFolderRemove: 'velo:internal:bookmark-folder:remove',

  historyList: 'velo:history:list',
  historyClear: 'velo:history:clear',

  settingsGet: 'velo:settings:get',
  settingsSet: 'velo:settings:set',
  settingsChanged: 'velo:settings:changed',

  downloadsList: 'velo:downloads:list',
  downloadsRemove: 'velo:downloads:remove',
  
  downloadsApplyAction: 'velo:downloads:apply-action',
  downloadsOpenFile: 'velo:downloads:open-file',
  
  downloadsChanged: 'velo:downloads:changed',

  devtoolsOpenPage: 'velo:devtools:open-page',
  devtoolsOpenShell: 'velo:devtools:open-shell',

  
  shellOverflowMenuSetReserve: 'velo:shell:overflow-menu-set-reserve',
  
  shellOpenNewTabShortcutModal: 'velo:shell:newtab-shortcut-modal',
  
  shellDownloadsPopoverSetReserve: 'velo:shell:downloads-popover-set-reserve',
  
  shellEnsureChromeOnTop: 'velo:shell:ensure-chrome-on-top',
  
  shellSiteInfoPopoverSetReserve: 'velo:shell:site-info-popover-set-reserve',
  
  shellBookmarkModalSetReserve: 'velo:shell:bookmark-modal-set-reserve',
  
  shellPasswordBarSetReserve: 'velo:shell:password-bar-set-reserve',

  shellDefaultBrowserPromptSetReserve: 'velo:shell:default-browser-prompt-set-reserve',
  
  shellOmnibarSuggestSetReserve: 'velo:shell:omnibar-suggest-set-reserve',

  
  passwordBarState: 'velo:password-bar:state',

  
  passwordTabBridge: 'velo:password-tab:bridge',

  
  internalSettingsGet: 'velo:internal:settings:get',
  internalSettingsSet: 'velo:internal:settings:set',
  internalHistoryList: 'velo:internal:history:list',
  internalHistoryRemove: 'velo:internal:history:remove',
  internalBookmarksList: 'velo:internal:bookmarks:list', // legacy; prefer internalBookmarksLibrary
  internalDownloadsList: 'velo:internal:downloads:list',
  internalDownloadsReveal: 'velo:internal:downloads:reveal',
  internalDownloadsOpen: 'velo:internal:downloads:open',
  internalNewTabShortcutsList: 'velo:internal:newtab:shortcuts:list',
  internalNewTabShortcutAdd: 'velo:internal:newtab:shortcuts:add',
  internalNewTabShortcutUpdate: 'velo:internal:newtab:shortcuts:update',
  internalNewTabShortcutRemove: 'velo:internal:newtab:shortcuts:remove',
  internalNewTabShortcutsReorder: 'velo:internal:newtab:shortcuts:reorder',
  internalNavigateSearch: 'velo:internal:navigate:search',
  internalNavigateUrl: 'velo:internal:navigate:url',
  
  internalPickDownloadFolder: 'velo:internal:pick-download-folder',
  
  internalRelaunchApp: 'velo:internal:app:relaunch',
  internalWelcomeComplete: 'velo:internal:welcome:complete',

  internalDefaultBrowserGet: 'velo:internal:default-browser:get',
  internalDefaultBrowserRegister: 'velo:internal:default-browser:register',
  internalDefaultBrowserOpenSettings: 'velo:internal:default-browser:open-settings',
  internalDefaultBrowserRegisterAndOpenSettings: 'velo:internal:default-browser:register-and-open-settings',

  autoUpdateStatus: 'velo:auto-update:status',
  internalAutoUpdateCheck: 'velo:internal:auto-update:check',
  internalAutoUpdateGetStatus: 'velo:internal:auto-update:get-status',
  internalAutoUpdateQuitAndInstall: 'velo:internal:auto-update:quit-and-install',

  internalPasswordVaultExists: 'velo:internal:password-vault:exists',
  internalPasswordVaultNeedsMigration: 'velo:internal:password-vault:needs-migration',
  internalPasswordVaultMigrate: 'velo:internal:password-vault:migrate',
  internalPasswordVaultUnlocked: 'velo:internal:password-vault:unlocked',
  internalPasswordVaultOsKeyAvailable: 'velo:internal:password-vault:os-key-available',
  internalPasswordVaultList: 'velo:internal:password-vault:list',
  internalPasswordVaultDelete: 'velo:internal:password-vault:delete',
  internalPasswordVaultImport: 'velo:internal:password-vault:import',
  internalPasswordVaultExport: 'velo:internal:password-vault:export',

  
  adblockToast: 'velo:adblock:toast',

  
  tabRetryNavigation: 'velo:tab:retry-navigation',

  
  passwordBarSave: 'velo:password-bar:save',
  
  passwordBarNever: 'velo:password-bar:never',
  
  passwordBarDismiss: 'velo:password-bar:dismiss'
} as const

export type TabSnapshot = {
  id: number
  url: string
  title: string
  favicon: string | null
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  
  isResting?: boolean
}


export type TabsStatePayload = {
  tabs: TabSnapshot[]
  activeId: number | null
}

export type SearchEngine = 'google' | 'bing' | 'duckduckgo' | 'brave' | 'ecosia'

export type BrowserChromeTheme = 'default' | 'white' | 'black' | 'grey'

export type AdBlockLevel = 'off' | 'low' | 'medium' | 'high'

export const NEW_TAB_BACKGROUND_PRESETS = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'indigo',
  'violet',
  'black',
  'white',
  'grey',
  'dark-grey',
  'light-grey'
] as const

export type NewTabBackgroundPreset = (typeof NEW_TAB_BACKGROUND_PRESETS)[number]

export type NewTabBackground =
  | { kind: 'preset'; preset: NewTabBackgroundPreset }
  | { kind: 'image'; filename: string }

export type BackgroundTabRestMinutes = 5 | 15 | 30 | 60

export type VeloSettings = {
  searchEngine: SearchEngine
  
  browserChromeTheme: BrowserChromeTheme
  startupBehavior: 'new-tab' | 'restore-tabs'
  
  newTabShortcutsEnabled: boolean
  
  newTabBackground: NewTabBackground
  
  adBlockLevel: AdBlockLevel
  
  adBlockAllowlistHostnames: string[]
  
  downloadDirectory: string
  
  downloadLocationIsDefault: boolean
  
  passwordOfferToSave: boolean
  
  passwordAutofillOnFocus: boolean
  
  passwordAutofillHotkey: boolean
  
  passwordsNeverSaveDomains: string[]
  
  passwordVaultRememberDevice: boolean

  
  prefetchNetworkConnections: boolean
  
  notifyOnTabFreeze: boolean
  
  dimRestingTabs: boolean
  
  alwaysActiveHostnames: string[]
  
  lowPowerBackgroundMode: boolean
  
  backgroundTabRestMinutes: BackgroundTabRestMinutes
  
  autoThrottleBackgroundTabs: boolean
  
  gameQuietBackground: boolean
  
  useHardwareAcceleration: boolean
}

export type PasswordVaultEntryDto = {
  id: string
  domain: string
  username: string
  password: string
  createdAt: number
  updatedAt: number
}

export type DefaultBrowserStatusPayload = {
  isPackaged: boolean
  http: boolean
  https: boolean
  isDefault: boolean
}

export type DefaultBrowserRegisterResult = {
  ok: boolean
  http: boolean
  https: boolean
  message?: string
}

/** Where to open Windows Settings for default-browser setup. */
export type DefaultBrowserOpenSettingsPage = 'default-apps' | 'installed-apps'

export type AutoUpdateStatusPayload =
  | { phase: 'idle' }
  | { phase: 'dev' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; percent: number; transferred: number; total: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string }

export type PasswordBarState =
  | { open: false }
  | {
      open: true
      tabId: number
      domain: string
      username: string
      password: string
    }


export type AdblockToastPayload = {
  count: number
  
  suggestSiteFix?: boolean
  
  pageHostname?: string
  
  /** Shorter dismiss when the blocking happened in a background tab */
  quiet?: boolean
}


export const DEFAULT_BOOKMARK_FOLDER_ID = 'default' as const

export type BookmarkFolder = {
  id: string
  name: string
  createdAt: number
}

export type BookmarkEntry = {
  id: string
  url: string
  title: string
  createdAt: number
  
  folderId: string
  
  favicon: string | null
}


export type BookmarksLibraryPayload = {
  folders: BookmarkFolder[]
  bookmarks: BookmarkEntry[]
}


export type NewTabShortcut = {
  id: string
  label: string
  url: string
  createdAt: number
}

export type HistoryEntry = {
  id: string
  url: string
  title: string
  visitedAt: number
}

export type DownloadEntry = {
  id: string
  filename: string
  path: string
  
  sourceUrl?: string
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  receivedBytes: number
  totalBytes: number
  startedAt: number
  
  fileRemovedFromDisk?: boolean
}
