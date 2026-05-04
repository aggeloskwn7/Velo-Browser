import { BaseWindow, Notification, WebContentsView, type Session, type WebContents } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHROME_HEIGHT, TAB_WEBCONTENTS_VIEW_BACKGROUND } from '../shared/constants.js'
import { IPC, type BrowserChromeTheme, type TabSnapshot, type VeloSettings } from '../shared/ipc.js'
import { resolveNavigation } from './navigation.js'
import { getSettings } from './settings-store.js'
import { recordVisit } from './history-store.js'
import { getLastTabCommittedUrl, recordTabCommittedUrl } from './velo-page-origin.js'
import { tabStripFavicon } from './tab-icons.js'
import { harvestFaviconCandidates, normalizeFaviconForShell, shellCanDisplayFavicon } from './favicon-harvest.js'
import { devtoolsOpenOptions } from './devtools.js'
import { buildNetworkErrorDataUrl, isLoadFailureIgnored, isOurErrorPageUrl } from './load-error-page.js'
import { cancelBrowsingSessionPersist, scheduleBrowsingSessionPersist } from './last-session-store.js'
import { buildPasswordInjectScript } from './password-inject-script.js'
import { buildWebAuthnGuardScript } from './webauthn-guard-script.js'
import { clearAdblockNotifyForTab, clearAllAdblockNotify } from './adblock-notify.js'
import type { PasswordBarState } from '../shared/ipc.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function getTabPreloadPath(): string {
  return join(__dirname, '../preload/tab.mjs')
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

function urlEligibleForBackgroundRest(url: string, pins: string[]): boolean {
  const host = tabHostnameFromUrl(url)
  if (!host) return false
  if (hostnameIsPinned(host, pins)) return false
  return true
}

type TabRecord = {
  id: number
  view: WebContentsView
  favicon: string | null
}

export class TabManager {
  private readonly tabs = new Map<number, TabRecord>()
  private activeTabId: number | null = null
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
  private performanceTickTimer: ReturnType<typeof setInterval> | null = null
  
  private tabLastBackgroundAt = new Map<number, number>()
  private tabResting = new Map<number, boolean>()
  private lastUnresponsiveNotifyAt = new Map<number, number>()

  constructor(
    private readonly window: BaseWindow,
    private readonly session: Session,
    private readonly tabPreloadPath: string,
    
    private readonly chromeView: WebContentsView
  ) {}

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
    if (this.performanceTickTimer != null) {
      clearInterval(this.performanceTickTimer)
      this.performanceTickTimer = null
    }
    this.tabLastBackgroundAt.clear()
    this.tabResting.clear()
    this.lastUnresponsiveNotifyAt.clear()

