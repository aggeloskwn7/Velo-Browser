import { app, dialog, ipcMain, shell, type WebContents, type OpenDialogOptions } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import {
  IPC,
  NEW_TAB_BACKGROUND_PRESETS,
  BROWSER_DATA_CHROMIUM_IDS,
  type VeloSettings,
  type PasswordBarState,
  type NewTabBackgroundPreset
} from '../shared/ipc.js'
import { CHROME_HEIGHT } from '../shared/constants.js'
import * as TabManager from './tab-manager.js'
import { getChromeWebContents, getMainWindow, syncMainWindowBackground } from './window.js'
import * as settings from './settings-store.js'
import * as history from './history-store.js'
import * as downloads from './downloads-store.js'
import { applyAdBlockLevel, refreshAdblockRuntimeSettings } from './adblock.js'
import { resolveNavigation } from './navigation.js'
import { getLastTabCommittedUrl, recordTabCommittedUrl } from './velo-page-origin.js'
import * as vault from './password-vault.js'
import { clearDeviceWrappedPassphrase } from './password-vault-remember.js'
import { buildPasswordPickerScript, type PasswordAnchorField } from './password-fill-script.js'
import { parsePasswordCsv, formatPasswordCsv } from './password-csv.js'
import { fetchOmnibarSuggestionsForShell } from './omnibar-suggest-fetch.js'
import { shellDevtoolsOpenOptions } from './devtools.js'
import {
  getDefaultBrowserStatus,
  openSystemDefaultBrowserSettings,
  registerVeloAsDefaultBrowser,
  registerVeloAsDefaultBrowserAndOpenSystemSettings
} from './default-browser.js'
import {
  checkForUpdatesNow,
  getAutoUpdateStatus,
  quitAndInstallUpdate
} from './auto-updater.js'
import * as browserDataImport from './import-browser-data.js'
import type { ImportChromiumBrowserOptions } from './import-browser-data.js'
import { executeClearBrowsingData } from './clear-browsing-data.js'

function requireManager() {
  const m = TabManager.manager
  if (!m) throw new Error('Tab manager not ready')
  return m
}

function afterSettingsPersisted(patch: Partial<VeloSettings>, next: VeloSettings): void {
  const shell = getChromeWebContents()
  if (shell && !shell.isDestroyed()) shell.send(IPC.settingsChanged, next)
  const m = TabManager.manager
  const themeChanged = patch.browserChromeTheme !== undefined
  const ntBgChanged = patch.newTabBackground !== undefined
  if (themeChanged && m) {
    m.setTabViewSurfaceColors(next.browserChromeTheme)
    syncMainWindowBackground(next.browserChromeTheme)
  }
  if ((themeChanged || ntBgChanged) && m) {
    m.reloadVeloProtocolTabs()
  }
  if (patch.adBlockLevel !== undefined) {
    void applyAdBlockLevel(next.adBlockLevel).catch((e) => {
      console.error('[velo adblock] re-apply after settings failed', e)
    })
  } else if (patch.adBlockAllowlistHostnames !== undefined) {
    refreshAdblockRuntimeSettings()
  }
  if (patch.passwordVaultRememberDevice === false) {
    clearDeviceWrappedPassphrase()
  }
  if (
    m &&
    (patch.prefetchNetworkConnections !== undefined ||
      patch.notifyOnTabFreeze !== undefined ||
      patch.dimRestingTabs !== undefined ||
      patch.alwaysActiveHostnames !== undefined ||
      patch.lowPowerBackgroundMode !== undefined ||
      patch.backgroundTabRestMinutes !== undefined ||
      patch.autoThrottleBackgroundTabs !== undefined ||
      patch.gameQuietBackground !== undefined)
  ) {
    m.applyPerformanceSettings()
  }
}

function pageUrlIsVelo(url: string): boolean {
  return url.length > 0 && url.toLowerCase().startsWith('velo://')
}


function assertVeloPage(sender: WebContents): void {
  const candidates = [sender.getURL(), getLastTabCommittedUrl(sender) ?? '']
  try {
    const i = sender.navigationHistory.getActiveIndex()
    const entry = sender.navigationHistory.getEntryAtIndex(i)
    if (entry?.url) candidates.push(entry.url)
  } catch {}
  if (candidates.some((u) => pageUrlIsVelo(u))) return
  console.error('[velo IPC] assertVeloPage denied', {
    wcId: sender.id,
    getURL: sender.getURL(),
    recorded: getLastTabCommittedUrl(sender),
    candidates
  })
  throw new Error('velo internal API denied for this document')
}

function assertShellOrVeloPage(sender: WebContents): void {
  const chrome = getChromeWebContents()
  if (chrome && sender.id === chrome.id) return
  assertVeloPage(sender)
}

