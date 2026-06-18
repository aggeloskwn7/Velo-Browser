import { BaseWindow, Notification, WebContentsView, type Session, type WebContents } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHROME_HEIGHT, TAB_WEBCONTENTS_VIEW_BACKGROUND } from '../shared/constants.js'
import { IPC, type BrowserChromeTheme, type SplitExitMode, type SplitPaneSnapshot, type TabSnapshot, type VeloSettings, type WorkspaceSnapshot, type WorkspacesStatePayload } from '../shared/ipc.js'
import { resolveNavigation } from './navigation.js'
import { getSettings } from './settings-store.js'
import { recordVisit } from './history-store.js'
import { getLastTabCommittedUrl, recordTabCommittedUrl } from './velo-page-origin.js'
import { tabStripFavicon } from './tab-icons.js'
import { harvestFaviconCandidates, normalizeFaviconForShell, shellCanDisplayFavicon } from './favicon-harvest.js'
import { devtoolsOpenOptions } from './devtools.js'
import { buildNetworkErrorDataUrl, isLoadFailureIgnored, isOurErrorPageUrl } from './load-error-page.js'
import { cancelBrowsingSessionPersist } from './last-session-store.js'
import { isPinnableUrl } from './pinned-tabs-store.js'
import {
  defaultWorkspaceSession,
  generateWorkspaceId,
  loadOrMigrateWorkspacesRegistry,
  readWorkspaceSession,
  writeWorkspaceSessionSync,
  writeWorkspacesRegistrySync,
  type PersistedTabEntry,
  type WorkspaceDefinition,
  type WorkspaceSessionV1,
  type WorkspacesRegistryV1
} from './workspaces-store.js'
import {
  SPLIT_DEFAULT_RATIO,
  SPLIT_DIVIDER_PX,
  computeSplitWidths,
  splitPaneForTabId,
  splitPrimaryTabId,
  splitTabIdForPane,
  type SplitPane,
  type SplitSession
} from './split-view.js'
import { buildPasswordInjectScript } from './password-inject-script.js'
import { buildWebAuthnGuardScript } from './webauthn-guard-script.js'
import { clearAdblockNotifyForTab, clearAllAdblockNotify } from './adblock-notify.js'
import type { PasswordBarState } from '../shared/ipc.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function getTabPreloadPath(): string {
  return join(__dirname, '../preload/tab.mjs')
}

export function getSplitDividerPreloadPath(): string {
  return join(__dirname, '../preload/splitDivider.mjs')
}

function tabHostnameFromUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const proto = /^([a-z][a-z0-9+.-]*):/i.exec(t)?.[1]?.toLowerCase()
  if (
    proto === 'velo' ||
    proto === 'about' ||
    proto === 'data' ||
    proto === 'file' ||
    proto === 'chrome-devtools'
  ) {
    return null
  }
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    let h = u.hostname.toLowerCase()
    if (!h) return null
    if (h.startsWith('www.')) h = h.slice(4)
    return h
  } catch {
    return null
  }
}

function hostnameIsPinned(hostname: string, pins: string[]): boolean {
  const h = hostname.toLowerCase()
  for (const p of pins) {
    const pin = p.trim().toLowerCase()
    if (!pin) continue
    if (h === pin) return true
    if (h.endsWith('.' + pin)) return true
  }
  return false
}

function urlEligibleForBackgroundRest(
  url: string,
  pins: string[],
  tabPinned: boolean
): boolean {
  if (tabPinned) return false
  const host = tabHostnameFromUrl(url)
  if (!host) return false
  if (hostnameIsPinned(host, pins)) return false
  return true
}

type TabRecord = {
  id: number
  view: WebContentsView
  favicon: string | null
  pinned: boolean
  workspaceId: string
  splitId: string | null
}

type WorkspaceRuntime = WorkspaceDefinition & {
  tabOrder: number[]
  activeTabId: number | null
  materialized: boolean
}

export class TabManager {
  private readonly tabs = new Map<number, TabRecord>()
  private readonly workspaces = new Map<string, WorkspaceRuntime>()
  private workspaceOrder: string[] = []
  private activeWorkspaceId = ''
  private nextId = 1
  private shuttingDown = false
  private broadcastDebounceTimer: ReturnType<typeof setTimeout> | null = null
  
  private downloadsPopoverShellReserve = 0
  
  private siteInfoPopoverShellReserve = 0
  
  private overflowMenuShellReserve = 0
  
  private passwordBarShellReserve = 0

  private defaultBrowserPromptShellReserve = 0
  
  private bookmarkModalShellReserve = 0
  
  private omnibarSuggestShellReserve = 0
  private passwordBarTargetTabId: number | null = null

  private tabLastBackgroundAt = new Map<number, number>()
  private tabResting = new Map<number, boolean>()
  private restingTimers = new Map<number, ReturnType<typeof setTimeout>>()
  private wcIdToTabId = new Map<number, number>()
  private lastUnresponsiveNotifyAt = new Map<number, number>()
  private workspacePersistTimer: ReturnType<typeof setTimeout> | null = null

  private readonly splits = new Map<string, SplitSession>()
  private splitDividerView: WebContentsView | null = null
  private splitDragActive = false
  private splitFocusCssKeys = new Map<number, string>()

  constructor(
    private readonly window: BaseWindow,
    private readonly session: Session,
    private readonly tabPreloadPath: string,
    
    private readonly chromeView: WebContentsView
  ) {}

  private hasActiveWorkspace(): boolean {
    return this.activeWorkspaceId.length > 0 && this.workspaces.has(this.activeWorkspaceId)
  }

  private activeWs(): WorkspaceRuntime | null {
    if (!this.hasActiveWorkspace()) return null
    return this.workspaces.get(this.activeWorkspaceId) ?? null
  }

  private ensureDefaultWorkspace(): void {
    if (this.hasActiveWorkspace()) return
    if (this.workspaceOrder.length > 0) {
      const fallback = this.workspaceOrder.find((id) => this.workspaces.has(id))
      if (fallback) {
        this.activeWorkspaceId = fallback
        return
      }
    }
    const id = generateWorkspaceId()
    const def: WorkspaceDefinition = {
      id,
      name: 'Personal',
      icon: '🏠',
      createdAt: Date.now()
    }
    this.workspaces.set(id, {
      ...def,
      tabOrder: [],
      activeTabId: null,
      materialized: false
    })
    this.workspaceOrder.push(id)
    this.activeWorkspaceId = id
    writeWorkspacesRegistrySync(this.buildRegistry())
  }

  private get tabOrder(): number[] {
    return this.activeWs()?.tabOrder ?? []
  }

  private get activeTabId(): number | null {
    return this.activeWs()?.activeTabId ?? null
  }

  private set activeTabId(id: number | null) {
    const ws = this.activeWs()
    if (ws) ws.activeTabId = id
  }

  private wsTabOrder(wsId: string): number[] {
    return this.workspaces.get(wsId)?.tabOrder ?? []
  }

  getChromeExtraShellHeight(): number {
    return (
      this.downloadsPopoverShellReserve +
      this.siteInfoPopoverShellReserve +
      this.overflowMenuShellReserve +
      this.bookmarkModalShellReserve +
      this.passwordBarShellReserve +
      this.defaultBrowserPromptShellReserve +
      this.omnibarSuggestShellReserve
    )
  }

  
  tabContentTopPx(): number {
    return CHROME_HEIGHT
  }

  
  chromeShellHeightPx(): number {
    return CHROME_HEIGHT + this.getChromeExtraShellHeight()
  }