    this.shuttingDown = true

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
    this.activeTabId = null
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
    this.shellSend(IPC.tabsUpdated, { tabs: list, activeId: this.activeTabId })
    scheduleBrowsingSessionPersist(this)
  }

  getSnapshots(): TabSnapshot[] {
    const ids = [...this.tabs.keys()].sort((a, b) => a - b)
    return ids.map((id) => this.snapshotFor(id)).filter((x): x is TabSnapshot => x != null)
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
      isResting: this.tabResting.get(tabId) === true
    }
  }

  getActiveTabId(): number | null {
    return this.activeTabId
  }

  getActiveWebContents() {
    if (this.activeTabId == null) return null
    return this.tabs.get(this.activeTabId)?.view.webContents ?? null
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

    
    for (const [id, { view }] of this.tabs) {
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

    webContents.setWindowOpenHandler(({ url }) => {
      if (!this.shuttingDown) this.createTab(url)
      return { action: 'deny' }
    })

    const push = (): void => {
      if (this.shuttingDown || webContents.isDestroyed()) return
      this.scheduleBroadcast()
    }

    const tryHarvestFavicon = (delayMs: number): void => {
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
          push()
        }
      }
      void run()
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
      if (getSettings().prefetchNetworkConnections && /^https?:\/\//i.test(url)) {
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
      this.applyBackgroundThrottlePolicy()
      push()
    })
    webContents.on('did-navigate-in-page', (_e, url) => {
      recordTabCommittedUrl(webContents, url)
      this.maybeClosePasswordBarOnTabNavigate(tabId)
      push()
    })
    webContents.on('dom-ready', () => {
      if (this.shuttingDown || webContents.isDestroyed()) return
      this.injectWebAuthnGuard(webContents)
    })
    webContents.on('did-finish-load', () => {
      if (webContents.isDestroyed()) return
      const u = webContents.getURL()
      if (!u.startsWith('data:')) {
        recordTabCommittedUrl(webContents, u)
      }
      tryHarvestFavicon(0)
      tryHarvestFavicon(450)
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
    if (this.shuttingDown) return this.activeTabId ?? 0
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
    this.tabs.set(id, { id, view, favicon: null })
    this.window.contentView.addChildView(view)
    this.keepChromeOnTop()
    this.wireTab(id, view)

    this.setActiveTab(id)
    const target = url || 'velo://newtab'
    recordTabCommittedUrl(view.webContents, target)
    void view.webContents.loadURL(target)
    return id
  }

  closeTab(tabId: number): void {
    if (this.shuttingDown) return
    const rec = this.tabs.get(tabId)
    if (!rec) return
    this.tabLastBackgroundAt.delete(tabId)
    this.tabResting.delete(tabId)
    this.lastUnresponsiveNotifyAt.delete(tabId)
    clearAdblockNotifyForTab(tabId)
    try {
      rec.view.webContents.removeAllListeners()
    } catch {}
    this.window.contentView.removeChildView(rec.view)
    rec.view.webContents.close()
    this.tabs.delete(tabId)
    if (this.activeTabId === tabId) {
      const remaining = [...this.tabs.keys()].sort((a, b) => a - b)
      this.activeTabId = remaining.length ? remaining[remaining.length - 1]! : null
    }
    this.layout()
    this.broadcastNow()
    this.keepChromeOnTop()
    if (this.tabs.size === 0 && !this.window.isDestroyed()) {
      this.window.close()
    }
  }

  setActiveTab(tabId: number): void {
    if (this.shuttingDown) return
    if (!this.tabs.has(tabId)) return
    if (this.activeTabId === tabId) {
      this.layout()
      this.keepChromeOnTop()
      return
    }
    const prevId = this.activeTabId
    if (prevId !== null && prevId !== tabId) {
      this.tabLastBackgroundAt.set(prevId, Date.now())
    }
    const prev = prevId != null ? this.tabs.get(prevId)?.view.webContents : null
    if (prev && !prev.isDestroyed() && prev.isDevToolsOpened()) {
      try {
        prev.closeDevTools()
      } catch {}
    }
    this.activeTabId = tabId
    const { view } = this.tabs.get(tabId)!
    this.window.contentView.addChildView(view)
    this.keepChromeOnTop()
    this.layout()
    this.applyBackgroundThrottlePolicy()
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

  
  applyPerformanceSettings(): void {
    if (this.shuttingDown) return
    if (this.performanceTickTimer != null) {
      clearInterval(this.performanceTickTimer)
      this.performanceTickTimer = null
    }
    const tick = (): void => {
      if (this.shuttingDown) return
      this.applyBackgroundThrottlePolicy()
    }
    this.performanceTickTimer = setInterval(tick, 45_000)
    tick()
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

      if (id === active) {
        try {
          wc.setBackgroundThrottling(false)
        } catch {}
        if (this.tabResting.delete(id)) restingChanged = true
        continue
      }

      const url = wc.getURL() || getLastTabCommittedUrl(wc) || ''
      if (!urlEligibleForBackgroundRest(url, pins)) {
        try {
          wc.setBackgroundThrottling(false)
        } catch {}
        if (this.tabResting.delete(id)) restingChanged = true
        continue
      }

      const started = this.tabLastBackgroundAt.get(id)
      if (started == null || Date.now() - started < threshold) {
        try {
          wc.setBackgroundThrottling(false)
        } catch {}
        if (this.tabResting.delete(id)) restingChanged = true
        continue
      }

      try {
        wc.setBackgroundThrottling(true)
      } catch {}
      const was = this.tabResting.get(id) === true
      this.tabResting.set(id, true)
      if (!was) restingChanged = true
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

  getTabIdForWebContents(wc: WebContents): number | null {
    if (wc.isDestroyed()) return null
    for (const [id, rec] of this.tabs) {
      if (rec.view.webContents.id === wc.id) return id
    }
    return null
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