const optionalUrl = z.object({ url: z.string().optional() })
const tabIdPayload = z.object({ tabId: z.number().int().positive() })
const navSubmit = z.object({ tabId: z.number().int().positive(), input: z.string() })
const bookmarkAdd = z.object({
  url: z.string().min(1).max(4096),
  title: z.string().max(512).optional(),
  folderId: z.string().min(1).max(80).optional(),
  favicon: z.string().max(400_000).nullable().optional()
})
const bookmarkRemove = z.object({ id: z.string().min(1) })
const bookmarkFolderAdd = z.object({ name: z.string().min(1).max(64) })
const bookmarkFolderRemove = z.object({ id: z.string().min(1).max(80) })
const newTabBackgroundPresetSchema = z.enum(
  NEW_TAB_BACKGROUND_PRESETS as unknown as [NewTabBackgroundPreset, ...NewTabBackgroundPreset[]]
)
const newTabBackgroundPatch = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('preset'),
    preset: newTabBackgroundPresetSchema
  }),
  z.object({
    kind: z.literal('image'),
    filename: z.string().min(1).max(260)
  })
])
const settingsPatch = z.object({
  searchEngine: z.enum(['google', 'bing', 'duckduckgo', 'brave', 'ecosia']).optional(),
  browserChromeTheme: z.enum(['default', 'white', 'black', 'grey']).optional(),
  startupBehavior: z.enum(['new-tab', 'restore-tabs']).optional(),
  newTabShortcutsEnabled: z.boolean().optional(),
  newTabBackground: newTabBackgroundPatch.optional(),
  adBlockLevel: z.enum(['off', 'low', 'medium', 'high']).optional(),
  adBlockAllowlistHostnames: z.array(z.string().max(253)).max(80).optional(),
  
  downloadDirectory: z.string().max(4096).optional(),
  passwordOfferToSave: z.boolean().optional(),
  passwordAutofillEnabled: z.boolean().optional(),
  passwordAutofillOnFocus: z.boolean().optional(),
  passwordAutofillHotkey: z.boolean().optional(),
  passwordsNeverSaveDomains: z.array(z.string().max(253)).optional(),
  passwordVaultRememberDevice: z.boolean().optional(),
  prefetchNetworkConnections: z.boolean().optional(),
  notifyOnTabFreeze: z.boolean().optional(),
  dimRestingTabs: z.boolean().optional(),
  alwaysActiveHostnames: z.array(z.string().max(253)).max(40).optional(),
  lowPowerBackgroundMode: z.boolean().optional(),
  backgroundTabRestMinutes: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]).optional(),
  autoThrottleBackgroundTabs: z.boolean().optional(),
  gameQuietBackground: z.boolean().optional(),
  useHardwareAcceleration: z.boolean().optional()
})
const searchQueryPayload = z.object({ query: z.string() })
const navigateUrlPayload = z.object({ url: z.string().min(1).max(4096) })
const newTabShortcutAdd = z.object({
  label: z.string().min(1).max(64),
  url: z.string().min(1).max(2048)
})
const newTabShortcutUpdate = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(64),
  url: z.string().min(1).max(2048)
})
const newTabShortcutRemove = z.object({ id: z.string().uuid() })
const newTabShortcutsReorder = z.object({
  orderedIds: z.array(z.string().uuid())
})
const browserDataChromiumBrowserIdSchema = z.enum(
  BROWSER_DATA_CHROMIUM_IDS as unknown as [string, string, ...string[]]
)
const browserDataImportChromiumPayload = z.object({
  browserId: browserDataChromiumBrowserIdSchema,
  profileId: z
    .string()
    .min(1)
    .max(200)
    .refine((s) => !s.includes('..') && !/[\\/]/.test(s), 'Invalid profile id'),
  history: z.boolean(),
  bookmarks: z.boolean(),
  downloads: z.boolean()
})
const historyRemovePayload = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(500)
})
const downloadRemovePayload = z.object({ id: z.string().uuid() })
const omnibarSuggestQuery = z.object({ query: z.string().min(1).max(400) })
const revealDownloadPayload = z.object({ path: z.string().min(1).max(4096) })
const clearBrowsingDataPayload = z.object({
  history: z.boolean(),
  cookies: z.boolean(),
  cache: z.boolean(),
  passwords: z.boolean(),
  downloads: z.boolean(),
  timeRange: z.enum(['hour', 'day', 'week', 'month', 'all'])
})

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.tabsCreate, (_e, raw) => {
    const m = requireManager()
    const parsed = optionalUrl.parse(raw ?? {})
    const url = parsed.url?.trim()
    return m.createTab(url && url.length > 0 ? url : 'velo://newtab')
  })

  ipcMain.handle(IPC.tabsClose, (_e, raw) => {
    const { tabId: id } = tabIdPayload.parse(raw)
    requireManager().closeTab(id)
  })

  ipcMain.handle(IPC.tabsPin, (_e, raw) => {
    const { tabId: id } = tabIdPayload.parse(raw)
    return requireManager().pinTab(id)
  })

  ipcMain.handle(IPC.tabsUnpin, (_e, raw) => {
    const { tabId: id } = tabIdPayload.parse(raw)
    return requireManager().unpinTab(id)
  })

  ipcMain.handle(IPC.tabsSetMuted, (_e, raw) => {
    const { tabId, muted } = z.object({ tabId: z.number().int().positive(), muted: z.boolean() }).parse(raw)
    return requireManager().setTabMuted(tabId, muted)
  })

  ipcMain.handle(IPC.tabsSetActive, (_e, raw) => {
    const { tabId: id } = tabIdPayload.parse(raw)
    requireManager().setActiveTab(id)
  })

  ipcMain.handle(IPC.tabsGetState, () => {
    const m = requireManager()
    return { tabs: m.getSnapshots(), activeId: m.getActiveTabId(), focusedTabId: m.getFocusedNavTabId() }
  })

  ipcMain.handle(IPC.tabsSplitCreate, (_e, raw) => {
    const { tabId } = z.object({ tabId: z.number().int().positive() }).parse(raw)
    return requireManager().createSplitWithActive(tabId)
  })

  ipcMain.handle(IPC.tabsSplitExit, (_e, raw) => {
    const { tabId, mode } = z
      .object({
        tabId: z.number().int().positive(),
        mode: z.enum(['both', 'left', 'right']).default('both')
      })
      .parse(raw)
    return requireManager().exitSplitView(tabId, mode)
  })

  ipcMain.handle(IPC.tabsSplitSetRatio, (_e, raw) => {
    const { tabId, ratio } = z
      .object({ tabId: z.number().int().positive(), ratio: z.number().finite() })
      .parse(raw)
    return requireManager().setSplitRatio(tabId, ratio)
  })

  ipcMain.handle(IPC.tabsSplitSetFocus, (_e, raw) => {
    const { tabId, pane } = z
      .object({ tabId: z.number().int().positive(), pane: z.enum(['left', 'right']) })
      .parse(raw)
    return requireManager().setSplitFocusedPane(tabId, pane)
  })

  ipcMain.handle(IPC.tabsSplitSwap, (_e, raw) => {
    const { tabId } = z.object({ tabId: z.number().int().positive() }).parse(raw)
    return requireManager().swapSplitPanes(tabId)
  })

  ipcMain.on(IPC.splitDividerDragStart, (event) => {
    const mgr = requireManager()
    const divider = mgr.getSplitDividerWebContents()
    if (!divider || event.sender.id !== divider.id) return
    mgr.onSplitDividerDragStart()
  })

  ipcMain.on(IPC.splitDividerDragMove, (event, raw) => {
    const mgr = requireManager()
    const divider = mgr.getSplitDividerWebContents()
    if (!divider || event.sender.id !== divider.id) return
    const x = typeof raw === 'number' && Number.isFinite(raw) ? raw : NaN
    mgr.onSplitDividerDragMove(x)
  })

  ipcMain.on(IPC.splitDividerDragEnd, (event) => {
    const mgr = requireManager()
    const divider = mgr.getSplitDividerWebContents()
    if (!divider || event.sender.id !== divider.id) return
    mgr.onSplitDividerDragEnd()
  })

  ipcMain.handle(IPC.workspacesList, () => requireManager().getWorkspacesState())

  ipcMain.handle(IPC.workspacesCreate, (_e, raw) => {
    const { name, icon } = z
      .object({
        name: z.string().min(1).max(64),
        icon: z.string().max(8).nullable().optional()
      })
      .parse(raw ?? {})
    return requireManager().createWorkspace(name, icon ?? null)
  })

  ipcMain.handle(IPC.workspacesRename, (_e, raw) => {
    const { workspaceId, name } = z
      .object({ workspaceId: z.string().min(1), name: z.string().min(1).max(64) })
      .parse(raw)
    return requireManager().renameWorkspace(workspaceId, name)
  })

  ipcMain.handle(IPC.workspacesDelete, (_e, raw) => {
    const { workspaceId } = z.object({ workspaceId: z.string().min(1) }).parse(raw)
    return requireManager().deleteWorkspace(workspaceId)
  })

  ipcMain.handle(IPC.workspacesReorder, (_e, raw) => {
    const { orderedIds } = z.object({ orderedIds: z.array(z.string().min(1)) }).parse(raw)
    return requireManager().reorderWorkspaces(orderedIds)
  })

  ipcMain.handle(IPC.workspacesSwitch, (_e, raw) => {
    const { workspaceId } = z.object({ workspaceId: z.string().min(1) }).parse(raw)
    return requireManager().switchWorkspace(workspaceId)
  })

  ipcMain.handle(IPC.navSubmit, (_e, raw) => {
    const { tabId, input } = navSubmit.parse(raw)
    requireManager().navigateTab(tabId, input)
  })

  ipcMain.handle(IPC.navBack, (_e, raw) => {
    const { tabId } = tabIdPayload.parse(raw)
    requireManager().goBack(tabId)
  })

  ipcMain.handle(IPC.navForward, (_e, raw) => {
    const { tabId } = tabIdPayload.parse(raw)
    requireManager().goForward(tabId)
  })

  ipcMain.handle(IPC.navReload, (_e, raw) => {
    const { tabId } = tabIdPayload.parse(raw)
    requireManager().reload(tabId)
  })

  ipcMain.handle(IPC.navStop, (_e, raw) => {
    const { tabId } = tabIdPayload.parse(raw)
    requireManager().stop(tabId)
  })

  ipcMain.handle(IPC.bookmarksList, () => settings.listBookmarks())

  ipcMain.handle(IPC.bookmarksAdd, (_e, raw) => {
    const p = bookmarkAdd.parse(raw)
    return settings.addBookmark({
      url: p.url,
      title: p.title,
      folderId: p.folderId,
      favicon: p.favicon
    })
  })

  ipcMain.handle(IPC.bookmarksFoldersList, () => settings.listBookmarkFolders())

  ipcMain.handle(IPC.bookmarksFolderAdd, (_e, raw) => {
    const { name } = bookmarkFolderAdd.parse(raw)
    return settings.addBookmarkFolder(name)
  })

  ipcMain.handle(IPC.bookmarksFolderRemove, (_e, raw) => {
    const { id } = bookmarkFolderRemove.parse(raw)
    settings.removeBookmarkFolder(id)
  })

  ipcMain.handle(IPC.bookmarksRemove, (_e, raw) => {
    const { id } = bookmarkRemove.parse(raw)
    settings.removeBookmark(id)
  })

  ipcMain.handle(IPC.historyList, (_e, raw) => {
    const lim = z.object({ limit: z.number().int().positive().max(5000).optional() }).parse(raw ?? {})
    return history.listHistory(lim.limit ?? 200)
  })

  ipcMain.handle(IPC.historyClear, () => history.clearHistory())

  ipcMain.handle(IPC.settingsGet, () => settings.getSettings())

  ipcMain.handle(IPC.settingsSet, (_e, raw) => {
    const patch = settingsPatch.parse(raw)
    const next = settings.setSettings(patch)
    afterSettingsPersisted(patch, next)
    return next
  })

  ipcMain.handle(IPC.downloadsList, () => downloads.listDownloads())

  ipcMain.handle(IPC.downloadsRemove, (_e, raw) => {
    const { id } = downloadRemovePayload.parse(raw)
    downloads.removeDownload(id)
    return downloads.listDownloads()
  })

  ipcMain.handle(IPC.downloadsApplyAction, (_e, raw) => {
    const { id } = downloadRemovePayload.parse(raw)
    downloads.applyUserDownloadAction(id)
    return downloads.listDownloads()
  })

  ipcMain.handle(IPC.downloadsOpenFile, (_e, raw) => {
    const { id } = downloadRemovePayload.parse(raw)
    return downloads.openDownloadFile(id)
  })

  ipcMain.handle(IPC.devtoolsOpenPage, () => {
    TabManager.manager?.openOrTogglePageDevTools()
  })

  ipcMain.handle(IPC.devtoolsOpenShell, (e) => {
    e.sender.openDevTools(shellDevtoolsOpenOptions)
  })

  ipcMain.handle(IPC.shellOpenNewTabShortcutModal, () => TabManager.runOpenNewTabShortcutModalInActiveTab())

  ipcMain.handle(IPC.internalSettingsGet, (e) => {
    assertVeloPage(e.sender)
    return settings.getSettings()
  })

  ipcMain.handle(IPC.internalSettingsSet, (e, raw) => {
    assertVeloPage(e.sender)
    const patch = settingsPatch.parse(raw)
    const next = settings.setSettings(patch)
    afterSettingsPersisted(patch, next)
    return next
  })

  ipcMain.handle(IPC.internalPickDownloadFolder, async (e) => {
    assertVeloPage(e.sender)
    const win = getMainWindow()
    const current = settings.getSettings().downloadDirectory
    const openOpts: OpenDialogOptions = {
      title: 'Select download folder',
      defaultPath: current,
      properties: ['openDirectory', 'createDirectory']
    }
    const result =
      win && !win.isDestroyed()
        ? await dialog.showOpenDialog(win, openOpts)
        : await dialog.showOpenDialog(openOpts)
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.internalRelaunchApp, (e) => {
    assertVeloPage(e.sender)
    app.relaunch()
    app.quit()
  })

  ipcMain.handle(IPC.internalWelcomeComplete, (e) => {
    assertVeloPage(e.sender)
    settings.setWelcomeOnboardingComplete()
  })

  ipcMain.handle(IPC.internalDefaultBrowserGet, (e) => {
    assertShellOrVeloPage(e.sender)
    return getDefaultBrowserStatus()
  })

  ipcMain.handle(IPC.internalDefaultBrowserRegister, async (e) => {
    assertShellOrVeloPage(e.sender)
    return await registerVeloAsDefaultBrowser()
  })

  ipcMain.handle(IPC.internalDefaultBrowserOpenSettings, (e, raw) => {
    assertShellOrVeloPage(e.sender)
    const page = z.enum(['default-apps', 'installed-apps']).optional().parse(raw)
    openSystemDefaultBrowserSettings(page ?? 'default-apps')
    return undefined
  })

  ipcMain.handle(IPC.internalDefaultBrowserRegisterAndOpenSettings, async (e) => {
    assertShellOrVeloPage(e.sender)
    return await registerVeloAsDefaultBrowserAndOpenSystemSettings()
  })

  ipcMain.handle(IPC.internalAutoUpdateGetStatus, (e) => {
    assertShellOrVeloPage(e.sender)
    return getAutoUpdateStatus()
  })

  ipcMain.handle(IPC.internalAutoUpdateCheck, (e) => {
    assertShellOrVeloPage(e.sender)
    checkForUpdatesNow()
    return undefined
  })

  ipcMain.handle(IPC.internalAutoUpdateQuitAndInstall, (e) => {
    assertShellOrVeloPage(e.sender)
    quitAndInstallUpdate()
    return undefined
  })

  ipcMain.handle(IPC.internalHistoryList, (e, raw) => {
    assertVeloPage(e.sender)
    const lim = z.object({ limit: z.number().int().positive().max(5000).optional() }).parse(raw ?? {})
    return history.listHistory(lim.limit ?? 100)
  })

  ipcMain.handle(IPC.internalHistoryRemove, (e, raw) => {
    assertVeloPage(e.sender)
    const { ids } = historyRemovePayload.parse(raw)
    return history.removeHistoryEntries(ids)
  })

  ipcMain.handle(IPC.internalBookmarksList, (e) => {
    assertVeloPage(e.sender)
    return settings.listBookmarks()
  })

  ipcMain.handle(IPC.internalBookmarksLibrary, (e) => {
    assertVeloPage(e.sender)
    return settings.getBookmarksLibrary()
  })

  ipcMain.handle(IPC.internalBookmarksRemove, (e, raw) => {
    assertVeloPage(e.sender)
    const { id } = bookmarkRemove.parse(raw)
    settings.removeBookmark(id)
  })

  ipcMain.handle(IPC.internalBookmarkFolderAdd, (e, raw) => {
    assertVeloPage(e.sender)
    const { name } = bookmarkFolderAdd.parse(raw)
    return settings.addBookmarkFolder(name)
  })

  ipcMain.handle(IPC.internalBookmarkFolderRemove, (e, raw) => {
    assertVeloPage(e.sender)
    const { id } = bookmarkFolderRemove.parse(raw)
    settings.removeBookmarkFolder(id)
  })

  ipcMain.handle(IPC.internalDownloadsList, (e) => {
    assertVeloPage(e.sender)
    return downloads.listDownloads()
  })

  ipcMain.handle(IPC.internalDownloadsReveal, (e, raw) => {
    assertVeloPage(e.sender)
    const { path: filePath } = revealDownloadPayload.parse(raw)
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle(IPC.internalDownloadsOpen, (e, raw) => {
    assertVeloPage(e.sender)
    const { id } = downloadRemovePayload.parse(raw)
    return downloads.openDownloadFile(id)
  })

  ipcMain.handle(IPC.internalNewTabShortcutsList, (e) => {
    assertVeloPage(e.sender)
    return settings.listNewTabShortcuts()
  })

  ipcMain.handle(IPC.internalNewTabShortcutAdd, (e, raw) => {
    try {
      assertVeloPage(e.sender)
      const { label, url } = newTabShortcutAdd.parse(raw)
      return settings.addNewTabShortcut(label, url)
    } catch (err) {
      console.error('[velo IPC] internalNewTabShortcutAdd failed', err)
      throw err
    }
  })

  ipcMain.handle(IPC.internalNewTabShortcutUpdate, (e, raw) => {
    try {
      assertVeloPage(e.sender)
      const { id, label, url } = newTabShortcutUpdate.parse(raw)
      return settings.updateNewTabShortcut(id, label, url)
    } catch (err) {
      console.error('[velo IPC] internalNewTabShortcutUpdate failed', err)
      throw err
    }
  })

  ipcMain.handle(IPC.internalNewTabShortcutRemove, (e, raw) => {
    assertVeloPage(e.sender)
    const { id } = newTabShortcutRemove.parse(raw)
    settings.removeNewTabShortcut(id)
  })

  ipcMain.handle(IPC.internalNewTabShortcutsReorder, (e, raw) => {
    try {
      assertVeloPage(e.sender)
      const { orderedIds } = newTabShortcutsReorder.parse(raw)
      settings.reorderNewTabShortcuts(orderedIds)
    } catch (err) {
      console.error('[velo IPC] internalNewTabShortcutsReorder failed', err)
      throw err
    }
  })

  ipcMain.handle(IPC.internalBrowserDataDetectSources, (e) => {
    assertVeloPage(e.sender)
    return browserDataImport.detectChromiumSources()
  })

  ipcMain.handle(IPC.internalBrowserDataImportChromium, async (e, raw) => {
    assertVeloPage(e.sender)
    const opts = browserDataImportChromiumPayload.parse(raw)
    return await browserDataImport.importFromChromiumBrowser(opts as ImportChromiumBrowserOptions)
  })

  ipcMain.handle(IPC.internalNavigateSearch, (e, raw) => {
    assertVeloPage(e.sender)
    const { query } = searchQueryPayload.parse(raw)
    const url = resolveNavigation(query, settings.getSettings().searchEngine)
    recordTabCommittedUrl(e.sender, url)
    void e.sender.loadURL(url)
  })

  ipcMain.handle(IPC.internalNavigateUrl, (e, raw) => {
    assertVeloPage(e.sender)
    let url = navigateUrlPayload.parse(raw).url.trim()
    if (!/^https?:\/\//i.test(url) && !url.startsWith('velo://')) {
      url = `https://${url.replace(/^\/+/, '')}`
    }
    recordTabCommittedUrl(e.sender, url)
    void e.sender.loadURL(url)
  })

  ipcMain.handle(IPC.tabRetryNavigation, (e, raw) => {
    const m = requireManager()
    if (!m.isTabWebContents(e.sender)) {
      throw new Error('retry navigation denied')
    }
    let url = navigateUrlPayload.parse(raw).url.trim()
    if (!/^https?:\/\//i.test(url) && !url.startsWith('velo://')) {
      url = `https://${url.replace(/^\/+/, '')}`
    }
    recordTabCommittedUrl(e.sender, url)
    void e.sender.loadURL(url)
  })

  ipcMain.on(IPC.windowMinimize, () => {
    getMainWindow()?.minimize()
  })

  ipcMain.on(IPC.windowMaximizeToggle, () => {
    const w = getMainWindow()
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })

  ipcMain.on(IPC.windowClose, () => {
    getMainWindow()?.close()
  })

  ipcMain.handle(IPC.shellOverflowMenuSetReserve, (event, reserve: unknown) => {
    const shell = getChromeWebContents()
    if (!shell || event.sender.id !== shell.id) return
    const px =
      typeof reserve === 'number' && Number.isFinite(reserve) ? Math.max(0, Math.min(420, Math.floor(reserve))) : 0
    TabManager.manager?.setOverflowMenuShellReserve(px)
  })

  ipcMain.handle(IPC.shellDownloadsPopoverSetReserve, (event, reserve: unknown) => {
    const shell = getChromeWebContents()
    if (!shell || event.sender.id !== shell.id) return
    const px =
      typeof reserve === 'number' && Number.isFinite(reserve) ? Math.max(0, Math.min(420, Math.floor(reserve))) : 0
    TabManager.manager?.setDownloadsPopoverShellReserve(px)
  })

  ipcMain.handle(IPC.shellSiteInfoPopoverSetReserve, (event, reserve: unknown) => {
    const shell = getChromeWebContents()
    if (!shell || event.sender.id !== shell.id) return
    const px =
      typeof reserve === 'number' && Number.isFinite(reserve) ? Math.max(0, Math.min(420, Math.floor(reserve))) : 0
    TabManager.manager?.setSiteInfoPopoverShellReserve(px)
  })

  ipcMain.handle(IPC.shellBookmarkModalSetReserve, (event, reserve: unknown) => {
    const shell = getChromeWebContents()
    if (!shell || event.sender.id !== shell.id) return
    const win = getMainWindow()
    const contentH = win && !win.isDestroyed() ? win.getContentBounds().height : 0
    const maxExtra = Math.max(0, Math.floor(contentH) - CHROME_HEIGHT)
    const raw =
      typeof reserve === 'number' && Number.isFinite(reserve) ? Math.trunc(reserve) : 0
    
    const px = raw > 0 ? maxExtra : 0
    TabManager.manager?.setBookmarkModalShellReserve(px)
  })

  ipcMain.handle(IPC.shellEnsureChromeOnTop, (event) => {
    const shell = getChromeWebContents()
    if (!shell || event.sender.id !== shell.id) return
    TabManager.manager?.raiseShellChrome()
  })

  ipcMain.handle(IPC.omnibarFetchSuggestions, async (event, raw) => {
    const shell = getChromeWebContents()
    if (!shell || event.sender.id !== shell.id) throw new Error('omnibar suggestions denied')
    const { query } = omnibarSuggestQuery.parse(raw)
    return fetchOmnibarSuggestionsForShell(query)
  })

  const passwordTabMsg = z.discriminatedUnion('type', [
    z.object({ type: z.literal('ping') }),
    z.object({ type: z.literal('openPasswordSettings') }),
    z.object({
      type: z.literal('offer'),
      domain: z.string().max(253),
      username: z.string().max(2048),
      password: z.string().max(4096)
    }),
    z.object({
      type: z.literal('requestFill'),
      hostname: z.string().max(253),
      mode: z.enum(['hotkey', 'auto']).optional(),
      anchorField: z.enum(['password', 'username', 'hotkey']).optional()
    })
  ])

  ipcMain.handle(IPC.passwordTabBridge, async (e, raw) => {
    const m = requireManager()
    if (!m.isTabWebContents(e.sender)) throw new Error('password IPC denied')
    const tabId = m.getTabIdForWebContents(e.sender)
    if (tabId == null) throw new Error('password tab id')
    const msg = passwordTabMsg.parse(raw)
    const s = settings.getSettings()

    if (msg.type === 'ping') {
      return {
        offerToSave: s.passwordOfferToSave,
        autofillOnFocus: s.passwordAutofillOnFocus,
        autofillHotkey: s.passwordAutofillHotkey,
        vaultUnlocked: vault.isUnlocked(),
        neverDomains: s.passwordsNeverSaveDomains
      }
    }

    if (msg.type === 'openPasswordSettings') {
      const url = 'velo://settings/password-manager'
      recordTabCommittedUrl(e.sender, url)
      void e.sender.loadURL(url)
      return { ok: true as const }
    }

    if (msg.type === 'requestFill') {
      if (msg.mode === 'hotkey') {
        if (!s.passwordAutofillHotkey) return { credentials: [] as { username: string; password: string }[] }
      } else {
        if (!s.passwordAutofillOnFocus) return { credentials: [] as { username: string; password: string }[] }
      }
      if (!vault.isUnlocked()) return { credentials: [] as { username: string; password: string }[] }
      const host = vault.normalizeDomain(msg.hostname)
      const credentials = vault
        .getForDomain(host)
        .map((c) => ({ username: c.username, password: c.password }))
      const mode = msg.mode === 'hotkey' ? 'hotkey' : 'auto'
      const anchorField: PasswordAnchorField = msg.anchorField ?? 'hotkey'
      if (credentials.length > 0) {
        try {
          const js = buildPasswordPickerScript(credentials, mode, anchorField)
          await e.sender.executeJavaScript(js, true)
        } catch {}
      }
      return { credentials }
    }

    if (!s.passwordOfferToSave) return { ok: true as const, ignored: true }
    if (!vault.vaultFileExists()) return { ok: true as const, ignored: true }
    const d = vault.normalizeDomain(msg.domain)
    if (!d) return { ok: true as const, ignored: true }
    if (s.passwordsNeverSaveDomains.includes(d)) return { ok: true as const, ignored: true }
    if (!vault.isUnlocked()) return { ok: true as const, ignored: true }
    if (vault.entryExists(d, msg.username, msg.password)) {
      return { ok: true as const, ignored: true }
    }
    if (m.getActiveTabId() !== tabId) return { ok: true as const, ignored: true }

    const bar: PasswordBarState = {
      open: true,
      tabId,
      domain: d,
      username: msg.username,
      password: msg.password
    }
    m.publishPasswordBarState(bar)
    return { ok: true as const, ignored: false }
  })

  const passwordBarPayload = z.object({
    tabId: z.number().int().positive(),
    domain: z.string().max(253),
    username: z.string().max(2048),
    password: z.string().max(4096)
  })

  ipcMain.handle(IPC.passwordBarSave, (e, raw) => {
    const sh = getChromeWebContents()
    if (!sh || e.sender.id !== sh.id) throw new Error('denied')
    const p = passwordBarPayload.parse(raw)
    if (!vault.isUnlocked()) throw new Error('vault locked')
    vault.addEntry(p.domain, p.username, p.password)
    TabManager.manager?.closePasswordBar()
  })

  ipcMain.handle(IPC.passwordBarNever, (e, raw) => {
    const sh = getChromeWebContents()
    if (!sh || e.sender.id !== sh.id) throw new Error('denied')
    const { domain } = z.object({ tabId: z.number().int().positive(), domain: z.string().max(253) }).parse(raw)
    const d = vault.normalizeDomain(domain)
    const cur = settings.getSettings().passwordsNeverSaveDomains
    if (!cur.includes(d)) {
      settings.setSettings({ passwordsNeverSaveDomains: [...cur, d] })
    }
    TabManager.manager?.closePasswordBar()
  })

  ipcMain.handle(IPC.passwordBarDismiss, (e, raw) => {
    const sh = getChromeWebContents()
    if (!sh || e.sender.id !== sh.id) throw new Error('denied')
    z.object({ tabId: z.number().int().positive() }).parse(raw)
    TabManager.manager?.closePasswordBar()
  })

  ipcMain.handle(IPC.shellOmnibarSuggestSetReserve, (event, reserve: unknown) => {
    const shell = getChromeWebContents()
    if (!shell || event.sender.id !== shell.id) return
    const px =
      typeof reserve === 'number' && Number.isFinite(reserve) ? Math.max(0, Math.min(420, Math.floor(reserve))) : 0
    TabManager.manager?.setOmnibarSuggestShellReserve(px)
  })

  ipcMain.handle(IPC.shellPasswordBarSetReserve, (event, reserve: unknown) => {
    const sh = getChromeWebContents()
    if (!sh || event.sender.id !== sh.id) return
    const px =
      typeof reserve === 'number' && Number.isFinite(reserve) ? Math.max(0, Math.min(120, Math.floor(reserve))) : 0
    TabManager.manager?.setPasswordBarShellReserve(px)
  })

  ipcMain.handle(IPC.shellDefaultBrowserPromptSetReserve, (event, reserve: unknown) => {
    const sh = getChromeWebContents()
    if (!sh || event.sender.id !== sh.id) return
    const px =
      typeof reserve === 'number' && Number.isFinite(reserve) ? Math.max(0, Math.min(120, Math.floor(reserve))) : 0
    TabManager.manager?.setDefaultBrowserPromptShellReserve(px)
  })

  ipcMain.handle(IPC.internalPasswordVaultExists, (e) => {
    assertVeloPage(e.sender)
    return vault.vaultFileExists()
  })

  ipcMain.handle(IPC.internalPasswordVaultNeedsMigration, (e) => {
    assertVeloPage(e.sender)
    return vault.vaultNeedsMigration()
  })

  ipcMain.handle(IPC.internalPasswordVaultMigrate, (e, raw) => {
    assertVeloPage(e.sender)
    const { passphrase } = z
      .object({
        passphrase: z.string().min(1).max(1024)
      })
      .parse(raw)
    vault.migrateFromV1Passphrase(passphrase)
    clearDeviceWrappedPassphrase()
    return { ok: true as const }
  })

  ipcMain.handle(IPC.internalPasswordVaultOsKeyAvailable, (e) => {
    assertVeloPage(e.sender)
    return vault.isOsKeyStorageAvailable()
  })

  ipcMain.handle(IPC.internalPasswordVaultUnlocked, (e) => {
    assertVeloPage(e.sender)
    return vault.isUnlocked()
  })

  ipcMain.handle(IPC.internalPasswordVaultList, (e) => {
    assertVeloPage(e.sender)
    if (!vault.isUnlocked()) throw new Error('Password vault is not available. Migrate in Settings if you upgraded from an older Velo.')
    return vault.listEntries()
  })

  ipcMain.handle(IPC.internalPasswordVaultDelete, (e, raw) => {
    assertVeloPage(e.sender)
    const { id } = z.object({ id: z.string().min(1).max(64) }).parse(raw)
    if (!vault.isUnlocked()) throw new Error('vault locked')
    vault.deleteEntry(id)
  })

  ipcMain.handle(IPC.internalPasswordVaultImport, async (e) => {
    assertVeloPage(e.sender)
    if (!vault.isUnlocked()) throw new Error('vault locked')
    const win = getMainWindow()
    const openCsvOpts: OpenDialogOptions = {
      title: 'Import passwords (CSV)',
      filters: [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'All', extensions: ['*'] }
      ],
      properties: ['openFile']
    }
    const res =
      win && !win.isDestroyed()
        ? await dialog.showOpenDialog(win, openCsvOpts)
        : await dialog.showOpenDialog(openCsvOpts)
    if (res.canceled || !res.filePaths[0]) return { imported: 0 }
    const text = readFileSync(res.filePaths[0], 'utf8')
    const rows = parsePasswordCsv(text)
    if (rows.length === 0) return { imported: 0 }
    const existing = vault.listEntries()
    if (existing.length > 0) {
      const mergeMsg = {
        type: 'question' as const,
        buttons: ['Cancel', 'Import'],
        defaultId: 1,
        cancelId: 0,
        message: 'Import passwords?',
        detail: `This will merge ${rows.length} row(s) with your vault (same site + username will be updated).`,
        noLink: true
      }
      const confirm =
        win && !win.isDestroyed()
          ? await dialog.showMessageBox(win, mergeMsg)
          : await dialog.showMessageBox(mergeMsg)
      if (confirm.response !== 1) return { imported: 0 }
    }
    const n = vault.importRows(rows)
    return { imported: n }
  })

  ipcMain.handle(IPC.internalPasswordVaultExport, async (e) => {
    assertVeloPage(e.sender)
    if (!vault.isUnlocked()) throw new Error('vault locked')
    const entries = vault.listEntries()
    if (entries.length === 0) return { ok: false as const, reason: 'empty' }
    const win = getMainWindow()
    const exportWarn = {
      type: 'warning' as const,
      buttons: ['Cancel', 'Export'],
      defaultId: 1,
      cancelId: 0,
      message: 'Export passwords?',
      detail: 'CSV files are not encrypted. Store the export safely and delete it when done.',
      noLink: true
    }
    const confirm =
      win && !win.isDestroyed() ? await dialog.showMessageBox(win, exportWarn) : await dialog.showMessageBox(exportWarn)
    if (confirm.response !== 1) return { ok: false as const, reason: 'cancelled' }
    const saveOpts = {
      title: 'Export passwords',
      defaultPath: 'velo-passwords.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    }
    const res =
      win && !win.isDestroyed()
        ? await dialog.showSaveDialog(win, saveOpts)
        : await dialog.showSaveDialog(saveOpts)
    if (res.canceled || !res.filePath) return { ok: false as const, reason: 'cancelled' }
    writeFileSync(res.filePath, formatPasswordCsv(entries), 'utf8')
    return { ok: true as const, path: res.filePath }
  })

  ipcMain.handle(IPC.internalClearBrowsingData, async (e, raw) => {
    assertVeloPage(e.sender)
    const payload = clearBrowsingDataPayload.parse(raw)
    if (
      !payload.history &&
      !payload.cookies &&
      !payload.cache &&
      !payload.passwords &&
      !payload.downloads
    ) {
      throw new Error('Select at least one data type to clear.')
    }
    return await executeClearBrowsingData(payload)
  })
}