  private applyChromeShellBounds(): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    const cb = this.window.getContentBounds()
    const w = Math.max(0, Math.floor(cb.width))
    this.chromeView.setBounds({
      x: 0,
      y: 0,
      width: w,
      height: this.chromeShellHeightPx()
    })
  }

  setDownloadsPopoverShellReserve(px: number): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    const next = Math.max(0, Math.min(420, Math.floor(px)))
    if (next === this.downloadsPopoverShellReserve) return
    this.downloadsPopoverShellReserve = next
    this.applyChromeShellBounds()
    this.layout()
    this.keepChromeOnTop()
  }

  setSiteInfoPopoverShellReserve(px: number): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    const next = Math.max(0, Math.min(420, Math.floor(px)))
    if (next === this.siteInfoPopoverShellReserve) return
    this.siteInfoPopoverShellReserve = next
    this.applyChromeShellBounds()
    this.layout()
    this.keepChromeOnTop()
    if (next > 0) {
      queueMicrotask(() => {
        if (this.shuttingDown || this.window.isDestroyed()) return
        this.keepChromeOnTop()
      })
    }
  }

  setOverflowMenuShellReserve(px: number): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    const next = Math.max(0, Math.min(420, Math.floor(px)))
    if (next === this.overflowMenuShellReserve) return
    this.overflowMenuShellReserve = next
    this.applyChromeShellBounds()
    this.layout()
    this.keepChromeOnTop()
  }

  setPasswordBarShellReserve(px: number): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    const next = Math.max(0, Math.min(120, Math.floor(px)))
    if (next === this.passwordBarShellReserve) return
    this.passwordBarShellReserve = next
    this.applyChromeShellBounds()
    this.layout()
    this.keepChromeOnTop()
  }

  setDefaultBrowserPromptShellReserve(px: number): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    const next = Math.max(0, Math.min(120, Math.floor(px)))
    if (next === this.defaultBrowserPromptShellReserve) return
    this.defaultBrowserPromptShellReserve = next
    this.applyChromeShellBounds()
    this.layout()
    this.keepChromeOnTop()
  }

  setOmnibarSuggestShellReserve(px: number): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    const next = Math.max(0, Math.min(420, Math.floor(px)))
    if (next === this.omnibarSuggestShellReserve) return
    this.omnibarSuggestShellReserve = next
    this.applyChromeShellBounds()
    this.layout()
    if (next > 0) {
      
      this.raiseShellChromeForOverlay()
      queueMicrotask(() => {
        if (this.shuttingDown || this.window.isDestroyed()) return
        this.raiseShellChromeForOverlay()
      })
    } else {
      this.keepChromeOnTop()
    }
  }

  
  publishPasswordBarState(state: PasswordBarState): void {
    if (state.open) {
      this.passwordBarTargetTabId = state.tabId
      this.setPasswordBarShellReserve(56)
    } else {
      this.passwordBarTargetTabId = null
      this.setPasswordBarShellReserve(0)
    }
    this.shellSend(IPC.passwordBarState, state)
  }

  closePasswordBar(): void {
    this.publishPasswordBarState({ open: false })
  }

  private maybeClosePasswordBarOnTabNavigate(tabId: number): void {
    if (this.passwordBarTargetTabId != null && this.passwordBarTargetTabId === tabId) {
      this.closePasswordBar()
    }
  }

  private injectWebAuthnGuard(wc: WebContents): void {
    const u = wc.getURL() || getLastTabCommittedUrl(wc) || ''
    if (!/^https:/i.test(u)) return
    const guard = buildWebAuthnGuardScript()
    void wc.executeJavaScript(guard, true).catch(() => {})
  }

  private injectPasswordInstrumentation(wc: WebContents): void {
    const u = wc.getURL() || getLastTabCommittedUrl(wc) || ''
    if (!/^https:/i.test(u)) return
    const guard = buildWebAuthnGuardScript()
    const js = buildPasswordInjectScript()
    void wc
      .executeJavaScript(guard, true)
      .then(() => wc.executeJavaScript(js, true))
      .catch(() => {})
  }

  private harvestFaviconForTab(tabId: number, webContents: WebContents, delayMs: number): void {
    const run = async (): Promise<void> => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
      if (this.shuttingDown || webContents.isDestroyed()) return
      const rec = this.tabs.get(tabId)
      if (!rec) return
      if (shellCanDisplayFavicon(rec.favicon)) return
      const u = webContents.getURL() || getLastTabCommittedUrl(webContents) || ''
      if (!/^https?:/i.test(u)) return
      const candidates = await harvestFaviconCandidates(webContents)
      const next = candidates[0] ?? null
      if (next) {
        rec.favicon = next
        this.scheduleBroadcast()
      }
    }
    void run()
  }

  private flushDeferredTabWork(tabId: number): void {
    const rec = this.tabs.get(tabId)
    if (!rec) return
    const wc = rec.view.webContents
    if (wc.isDestroyed()) return
    this.injectWebAuthnGuard(wc)
    this.harvestFaviconForTab(tabId, wc, 0)
    this.harvestFaviconForTab(tabId, wc, 450)
    this.injectPasswordInstrumentation(wc)
  }

  private clearRestingTimer(tabId: number): void {
    const t = this.restingTimers.get(tabId)
    if (t != null) {
      clearTimeout(t)
      this.restingTimers.delete(tabId)
    }
  }

  private clearAllRestingTimers(): void {
    for (const id of [...this.restingTimers.keys()]) {
      this.clearRestingTimer(id)
    }
  }

  private scheduleRestingCheck(tabId: number): void {
    this.clearRestingTimer(tabId)
    if (this.shuttingDown || tabId === this.activeTabId) return
    const s = getSettings()
    if (!s.autoThrottleBackgroundTabs) return
    const rec = this.tabs.get(tabId)
    if (!rec) return
    const wc = rec.view.webContents
    if (wc.isDestroyed()) return
    const url = wc.getURL() || getLastTabCommittedUrl(wc) || ''
    if (!urlEligibleForBackgroundRest(url, s.alwaysActiveHostnames, rec.pinned)) return
    try {
      if (wc.isCurrentlyAudible()) return
    } catch {}
    const threshold = this.restingThresholdMs(s)
    const started = this.tabLastBackgroundAt.get(tabId) ?? Date.now()
    const remaining = Math.max(0, threshold - (Date.now() - started))
    const timer = setTimeout(() => {
      this.restingTimers.delete(tabId)
      if (this.shuttingDown) return
      this.applyBackgroundThrottlePolicy()
    }, remaining)
    this.restingTimers.set(tabId, timer)
  }

  private rescheduleAllRestingChecks(): void {
    this.clearAllRestingTimers()
    const ws = this.activeWs()
    if (!ws) return
    for (const id of ws.tabOrder) {
      if (id !== ws.activeTabId) this.scheduleRestingCheck(id)
    }
  }

  onWindowStateChanged(): void {
    if (!this.hasActiveWorkspace()) return
    this.applyBackgroundThrottlePolicy()
  }

  setBookmarkModalShellReserve(px: number): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    const cb = this.window.getContentBounds()
    const maxExtra = Math.max(0, Math.floor(cb.height) - CHROME_HEIGHT)
    const next = Math.max(0, Math.min(Math.floor(px), maxExtra))
    if (next === this.bookmarkModalShellReserve) return
    this.bookmarkModalShellReserve = next
    this.applyChromeShellBounds()
    this.layout()
    this.keepChromeOnTop()
    if (next > 0) {
      queueMicrotask(() => {
        if (this.shuttingDown || this.window.isDestroyed()) return
        this.keepChromeOnTop()
      })
    }
  }

  
  beginShutdown(): void {
    if (this.shuttingDown) return
    this.closePasswordBar()
    cancelBrowsingSessionPersist()
    if (this.workspacePersistTimer != null) {
      clearTimeout(this.workspacePersistTimer)
      this.workspacePersistTimer = null
    }
    this.flushAllWorkspacesSync()
    this.downloadsPopoverShellReserve = 0
    this.siteInfoPopoverShellReserve = 0
    this.overflowMenuShellReserve = 0
    this.bookmarkModalShellReserve = 0
    this.passwordBarShellReserve = 0
    this.defaultBrowserPromptShellReserve = 0
    this.omnibarSuggestShellReserve = 0
    clearAllAdblockNotify()
    if (this.broadcastDebounceTimer != null) {
      clearTimeout(this.broadcastDebounceTimer)
      this.broadcastDebounceTimer = null
    }
    this.clearAllRestingTimers()
    this.tabLastBackgroundAt.clear()
    this.tabResting.clear()
    this.wcIdToTabId.clear()
    this.lastUnresponsiveNotifyAt.clear()

    this.shuttingDown = true

    if (this.splitDividerView) {
      try {
        this.window.contentView.removeChildView(this.splitDividerView)
        this.splitDividerView.webContents.close()
      } catch {}
      this.splitDividerView = null
    }
    this.splits.clear()
    this.splitFocusCssKeys.clear()

    for (const rec of this.tabs.values()) {
      try {
        rec.view.webContents.removeAllListeners()
      } catch {}
      try {
        this.window.contentView.removeChildView(rec.view)
      } catch {}
      try {
        rec.view.webContents.close()
      } catch {}
    }
    this.tabs.clear()
    this.workspaces.clear()
    this.workspaceOrder = []
    this.activeWorkspaceId = ''
  }

  private canNotifyShell(): boolean {
    if (this.shuttingDown) return false
    const wc = this.chromeView.webContents
    if (wc.isDestroyed()) return false
    if (this.window.isDestroyed()) return false
    return true
  }

  private shellSend(channel: string, payload: unknown): void {
    if (!this.canNotifyShell()) return
    try {
      this.chromeView.webContents.send(channel, payload)
    } catch {}
  }

  private scheduleBroadcast(): void {
    if (!this.canNotifyShell()) return
    if (this.broadcastDebounceTimer != null) return
    this.broadcastDebounceTimer = setTimeout(() => {
      this.broadcastDebounceTimer = null
      this.broadcastNow()
    }, 48)
  }

  private broadcastNow(): void {
    if (!this.canNotifyShell()) return
    const list = this.getSnapshots()
    this.shellSend(IPC.tabsUpdated, {
      tabs: list,
      activeId: this.activeTabId,
      focusedTabId: this.getFocusedNavTabId()
    })
    this.scheduleWorkspacePersist()
  }

  getFocusedNavTabId(): number | null {
    const active = this.activeTabId
    if (active == null) return null
    const split = this.getSplitByTabId(active)
    if (!split) return active
    return splitTabIdForPane(split, split.focusedPane)
  }

  private isTabForeground(tabId: number): boolean {
    if (tabId === this.activeTabId) return true
    const split = this.getActiveSplitSession()
    if (!split) return false
    return tabId === split.leftTabId || tabId === split.rightTabId
  }

  private getSplitByTabId(tabId: number): SplitSession | null {
    const rec = this.tabs.get(tabId)
    if (!rec?.splitId) return null
    return this.splits.get(rec.splitId) ?? null
  }

  private getActiveSplitSession(): SplitSession | null {
    if (this.activeTabId == null) return null
    return this.getSplitByTabId(this.activeTabId)
  }

  private isSplitPrimaryTab(tabId: number): boolean {
    const split = this.getSplitByTabId(tabId)
    return split != null && tabId === splitPrimaryTabId(split)
  }

  private snapshotPaneFor(tabId: number): SplitPaneSnapshot | null {
    const snap = this.snapshotFor(tabId)
    if (!snap) return null
    return {
      tabId: snap.id,
      url: snap.url,
      title: snap.title,
      favicon: snap.favicon,
      isLoading: snap.isLoading,
      canGoBack: snap.canGoBack,
      canGoForward: snap.canGoForward,
      muted: snap.muted
    }
  }

  private snapshotForSplit(split: SplitSession): TabSnapshot | null {
    const left = this.snapshotPaneFor(split.leftTabId)
    const right = this.snapshotPaneFor(split.rightTabId)
    if (!left || !right) return null
    const focused = splitTabIdForPane(split, split.focusedPane)
    const focusedSnap = split.focusedPane === 'left' ? left : right
    const leftTitle = left.title || 'New tab'
    const rightTitle = right.title || 'New tab'
    const combinedTitle = `${leftTitle} ↔ ${rightTitle}`
    const leftRec = this.tabs.get(split.leftTabId)
    return {
      id: split.leftTabId,
      url: focusedSnap.url,
      title: combinedTitle,
      favicon: focusedSnap.favicon,
      isLoading: left.isLoading || right.isLoading,
      canGoBack: focusedSnap.canGoBack,
      canGoForward: focusedSnap.canGoForward,
      isResting: false,
      pinned: leftRec?.pinned,
      muted: focusedSnap.muted,
      split: {
        left,
        right,
        ratio: split.ratio,
        focusedPane: split.focusedPane
      }
    }
  }

  private ensureSplitDividerView(): WebContentsView {
    if (this.splitDividerView) return this.splitDividerView
    const view = new WebContentsView({
      webPreferences: {
        preload: getSplitDividerPreloadPath(),
        session: this.session,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false
      }
    })
    view.setBackgroundColor('#00000000')
    this.splitDividerView = view
    this.window.contentView.addChildView(view)
    this.loadSplitDividerSurface()
    return view
  }

  private loadSplitDividerSurface(): void {
    const view = this.splitDividerView
    if (!view || view.webContents.isDestroyed()) return
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;height:100%;overflow:hidden;background:transparent}
#grip{width:100%;height:100%;cursor:col-resize;display:flex;align-items:stretch;justify-content:center;touch-action:none;user-select:none}
#grip::before{content:'';width:2px;height:100%;background:rgba(140,140,150,0.55);border-radius:1px;transition:background 0.15s ease}
#grip.focus-left::before{background:linear-gradient(90deg,rgba(99,102,241,0.95) 0%,rgba(140,140,150,0.4) 65%)}
#grip.focus-right::before{background:linear-gradient(270deg,rgba(99,102,241,0.95) 0%,rgba(140,140,150,0.4) 65%)}
</style></head><body><div id="grip"></div><script>
const g=document.getElementById('grip');
let drag=false;
g.addEventListener('mousedown',e=>{drag=true;e.preventDefault();window.veloSplitDivider.dragStart();});
window.addEventListener('mousemove',e=>{if(!drag)return;window.veloSplitDivider.dragMove(e.screenX);});
window.addEventListener('mouseup',()=>{if(!drag)return;drag=false;window.veloSplitDivider.dragEnd();});
</script></body></html>`
    void view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  }

  private hideSplitDividerView(): void {
    const view = this.splitDividerView
    if (!view) return
    view.setVisible(false)
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  }

  private updateSplitDividerFocusClass(): void {
    const view = this.splitDividerView
    const split = this.getActiveSplitSession()
    if (!view || view.webContents.isDestroyed() || !split) return
    const cls = split.focusedPane === 'left' ? 'focus-left' : 'focus-right'
    void view.webContents.executeJavaScript(
      `(function(){var g=document.getElementById('grip');if(!g)return;g.classList.remove('focus-left','focus-right');g.classList.add('${cls}');})()`
    )
  }

  private async applySplitPaneOutline(tabId: number, focused: boolean): Promise<void> {
    const rec = this.tabs.get(tabId)
    if (!rec) return
    const wc = rec.view.webContents
    if (wc.isDestroyed()) return
    const prev = this.splitFocusCssKeys.get(tabId)
    if (prev) {
      try {
        await wc.removeInsertedCSS(prev)
      } catch {}
      this.splitFocusCssKeys.delete(tabId)
    }
    if (!focused) return
    try {
      const key = await wc.insertCSS(`
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #6366f1;
          z-index: 2147483647;
          pointer-events: none;
        }
      `)
      this.splitFocusCssKeys.set(tabId, key)
    } catch {}
  }

  private refreshSplitFocusVisuals(split: SplitSession): void {
    void this.applySplitPaneOutline(split.leftTabId, split.focusedPane === 'left')
    void this.applySplitPaneOutline(split.rightTabId, split.focusedPane === 'right')
    this.updateSplitDividerFocusClass()
  }

  private clearSplitFocusVisualsForSession(split: SplitSession): void {
    void this.applySplitPaneOutline(split.leftTabId, false)
    void this.applySplitPaneOutline(split.rightTabId, false)
  }

  onSplitDividerDragStart(): void {
    const split = this.getActiveSplitSession()
    if (!split) return
    this.splitDragActive = true
  }

  onSplitDividerDragMove(screenX: number): void {
    const split = this.getActiveSplitSession()
    if (!split || !this.splitDragActive) return
    if (!Number.isFinite(screenX)) return
    const cb = this.window.getContentBounds()
    const localX = screenX - cb.x
    const ratio = localX / Math.max(1, cb.width)
    split.ratio = computeSplitWidths(cb.width, ratio).ratio
    this.layout()
    this.scheduleBroadcast()
  }

  onSplitDividerDragEnd(): void {
    if (!this.splitDragActive) return
    this.splitDragActive = false
    this.scheduleWorkspacePersist()
    this.broadcastNow()
  }

  getSplitDividerWebContents(): WebContents | null {
    const wc = this.splitDividerView?.webContents
    if (!wc || wc.isDestroyed()) return null
    return wc
  }

  createSplitView(leftTabId: number, rightTabId: number): boolean {
    if (this.shuttingDown || leftTabId === rightTabId) return false
    const leftRec = this.tabs.get(leftTabId)
    const rightRec = this.tabs.get(rightTabId)
    if (!leftRec || !rightRec) return false
    if (leftRec.workspaceId !== rightRec.workspaceId) return false
    if (leftRec.splitId || rightRec.splitId) return false
    const splitId = `split_${leftTabId}_${rightTabId}`
    const session: SplitSession = {
      id: splitId,
      leftTabId,
      rightTabId,
      ratio: SPLIT_DEFAULT_RATIO,
      focusedPane: 'left'
    }
    this.splits.set(splitId, session)
    leftRec.splitId = splitId
    rightRec.splitId = splitId
    this.setActiveTab(leftTabId)
    this.ensureSplitDividerView()
    this.refreshSplitFocusVisuals(session)
    this.applyBackgroundThrottlePolicy()
    this.broadcastNow()
    this.broadcastWorkspaces()
    return true
  }

  createSplitWithActive(otherTabId: number): boolean {
    const active = this.activeTabId
    if (active == null || active === otherTabId) return false
    return this.createSplitView(active, otherTabId)
  }

  exitSplitView(primaryTabId: number, mode: SplitExitMode): boolean {
    const split = this.getSplitByTabId(primaryTabId)
    if (!split) return false
    this.clearSplitFocusVisualsForSession(split)
    this.hideSplitDividerView()
    this.splitDragActive = false

    const leftRec = this.tabs.get(split.leftTabId)
    const rightRec = this.tabs.get(split.rightTabId)
    if (leftRec) leftRec.splitId = null
    if (rightRec) rightRec.splitId = null
    this.splits.delete(split.id)

    if (mode === 'both') {
      this.applyBackgroundThrottlePolicy()
      this.broadcastNow()
      return true
    }
    if (mode === 'left') {
      this.closeTabInternal(split.rightTabId, { skipSplit: true })
      return true
    }
    this.closeTabInternal(split.leftTabId, { skipSplit: true })
    if (this.tabs.has(split.rightTabId)) {
      this.setActiveTab(split.rightTabId)
    }
    this.applyBackgroundThrottlePolicy()
    this.broadcastNow()
    return true
  }

  setSplitRatio(primaryTabId: number, ratio: number): boolean {
    const split = this.getSplitByTabId(primaryTabId)
    if (!split) return false
    const cb = this.window.getContentBounds()
    split.ratio = computeSplitWidths(cb.width, ratio).ratio
    this.layout()
    this.broadcastNow()
    return true
  }

  setSplitFocusedPane(primaryTabId: number, pane: SplitPane): boolean {
    const split = this.getSplitByTabId(primaryTabId)
    if (!split) return false
    split.focusedPane = pane
    const tabId = splitTabIdForPane(split, pane)
    const rec = this.tabs.get(tabId)
    if (rec && !rec.view.webContents.isDestroyed()) {
      rec.view.webContents.focus()
    }
    this.refreshSplitFocusVisuals(split)
    this.broadcastNow()
    return true
  }

  swapSplitPanes(primaryTabId: number): boolean {
    const split = this.getSplitByTabId(primaryTabId)
    if (!split) return false

    const oldLeft = split.leftTabId
    const oldRight = split.rightTabId
    split.leftTabId = oldRight
    split.rightTabId = oldLeft
    split.focusedPane = split.focusedPane === 'left' ? 'right' : 'left'

    const cb = this.window.getContentBounds()
    split.ratio = computeSplitWidths(cb.width, 1 - split.ratio).ratio

    const ws = this.workspaces.get(this.tabs.get(oldLeft)?.workspaceId ?? '')
    if (ws) {
      const leftIdx = ws.tabOrder.indexOf(oldLeft)
      const rightIdx = ws.tabOrder.indexOf(oldRight)
      if (leftIdx >= 0 && rightIdx >= 0) {
        ws.tabOrder[leftIdx] = oldRight
        ws.tabOrder[rightIdx] = oldLeft
      }
      if (ws.activeTabId === oldLeft || ws.activeTabId === oldRight) {
        ws.activeTabId = split.leftTabId
      }
    }

    this.layout()
    this.refreshSplitFocusVisuals(split)
    const focusId = splitTabIdForPane(split, split.focusedPane)
    this.tabs.get(focusId)?.view.webContents.focus()
    this.broadcastNow()
    this.scheduleWorkspacePersist()
    return true
  }

  setSplitFocusedPaneByTabId(tabId: number): void {
    const split = this.getSplitByTabId(tabId)
    if (!split) return
    const pane = splitPaneForTabId(split, tabId)
    if (!pane || split.focusedPane === pane) return
    split.focusedPane = pane
    this.refreshSplitFocusVisuals(split)
    this.broadcastNow()
  }


  private scheduleWorkspacePersist(): void {
    if (this.workspacePersistTimer != null) return
    this.workspacePersistTimer = setTimeout(() => {
      this.workspacePersistTimer = null
      if (this.shuttingDown) return
      this.flushActiveWorkspaceSessionSync()
      writeWorkspacesRegistrySync(this.buildRegistry())
    }, 650)
  }

  private buildRegistry(): WorkspacesRegistryV1 {
    return {
      version: 1,
      workspaceOrder: [...this.workspaceOrder],
      activeWorkspaceId: this.hasActiveWorkspace() ? this.activeWorkspaceId : (this.workspaceOrder[0] ?? ''),
      workspaces: this.workspaceOrder
        .map((id) => this.workspaces.get(id))
        .filter((w): w is WorkspaceRuntime => w != null)
        .map(({ id, name, icon, createdAt }) => ({ id, name, icon, createdAt }))
    }
  }

  private exportWorkspaceSession(wsId: string): WorkspaceSessionV1 {
    const ws = this.workspaces.get(wsId)
    if (!ws?.materialized) {
      return readWorkspaceSession(wsId) ?? defaultWorkspaceSession()
    }
    const tabs: PersistedTabEntry[] = []
    for (const id of ws.tabOrder) {
      const rec = this.tabs.get(id)
      if (!rec || rec.workspaceId !== wsId) continue
      const split = rec.splitId ? this.splits.get(rec.splitId) : null
      if (split && id === split.rightTabId) continue
      const snap = this.snapshotFor(id)
      if (!snap) continue
      const url = snap.url.trim()
      if (!url) continue
      if (split) {
        const rightRec = this.tabs.get(split.rightTabId)
        const rightSnap = this.snapshotFor(split.rightTabId)
        if (!rightSnap) continue
        const rightUrl = rightSnap.url.trim()
        if (!rightUrl) continue
        tabs.push({
          url,
          pinned: rec.pinned,
          muted: snap.muted === true,
          split: {
            right: {
              url: rightUrl,
              pinned: rightRec?.pinned,
              muted: rightSnap.muted === true
            },
            ratio: split.ratio,
            focusedPane: split.focusedPane
          }
        })
        continue
      }
      tabs.push({
        url,
        pinned: rec.pinned,
        muted: snap.muted === true
      })
    }
    if (tabs.length === 0) return defaultWorkspaceSession()
    let activeIndex = 0
    if (ws.activeTabId != null) {
      let idx = ws.tabOrder.indexOf(ws.activeTabId)
      if (idx < 0) {
        const activeRec = this.tabs.get(ws.activeTabId)
        const split = activeRec?.splitId ? this.splits.get(activeRec.splitId) : null
        if (split) idx = ws.tabOrder.indexOf(split.leftTabId)
      }
      if (idx >= 0) {
        let exportIdx = 0
        for (const tid of ws.tabOrder) {
          const rec = this.tabs.get(tid)
          if (!rec || rec.workspaceId !== wsId) continue
          const split = rec.splitId ? this.splits.get(rec.splitId) : null
          if (split && tid === split.rightTabId) continue
          if (tid === ws.activeTabId || (split && split.leftTabId === ws.activeTabId)) {
            activeIndex = exportIdx
            break
          }
          exportIdx++
        }
      }
    }
    return {
      version: 1,
      tabs: tabs.slice(0, 80),
      activeIndex: Math.min(activeIndex, tabs.length - 1)
    }
  }

  flushActiveWorkspaceSessionSync(): void {
    if (!this.activeWorkspaceId) return
    writeWorkspaceSessionSync(this.activeWorkspaceId, this.exportWorkspaceSession(this.activeWorkspaceId))
  }

  flushAllWorkspacesSync(): void {
    if (this.workspaceOrder.length === 0) return
    for (const id of this.workspaceOrder) {
      writeWorkspaceSessionSync(id, this.exportWorkspaceSession(id))
    }
    writeWorkspacesRegistrySync(this.buildRegistry())
  }

  private broadcastWorkspaces(): void {
    if (!this.canNotifyShell()) return
    this.shellSend(IPC.workspacesUpdated, this.getWorkspacesState())
  }

  getWorkspacesState(): WorkspacesStatePayload {
    return {
      activeWorkspaceId: this.activeWorkspaceId,
      workspaces: this.workspaceOrder
        .map((id) => {
          const ws = this.workspaces.get(id)
          if (!ws) return null
          const tabCount = ws.materialized
            ? ws.tabOrder.length
            : (readWorkspaceSession(id)?.tabs.length ?? 0)
          return {
            id: ws.id,
            name: ws.name,
            icon: ws.icon,
            createdAt: ws.createdAt,
            tabCount,
            active: id === this.activeWorkspaceId
          }
        })
        .filter((w): w is WorkspaceSnapshot => w != null)
    }
  }

  getSnapshots(): TabSnapshot[] {
    const order = this.tabOrder
    const seenSplit = new Set<string>()
    const out: TabSnapshot[] = []
    for (const tabId of order) {
      const rec = this.tabs.get(tabId)
      if (!rec) continue
      const split = rec.splitId ? this.splits.get(rec.splitId) : null
      if (split) {
        if (tabId !== splitPrimaryTabId(split)) continue
        if (seenSplit.has(split.id)) continue
        seenSplit.add(split.id)
        const snap = this.snapshotForSplit(split)
        if (snap) out.push(snap)
        continue
      }
      const snap = this.snapshotFor(tabId)
      if (snap) out.push(snap)
    }
    return out
  }

  private tabUrlForPersist(tabId: number): string | null {
    const snap = this.snapshotFor(tabId)
    if (!snap) return null
    const u = snap.url.trim()
    return isPinnableUrl(u) ? u : null
  }

  private syncPinnedTabsStore(): void {
    this.scheduleWorkspacePersist()
  }

  private moveTabInOrder(tabId: number, toIndex: number, wsId?: string): void {
    const ws = this.workspaces.get(wsId ?? this.activeWorkspaceId)
    if (!ws) return
    const order = ws.tabOrder
    const from = order.indexOf(tabId)
    if (from < 0) return
    order.splice(from, 1)
    const idx = Math.max(0, Math.min(toIndex, order.length))
    order.splice(idx, 0, tabId)
  }

  private pinnedTabCount(wsId?: string, excludeId?: number): number {
    const id = wsId ?? this.activeWorkspaceId
    let n = 0
    for (const tabId of this.wsTabOrder(id)) {
      if (excludeId != null && tabId === excludeId) continue
      if (this.tabs.get(tabId)?.pinned) n += 1
    }
    return n
  }

  pinTab(tabId: number): boolean {
    if (this.shuttingDown) return false
    const rec = this.tabs.get(tabId)
    if (!rec || rec.pinned || rec.splitId) return false
    const url = this.tabUrlForPersist(tabId)
    if (!url) return false
    rec.pinned = true
    this.moveTabInOrder(tabId, this.pinnedTabCount(undefined, tabId), rec.workspaceId)
    this.syncPinnedTabsStore()
    this.broadcastNow()
    return true
  }

  unpinTab(tabId: number): boolean {
    if (this.shuttingDown) return false
    const rec = this.tabs.get(tabId)
    if (!rec || !rec.pinned) return false
    rec.pinned = false
    this.moveTabInOrder(tabId, this.pinnedTabCount(undefined, tabId), rec.workspaceId)
    this.syncPinnedTabsStore()
    this.broadcastNow()
    return true
  }

  setTabMuted(tabId: number, muted: boolean): boolean {
    if (this.shuttingDown) return false
    const rec = this.tabs.get(tabId)
    if (!rec) return false
    const { webContents } = rec.view
    if (webContents.isDestroyed()) return false
    webContents.setAudioMuted(muted)
    this.broadcastNow()
    return true
  }

  restorePinnedTabs(urls: string[]): void {
    if (this.shuttingDown || !this.activeWorkspaceId) return
    for (const raw of urls) {
      const url = raw.trim()
      if (!isPinnableUrl(url)) continue
      this.spawnTab(url, {
        pinned: true,
        activate: false,
        workspaceId: this.activeWorkspaceId
      })
    }
    if (this.activeTabId == null && this.tabOrder.length > 0) {
      this.setActiveTab(this.tabOrder[0]!)
    } else {
      this.broadcastNow()
    }
  }

  private snapshotFor(tabId: number): TabSnapshot | null {
    const t = this.tabs.get(tabId)
    if (!t) return null
    const { webContents } = t.view
    if (webContents.isDestroyed()) return null
    const rawUrl = webContents.getURL() || ''
    const last = getLastTabCommittedUrl(webContents)
    const url = rawUrl.startsWith('data:') && last ? last : rawUrl
    return {
      id: tabId,
      url,
      title: webContents.getTitle() || 'New tab',
      favicon: tabStripFavicon(webContents, t.favicon),
      isLoading: webContents.isLoading(),
      canGoBack: webContents.navigationHistory.canGoBack(),
      canGoForward: webContents.navigationHistory.canGoForward(),
      isResting: this.tabResting.get(tabId) === true,
      pinned: t.pinned,
      muted: webContents.isAudioMuted()
    }
  }

  getActiveTabId(): number | null {
    return this.activeTabId
  }

  getActiveWebContents() {
    const focusedId = this.getFocusedNavTabId()
    if (focusedId == null) return null
    return this.tabs.get(focusedId)?.view.webContents ?? null
  }

  
  raiseShellChrome(): void {
    this.keepChromeOnTop()
  }

  private keepChromeOnTop(): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    try {
      const kids = this.window.contentView.children
      if (kids.length > 0 && kids[kids.length - 1] === this.chromeView) {
        return
      }
      
      this.window.contentView.addChildView(this.chromeView)
    } catch {}
  }

  
  private raiseShellChromeForOverlay(): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    try {
      this.window.contentView.addChildView(this.chromeView)
    } catch {}
  }

  
  relayout(): void {
    this.layout()
    this.keepChromeOnTop()
  }

  private layout(): void {
    if (this.shuttingDown || this.window.isDestroyed()) return
    const cb = this.window.getContentBounds()
    const w = Math.max(0, Math.floor(cb.width))
    const h = Math.max(0, Math.floor(cb.height))
    const tabTop = this.tabContentTopPx()
    const contentH = Math.max(0, h - tabTop)
    const activeWsId = this.hasActiveWorkspace() ? this.activeWorkspaceId : null
    const activeSplit = this.getActiveSplitSession()

    if (activeSplit) {
      const { leftW, rightW } = computeSplitWidths(w, activeSplit.ratio)
      const divider = this.ensureSplitDividerView()
      const rightX = leftW + SPLIT_DIVIDER_PX

      for (const [id, rec] of this.tabs) {
        const { view } = rec
        if (activeWsId == null || rec.workspaceId !== activeWsId) {
          view.setVisible(false)
          view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
          continue
        }
        if (id === activeSplit.leftTabId) {
          view.setVisible(true)
          view.setBounds({ x: 0, y: tabTop, width: leftW, height: contentH })
        } else if (id === activeSplit.rightTabId) {
          view.setVisible(true)
          view.setBounds({ x: rightX, y: tabTop, width: rightW, height: contentH })
        } else {
          view.setVisible(false)
          view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
        }
      }

      divider.setVisible(true)
      divider.setBounds({ x: leftW, y: tabTop, width: SPLIT_DIVIDER_PX, height: contentH })
      this.keepChromeOnTop()
      return
    }

    this.hideSplitDividerView()

    for (const [id, rec] of this.tabs) {
      const { view } = rec
      if (activeWsId == null || rec.workspaceId !== activeWsId) {
        view.setVisible(false)
        view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
        continue
      }
      const active = id === this.activeTabId
      if (active) {
        view.setVisible(true)
        view.setBounds({
          x: 0,
          y: tabTop,
          width: w,
          height: contentH
        })
      } else {
        view.setVisible(false)
        view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      }
    }
  }

  private wireTab(tabId: number, view: WebContentsView): void {
    const { webContents } = view
    this.wcIdToTabId.set(webContents.id, tabId)

    webContents.setWindowOpenHandler(({ url }) => {
      if (!this.shuttingDown) this.createTab(url)
      return { action: 'deny' }
    })

    const push = (): void => {
      if (this.shuttingDown || webContents.isDestroyed()) return
      this.scheduleBroadcast()
    }

    webContents.on('did-start-loading', push)
    webContents.on('did-stop-loading', push)
    webContents.on('page-title-updated', push)
    webContents.on('page-favicon-updated', (_e, favicons) => {
      const rec = this.tabs.get(tabId)
      if (!rec) return
      if (favicons?.length) {
        const pageUrl = webContents.getURL() || getLastTabCommittedUrl(webContents) || ''
        rec.favicon = normalizeFaviconForShell(pageUrl, favicons[0])
      }
      push()
    })
    webContents.on('did-navigate', (_e, url) => {
      if (!url.startsWith('data:')) {
        recordTabCommittedUrl(webContents, url)
      }
      if (
        tabId === this.activeTabId &&
        getSettings().prefetchNetworkConnections &&
        /^https?:\/\//i.test(url)
      ) {
        try {
          const o = new URL(url)
          const origin = `${o.protocol}//${o.hostname}${o.port ? `:${o.port}` : ''}`
          this.session.preconnect({ url: origin, numSockets: 1 })
        } catch {}
      }
      const rec = this.tabs.get(tabId)
      if (rec) rec.favicon = null
      void recordVisit(url, webContents.getTitle())
      this.maybeClosePasswordBarOnTabNavigate(tabId)
      clearAdblockNotifyForTab(tabId)
      if (this.tabs.get(tabId)?.pinned) this.syncPinnedTabsStore()
      this.applyBackgroundThrottlePolicy()
      this.scheduleRestingCheck(tabId)
      push()
    })
    webContents.on('did-navigate-in-page', (_e, url) => {
      recordTabCommittedUrl(webContents, url)
      this.maybeClosePasswordBarOnTabNavigate(tabId)
      if (this.tabs.get(tabId)?.pinned) this.syncPinnedTabsStore()
      push()
    })
    webContents.on('dom-ready', () => {
      if (this.shuttingDown || webContents.isDestroyed()) return
      if (!this.isTabForeground(tabId)) return
      this.injectWebAuthnGuard(webContents)
    })
    webContents.on('did-finish-load', () => {
      if (webContents.isDestroyed()) return
      const u = webContents.getURL()
      if (!u.startsWith('data:')) {
        recordTabCommittedUrl(webContents, u)
      }
      if (!this.isTabForeground(tabId)) return
      this.harvestFaviconForTab(tabId, webContents, 0)
      this.harvestFaviconForTab(tabId, webContents, 450)
      this.injectPasswordInstrumentation(webContents)
    })

    const showLoadErrorPage = (
      errorCode: number,
      errorDescription: string,
      validatedURL: string,
      isMainFrame: boolean
    ): void => {
      if (!isMainFrame || this.shuttingDown || webContents.isDestroyed()) return
      if (isLoadFailureIgnored(errorCode)) return
      if (!validatedURL || isOurErrorPageUrl(validatedURL)) return
      recordTabCommittedUrl(webContents, validatedURL)
      const dataUrl = buildNetworkErrorDataUrl(validatedURL, errorCode, errorDescription)
      void webContents.loadURL(dataUrl)
    }

    webContents.on(
      'did-fail-provisional-load',
      (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
        showLoadErrorPage(errorCode, errorDescription, validatedURL, isMainFrame)
      }
    )
    webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      showLoadErrorPage(errorCode, errorDescription, validatedURL, isMainFrame)
    })
    webContents.on('devtools-opened', () => {
      if (this.shuttingDown || webContents.isDestroyed()) return
      this.layout()
      this.keepChromeOnTop()
    })
    webContents.on('devtools-closed', () => {
      if (this.shuttingDown || webContents.isDestroyed()) return
      this.layout()
      this.keepChromeOnTop()
    })

    webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
      if (input.key === 'F12') {
        event.preventDefault()
        this.openOrTogglePageDevTools()
        return
      }
      const mod = input.control || input.meta
      if (mod && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault()
        this.openOrTogglePageDevTools()
      }
    })

    webContents.on('focus', () => {
      if (this.shuttingDown || webContents.isDestroyed()) return
      this.setSplitFocusedPaneByTabId(tabId)
    })

    webContents.on('unresponsive', () => {
      if (this.shuttingDown || webContents.isDestroyed()) return
      if (!getSettings().notifyOnTabFreeze) return
      const now = Date.now()
      const last = this.lastUnresponsiveNotifyAt.get(tabId) ?? 0
      if (now - last < 28_000) return
      this.lastUnresponsiveNotifyAt.set(tabId, now)
      const title = (webContents.getTitle() || 'A tab').trim()
      try {
        const n = new Notification({
          title: 'Velo — page not responding',
          body: title.length > 160 ? title.slice(0, 157) + '…' : title
        })
        n.show()
      } catch {}
    })
  }

  
  openOrTogglePageDevTools(): void {
    if (this.shuttingDown) return
    const wc = this.getActiveWebContents()
    if (!wc || wc.isDestroyed()) return

    if (wc.isDevToolsOpened()) {
      wc.closeDevTools()
      this.layout()
      this.keepChromeOnTop()
      return
    }

    this.layout()
    this.keepChromeOnTop()
    wc.openDevTools(devtoolsOpenOptions)
  }

  createTab(url = 'velo://newtab'): number {
    this.ensureDefaultWorkspace()
    return this.spawnTab(url || 'velo://newtab', { pinned: false, activate: true })
  }

  createBackgroundTab(url: string, loadDelayMs = 0): number {
    return this.spawnTab(url || 'velo://newtab', {
      pinned: false,
      activate: false,
      loadDelayMs
    })
  }

  private spawnTab(
    target: string,
    opts: {
      pinned: boolean
      activate: boolean
      loadDelayMs?: number
      workspaceId?: string
      initialMuted?: boolean
    }
  ): number {
    if (this.shuttingDown) return this.activeTabId ?? 0
    if (!opts.workspaceId && !this.hasActiveWorkspace()) {
      this.ensureDefaultWorkspace()
    }
    const wsId = opts.workspaceId ?? this.activeWorkspaceId
    const ws = this.workspaces.get(wsId)
    if (!ws) return this.activeTabId ?? 0
    const id = this.nextId++
    const view = new WebContentsView({
      webPreferences: {
        preload: this.tabPreloadPath,
        session: this.session,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true
      }
    })
    view.setBackgroundColor(TAB_WEBCONTENTS_VIEW_BACKGROUND)
    const rec: TabRecord = {
      id,
      view,
      favicon: null,
      pinned: opts.pinned,
      workspaceId: wsId,
      splitId: null
    }
    this.tabs.set(id, rec)
    if (opts.pinned) {
      ws.tabOrder.splice(this.pinnedTabCount(wsId), 0, id)
    } else {
      ws.tabOrder.push(id)
    }
    ws.materialized = true
    this.window.contentView.addChildView(view)
    this.keepChromeOnTop()
    this.wireTab(id, view)

    if (opts.initialMuted) {
      try {
        view.webContents.setAudioMuted(true)
      } catch {}
    }

    const isActiveWs = wsId === this.activeWorkspaceId
    if (opts.activate && isActiveWs) {
      this.setActiveTab(id)
    } else {
      this.tabLastBackgroundAt.set(id, Date.now())
      if (getSettings().autoThrottleBackgroundTabs) {
        try {
          view.webContents.setBackgroundThrottling(true)
        } catch {}
      }
      this.scheduleRestingCheck(id)
      if (opts.activate) {
        ws.activeTabId = id
      }
    }
    recordTabCommittedUrl(view.webContents, target)
    const load = (): void => {
      if (this.shuttingDown || view.webContents.isDestroyed()) return
      void view.webContents.loadURL(target)
    }
    const delay = opts.loadDelayMs ?? 0
    if (delay > 0) {
      setTimeout(load, delay)
    } else {
      load()
    }
    if (opts.pinned) this.syncPinnedTabsStore()
    if (!opts.activate) this.scheduleBroadcast()
    return id
  }

  closeTab(tabId: number): void {
    const split = this.getSplitByTabId(tabId)
    if (split && this.isSplitPrimaryTab(tabId)) {
      this.clearSplitFocusVisualsForSession(split)
      this.splits.delete(split.id)
      const leftRec = this.tabs.get(split.leftTabId)
      const rightRec = this.tabs.get(split.rightTabId)
      if (leftRec) leftRec.splitId = null
      if (rightRec) rightRec.splitId = null
      this.hideSplitDividerView()
      this.closeTabInternal(split.leftTabId, { skipSplit: true })
      this.closeTabInternal(split.rightTabId, { skipSplit: true })
      return
    }
    this.closeTabInternal(tabId, { skipSplit: false })
  }

  private closeTabInternal(tabId: number, opts: { skipSplit: boolean }): void {
    if (this.shuttingDown) return
    const rec = this.tabs.get(tabId)
    if (!rec) return

    if (!opts.skipSplit && rec.splitId) {
      const split = this.splits.get(rec.splitId)
      if (split) {
        this.exitSplitView(splitPrimaryTabId(split), 'both')
      }
    }

    const ws = this.workspaces.get(rec.workspaceId)
    if (!ws) return
    const wasPinned = rec.pinned
    const closedIdx = ws.tabOrder.indexOf(tabId)
    this.clearRestingTimer(tabId)
    this.tabLastBackgroundAt.delete(tabId)
    this.tabResting.delete(tabId)
    this.lastUnresponsiveNotifyAt.delete(tabId)
    this.wcIdToTabId.delete(rec.view.webContents.id)
    clearAdblockNotifyForTab(tabId)
    void this.applySplitPaneOutline(tabId, false)
    this.splitFocusCssKeys.delete(tabId)
    try {
      rec.view.webContents.removeAllListeners()
    } catch {}
    this.window.contentView.removeChildView(rec.view)
    rec.view.webContents.close()
    this.tabs.delete(tabId)
    if (closedIdx >= 0) ws.tabOrder.splice(closedIdx, 1)
    if (ws.activeTabId === tabId) {
      const remaining = ws.tabOrder
      const next =
        remaining[closedIdx] ?? remaining[closedIdx - 1] ?? remaining[remaining.length - 1] ?? null
      if (next != null && rec.workspaceId === this.activeWorkspaceId) {
        this.setActiveTab(next)
      } else {
        ws.activeTabId = next
      }
    }
    if (wasPinned) this.syncPinnedTabsStore()
    if (rec.workspaceId === this.activeWorkspaceId) {
      if (ws.tabOrder.length === 0) {
        this.spawnTab('velo://newtab', { pinned: false, activate: true, workspaceId: rec.workspaceId })
      } else {
        this.layout()
        this.broadcastNow()
      }
      this.keepChromeOnTop()
    } else {
      this.scheduleWorkspacePersist()
    }
  }

  setActiveTab(tabId: number): void {
    if (this.shuttingDown) return
    const rec = this.tabs.get(tabId)
    if (!rec || rec.workspaceId !== this.activeWorkspaceId) return

    const split = rec.splitId ? this.splits.get(rec.splitId) : null
    const primaryId = split ? splitPrimaryTabId(split) : tabId
    if (split && tabId !== primaryId) {
      this.setActiveTab(primaryId)
      return
    }

    if (this.activeTabId === tabId) {
      this.layout()
      this.keepChromeOnTop()
      if (split) {
        this.ensureSplitDividerView()
        this.refreshSplitFocusVisuals(split)
        const focusId = splitTabIdForPane(split, split.focusedPane)
        this.tabs.get(focusId)?.view.webContents.focus()
      }
      return
    }
    const prevId = this.activeTabId
    if (prevId !== null && prevId !== tabId) {
      this.tabLastBackgroundAt.set(prevId, Date.now())
      this.scheduleRestingCheck(prevId)
    }
    const prev = prevId != null ? this.tabs.get(prevId)?.view.webContents : null
    if (prev && !prev.isDestroyed() && prev.isDevToolsOpened()) {
      try {
        prev.closeDevTools()
      } catch {}
    }
    this.activeTabId = tabId
    const splitActive = split ?? (rec.splitId ? this.splits.get(rec.splitId) : null)
    if (splitActive) {
      const leftView = this.tabs.get(splitActive.leftTabId)?.view
      const rightView = this.tabs.get(splitActive.rightTabId)?.view
      if (leftView) this.window.contentView.addChildView(leftView)
      if (rightView) this.window.contentView.addChildView(rightView)
      this.ensureSplitDividerView()
      this.refreshSplitFocusVisuals(splitActive)
    } else {
      const { view } = this.tabs.get(tabId)!
      this.window.contentView.addChildView(view)
    }
    this.clearRestingTimer(tabId)
    this.keepChromeOnTop()
    this.layout()
    this.applyBackgroundThrottlePolicy()
    this.flushDeferredTabWork(this.getFocusedNavTabId() ?? tabId)
    if (splitActive) {
      const focusId = splitTabIdForPane(splitActive, splitActive.focusedPane)
      this.tabs.get(focusId)?.view.webContents.focus()
    }
    this.broadcastNow()
  }

  navigateTab(tabId: number, input: string): void {
    const rec = this.tabs.get(tabId)
    if (!rec) return
    const engine = getSettings().searchEngine
    const url = resolveNavigation(input, engine)
    recordTabCommittedUrl(rec.view.webContents, url)
    void rec.view.webContents.loadURL(url)
  }

  goBack(tabId: number): void {
    const wc = this.tabs.get(tabId)?.view.webContents
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  }

  goForward(tabId: number): void {
    const wc = this.tabs.get(tabId)?.view.webContents
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  }

  reload(tabId: number): void {
    const wc = this.tabs.get(tabId)?.view.webContents
    if (!wc || wc.isDestroyed()) return
    const u = wc.getURL() || ''
    if (u.startsWith('data:')) {
      const last = getLastTabCommittedUrl(wc)
      if (last && !last.startsWith('data:')) {
        recordTabCommittedUrl(wc, last)
        void wc.loadURL(last)
        return
      }
    }
    wc.reload()
  }

  stop(tabId: number): void {
    this.tabs.get(tabId)?.view.webContents.stop()
  }

  
  setTabViewSurfaceColors(_theme: BrowserChromeTheme): void {
    if (this.shuttingDown) return
    const color = TAB_WEBCONTENTS_VIEW_BACKGROUND
    for (const { view } of this.tabs.values()) {
      try {
        view.setBackgroundColor(color)
      } catch {}
    }
  }

  
  reloadVeloProtocolTabs(): void {
    if (this.shuttingDown) return
    for (const { view } of this.tabs.values()) {
      const wc = view.webContents
      if (wc.isDestroyed()) continue
      const u = (wc.getURL() || getLastTabCommittedUrl(wc) || '').trim()
      if (u.startsWith('velo://')) {
        recordTabCommittedUrl(wc, u)
        void wc.loadURL(u)
      }
    }
  }

  reloadWebTabs(): void {
    if (this.shuttingDown) return
    for (const { view } of this.tabs.values()) {
      const wc = view.webContents
      if (wc.isDestroyed()) continue
      const u = (wc.getURL() || getLastTabCommittedUrl(wc) || '').trim()
      if (u.startsWith('http://') || u.startsWith('https://')) {
        void wc.reload()
      }
    }
  }

  
  applyPerformanceSettings(): void {
    if (this.shuttingDown || !this.hasActiveWorkspace()) return
    this.applyBackgroundThrottlePolicy()
    this.rescheduleAllRestingChecks()
  }

  private restingThresholdMs(s: VeloSettings): number {
    let ms = s.backgroundTabRestMinutes * 60_000
    if (s.lowPowerBackgroundMode) ms *= 0.58
    if (s.gameQuietBackground) ms *= 0.58
    return Math.max(30_000, Math.round(ms))
  }

  private applyBackgroundThrottlePolicy(): void {
    if (this.shuttingDown) return
    const s = getSettings()
    const active = this.activeTabId
    let restingChanged = false
    const windowOccluded =
      !this.window.isVisible() || this.window.isMinimized()

    if (!s.autoThrottleBackgroundTabs) {
      for (const [id, rec] of this.tabs) {
        const wc = rec.view.webContents
        if (wc.isDestroyed()) continue
        try {
          wc.setBackgroundThrottling(false)
        } catch {}
        if (this.tabResting.delete(id)) restingChanged = true
      }
      if (restingChanged) this.scheduleBroadcast()
      return
    }

    const pins = s.alwaysActiveHostnames
    const threshold = this.restingThresholdMs(s)

    for (const [id, rec] of this.tabs) {
      const wc = rec.view.webContents
      if (wc.isDestroyed()) continue

      const activeSplit = this.getActiveSplitSession()
      if (
        activeSplit &&
        (id === activeSplit.leftTabId || id === activeSplit.rightTabId)
      ) {
        try {
          wc.setBackgroundThrottling(false)
        } catch {}
        if (this.tabResting.delete(id)) restingChanged = true
        continue
      }

      if (rec.workspaceId !== this.activeWorkspaceId) {
        try {
          wc.setBackgroundThrottling(true)
        } catch {}
        const was = this.tabResting.get(id) === true
        this.tabResting.set(id, true)
        if (!was) restingChanged = true
        continue
      }

      if (id === active) {
        try {
          wc.setBackgroundThrottling(false)
        } catch {}
        if (this.tabResting.delete(id)) restingChanged = true
        continue
      }

      let audible = false
      try {
        audible = wc.isCurrentlyAudible()
      } catch {}

      if (audible) {
        try {
          wc.setBackgroundThrottling(false)
        } catch {}
        if (this.tabResting.delete(id)) restingChanged = true
        continue
      }

      const url = wc.getURL() || getLastTabCommittedUrl(wc) || ''
      if (!urlEligibleForBackgroundRest(url, pins, rec.pinned)) {
        try {
          wc.setBackgroundThrottling(false)
        } catch {}
        if (this.tabResting.delete(id)) restingChanged = true
        continue
      }

      try {
        wc.setBackgroundThrottling(true)
      } catch {}

      const started = this.tabLastBackgroundAt.get(id) ?? Date.now()
      const pastThreshold = windowOccluded || Date.now() - started >= threshold
      const was = this.tabResting.get(id) === true
      if (pastThreshold) {
        this.tabResting.set(id, true)
        if (!was) restingChanged = true
      } else if (this.tabResting.delete(id)) {
        restingChanged = true
      }
    }

    if (restingChanged) this.scheduleBroadcast()
  }

  
  isTabWebContents(wc: WebContents): boolean {
    if (wc.isDestroyed()) return false
    for (const rec of this.tabs.values()) {
      if (rec.view.webContents.id === wc.id) return true
    }
    return false
  }

  initWorkspaces(restoreActiveSession: boolean): void {
    try {
      const registry = loadOrMigrateWorkspacesRegistry()
      this.workspaceOrder = [...registry.workspaceOrder]
      this.activeWorkspaceId = registry.activeWorkspaceId
      for (const def of registry.workspaces) {
        this.workspaces.set(def.id, {
          ...def,
          tabOrder: [],
          activeTabId: null,
          materialized: false
        })
      }
      if (
        registry.workspaces.length === 0 ||
        !this.activeWorkspaceId ||
        !this.workspaces.has(this.activeWorkspaceId)
      ) {
        this.ensureDefaultWorkspace()
      }
    } catch (e) {
      console.warn('[velo workspaces] init failed', e)
      this.ensureDefaultWorkspace()
    }

    if (!this.hasActiveWorkspace()) {
      this.ensureDefaultWorkspace()
    }

    const activeId = this.activeWorkspaceId
    if (restoreActiveSession) {
      this.materializeWorkspace(activeId, { stagger: true })
    } else {
      const ws = this.workspaces.get(activeId)
      if (ws) {
        ws.materialized = true
        this.spawnTab('velo://newtab', {
          pinned: false,
          activate: true,
          workspaceId: activeId
        })
      }
    }
    this.broadcastWorkspaces()
    this.broadcastNow()
  }

  private materializeWorkspace(
    wsId: string,
    opts?: { stagger?: boolean }
  ): void {
    const ws = this.workspaces.get(wsId)
    if (!ws || ws.materialized) return
    const session = readWorkspaceSession(wsId) ?? defaultWorkspaceSession()
    let i = 0
    const stripPrimaryIds: number[] = []
    for (const entry of session.tabs) {
      const delay = opts?.stagger ? i * 80 : 0
      if (entry.split) {
        const leftId = this.spawnTab(entry.url, {
          pinned: entry.pinned ?? false,
          activate: false,
          loadDelayMs: delay,
          workspaceId: wsId,
          initialMuted: entry.muted ?? false
        })
        const rightId = this.spawnTab(entry.split.right.url, {
          pinned: entry.split.right.pinned ?? false,
          activate: false,
          loadDelayMs: delay + 20,
          workspaceId: wsId,
          initialMuted: entry.split.right.muted ?? false
        })
        const splitId = `split_${leftId}_${rightId}`
        const splitSession: SplitSession = {
          id: splitId,
          leftTabId: leftId,
          rightTabId: rightId,
          ratio: entry.split.ratio,
          focusedPane: entry.split.focusedPane
        }
        this.splits.set(splitId, splitSession)
        const leftRec = this.tabs.get(leftId)
        const rightRec = this.tabs.get(rightId)
        if (leftRec) leftRec.splitId = splitId
        if (rightRec) rightRec.splitId = splitId
        stripPrimaryIds.push(leftId)
        i++
        continue
      }
      const tabId = this.spawnTab(entry.url, {
        pinned: entry.pinned ?? false,
        activate: false,
        loadDelayMs: delay,
        workspaceId: wsId,
        initialMuted: entry.muted ?? false
      })
      stripPrimaryIds.push(tabId)
      i++
    }
    ws.materialized = true
    if (ws.tabOrder.length === 0) {
      this.spawnTab('velo://newtab', {
        pinned: false,
        activate: wsId === this.activeWorkspaceId,
        workspaceId: wsId
      })
      return
    }
    const sessionIdx = Math.min(Math.max(0, session.activeIndex), stripPrimaryIds.length - 1)
    const activeId = stripPrimaryIds[sessionIdx] ?? stripPrimaryIds[0] ?? null
    if (wsId === this.activeWorkspaceId && activeId != null) {
      const split = this.getSplitByTabId(activeId)
      this.setActiveTab(activeId)
      if (split) {
        const entry = session.tabs[sessionIdx]
        if (entry?.split?.focusedPane) {
          split.focusedPane = entry.split.focusedPane
        }
        this.refreshSplitFocusVisuals(split)
      }
    } else {
      ws.activeTabId = activeId
    }
  }

  switchWorkspace(wsId: string): boolean {
    if (this.shuttingDown || wsId === this.activeWorkspaceId) return wsId === this.activeWorkspaceId
    if (!this.workspaces.has(wsId)) return false
    this.flushActiveWorkspaceSessionSync()
    this.activeWorkspaceId = wsId
    writeWorkspacesRegistrySync(this.buildRegistry())
    const ws = this.workspaces.get(wsId)!
    if (!ws.materialized) {
      this.materializeWorkspace(wsId)
    }
    if (ws.activeTabId != null && this.tabs.has(ws.activeTabId)) {
      const split = this.getSplitByTabId(ws.activeTabId)
      this.setActiveTab(split ? splitPrimaryTabId(split) : ws.activeTabId)
    } else if (ws.tabOrder.length > 0) {
      const first = ws.tabOrder[0]!
      const split = this.getSplitByTabId(first)
      this.setActiveTab(split ? splitPrimaryTabId(split) : first)
    } else {
      this.spawnTab('velo://newtab', { pinned: false, activate: true, workspaceId: wsId })
    }
    this.applyBackgroundThrottlePolicy()
    this.rescheduleAllRestingChecks()
    this.broadcastWorkspaces()
    this.broadcastNow()
    return true
  }

  createWorkspace(name: string, icon: string | null): string {
    const id = generateWorkspaceId()
    const def: WorkspaceDefinition = {
      id,
      name: name.trim() || 'Workspace',
      icon: icon?.trim() || null,
      createdAt: Date.now()
    }
    this.workspaces.set(id, {
      ...def,
      tabOrder: [],
      activeTabId: null,
      materialized: true
    })
    this.workspaceOrder.push(id)
    this.flushActiveWorkspaceSessionSync()
    this.activeWorkspaceId = id
    writeWorkspacesRegistrySync(this.buildRegistry())
    this.spawnTab('velo://newtab', { pinned: false, activate: true, workspaceId: id })
    this.applyBackgroundThrottlePolicy()
    this.broadcastWorkspaces()
    this.broadcastNow()
    return id
  }

  renameWorkspace(wsId: string, name: string): boolean {
    const ws = this.workspaces.get(wsId)
    if (!ws) return false
    ws.name = name.trim() || ws.name
    writeWorkspacesRegistrySync(this.buildRegistry())
    this.broadcastWorkspaces()
    return true
  }

  reorderWorkspaces(orderedIds: string[]): boolean {
    const valid = orderedIds.filter((id) => this.workspaces.has(id))
    if (valid.length !== this.workspaceOrder.length) return false
    this.workspaceOrder = valid
    writeWorkspacesRegistrySync(this.buildRegistry())
    this.broadcastWorkspaces()
    return true
  }

  private destroyWorkspaceTabs(wsId: string): void {
    const ws = this.workspaces.get(wsId)
    if (!ws) return
    for (const tabId of [...ws.tabOrder]) {
      const rec = this.tabs.get(tabId)
      if (!rec) continue
      if (rec.splitId) this.splits.delete(rec.splitId)
      this.clearRestingTimer(tabId)
      this.tabLastBackgroundAt.delete(tabId)
      this.tabResting.delete(tabId)
      this.lastUnresponsiveNotifyAt.delete(tabId)
      this.wcIdToTabId.delete(rec.view.webContents.id)
      clearAdblockNotifyForTab(tabId)
      try {
        rec.view.webContents.removeAllListeners()
      } catch {}
      try {
        this.window.contentView.removeChildView(rec.view)
        rec.view.webContents.close()
      } catch {}
      this.tabs.delete(tabId)
    }
    ws.tabOrder = []
    ws.activeTabId = null
    ws.materialized = false
  }

  deleteWorkspace(wsId: string): boolean {
    if (this.shuttingDown || this.workspaceOrder.length <= 1) return false
    if (!this.workspaces.has(wsId)) return false
    const wasActive = wsId === this.activeWorkspaceId
    this.flushActiveWorkspaceSessionSync()
    this.destroyWorkspaceTabs(wsId)
    this.workspaces.delete(wsId)
    this.workspaceOrder = this.workspaceOrder.filter((id) => id !== wsId)
    writeWorkspacesRegistrySync(this.buildRegistry())
    if (wasActive) {
      const nextId = this.workspaceOrder[0]!
      return this.switchWorkspace(nextId)
    }
    this.broadcastWorkspaces()
    return true
  }

  getTabIdForWebContents(wc: WebContents): number | null {
    if (wc.isDestroyed()) return null
    return this.wcIdToTabId.get(wc.id) ?? null
  }
}

export let manager: TabManager | null = null

export function setTabManager(m: TabManager | null): void {
  manager = m
}


export function runOpenNewTabShortcutModalInActiveTab(): Promise<boolean> {
  const wc = manager?.getActiveWebContents()
  if (!wc || wc.isDestroyed()) return Promise.resolve(false)
  const js = `(() => {
    try {
      if (typeof window.__veloOpenModal === 'function') {
        window.__veloOpenModal()
        return true
      }
    } catch (e) {}
    return false
  })()`
  return wc
    .executeJavaScript(js, true)
    .then((ok: boolean) => Boolean(ok))
    .catch(() => false)
}
