import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type MouseEvent
} from 'react'
import { createPortal } from 'react-dom'
import type {
  AdblockToastPayload,
  AutoUpdateStatusPayload,
  BookmarkFolder,
  DefaultBrowserStatusPayload,
  DownloadEntry,
  HistoryEntry,
  PasswordBarState,
  TabSnapshot,
  VeloSettings
} from '@shared/ipc'
import { DEFAULT_BOOKMARK_FOLDER_ID } from '@shared/ipc'
import {
  CHROME_HEIGHT,
  BOOKMARK_SAVE_MODAL_SHELL_RESERVE,
  DEFAULT_BROWSER_PROMPT_SHELL_RESERVE,
  DOWNLOAD_POPOVER_SHELL_RESERVE,
  OMNIBAR_SUGGEST_SHELL_RESERVE_FALLBACK,
  PASSWORD_BAR_SHELL_RESERVE,
  SITE_INFO_POPOVER_SHELL_RESERVE
} from '@shared/constants'
import { ChromeOverflowMenu } from './ChromeOverflowMenu'
import {
  buildHistorySuggestions,
  mergeSearchSuggestions,
  searchEngineLabel,
  type OmnibarSuggestionRow
} from './omnibar-suggest'
import {
  IconBack,
  IconForward,
  IconReload,
  IconStop,
  IconPlus,
  IconDownload,
  IconStarFilled,
  IconStarOutline,
  IconShortcuts,
  IconSearch,
  IconGlobe,
  IconHistory,
  IconShieldPrivacy,
  IconLock,
  IconInfo,
  IconTabClose,
  IconWinClose,
  IconWinMaximize,
  IconWinMinimize
} from './ChromeIcons'
import './App.css'

function isMac(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')
}


function omnibarDisplayFromUrl(url: string): string {
  const t = url.trim()
  if (!t) return ''
  if (/^velo:\/\/newtab\/?(\?[^#]*)?(#.*)?$/i.test(t)) return ''
  try {
    const u = new URL(t)
    if (u.protocol !== 'velo:') return url
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'
    const host = (u.hostname || '').toLowerCase()
    if (host === 'newtab' && (path === '/' || path === '')) return ''
    if (path === '/newtab') return ''
  } catch {}
  return url
}

function isNewTabPageUrl(url: string): boolean {
  const t = url.trim()
  if (!t) return false
  if (/^velo:\/\/newtab\/?(\?[^#]*)?(#.*)?$/i.test(t)) return true
  try {
    const u = new URL(t)
    if (u.protocol !== 'velo:') return false
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'
    const host = (u.hostname || '').toLowerCase()
    return host === 'newtab' && (path === '/' || path === '')
  } catch {
    return false
  }
}


function omnibarStripHttpSchemes(display: string): string {
  if (!display) return ''
  return display.replace(/^https?:\/\//i, '')
}

function omnibarPrettyFromTabUrl(url: string): string {
  return omnibarStripHttpSchemes(omnibarDisplayFromUrl(url))
}

type OmnibarPageSecurity = 'search' | 'https' | 'http'

function omnibarPageSecurity(url: string | undefined): OmnibarPageSecurity {
  const t = (url ?? '').trim()
  if (!t) return 'search'
  if (isNewTabPageUrl(t)) return 'search'
  try {
    const u = new URL(t)
    if (u.protocol === 'https:') return 'https'
    if (u.protocol === 'http:') return 'http'
  } catch {
    return 'search'
  }
  return 'search'
}

function siteLabelFromTabUrl(url: string | undefined): string {
  const t = (url ?? '').trim()
  if (!t) return ''
  try {
    return new URL(t).hostname || t
  } catch {
    return t
  }
}

function formatSizeBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0 B'
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function formatSpeedBps(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return ''
  if (bps < 1024) return `${Math.round(bps)} B/s`
  if (bps < 1048576) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1048576).toFixed(1)} MB/s`
}

function downloadRowBarModel(d: DownloadEntry): {
  pct: number
  indeterminate: boolean
  variant: 'done' | 'active' | 'bad'
} {
  if (d.state === 'completed') return { pct: 100, indeterminate: false, variant: 'done' }
  if (d.state === 'cancelled' || d.state === 'interrupted') {
    return { pct: 0, indeterminate: false, variant: 'bad' }
  }
  if (d.totalBytes > 0) {
    const pct = Math.min(100, Math.round((100 * d.receivedBytes) / d.totalBytes))
    return { pct, indeterminate: false, variant: 'active' }
  }
  return { pct: 0, indeterminate: true, variant: 'active' }
}

function downloadToastRowStruck(d: DownloadEntry): boolean {
  return Boolean(d.fileRemovedFromDisk) || d.state === 'cancelled' || d.state === 'interrupted'
}

function downloadToastShowActionButton(d: DownloadEntry): boolean {
  if (d.fileRemovedFromDisk) return false
  return d.state === 'progressing' || d.state === 'completed'
}

function applyShellPresentation(s: VeloSettings): void {
  document.documentElement.dataset.chromeTheme = s.browserChromeTheme
  document.documentElement.dataset.dimRestingTabs = s.dimRestingTabs ? 'true' : 'false'
}

type BookmarkSaveModalState = {
  url: string
  title: string
  favicon: string | null
  folderId: string
  folders: BookmarkFolder[]
}

export default function App(): JSX.Element {
  const [tabs, setTabs] = useState<TabSnapshot[]>([])
  
  const [tabFaviconLoadFailed, setTabFaviconLoadFailed] = useState<Record<number, string>>({})
  const [activeId, setActiveId] = useState<number | null>(null)
  const [omnibar, setOmnibar] = useState('')
  const [omnibarFocused, setOmnibarFocused] = useState(false)
  const [siteInfoOpen, setSiteInfoOpen] = useState(false)
  const [siteInfoPopoverPos, setSiteInfoPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [bookmarkSaveModal, setBookmarkSaveModal] = useState<BookmarkSaveModalState | null>(null)
  const [bookmarkNewFolderName, setBookmarkNewFolderName] = useState('')
  const [passwordBar, setPasswordBar] = useState<PasswordBarState>({ open: false })
  const [passwordBarUser, setPasswordBarUser] = useState('')
  const [passwordBarPass, setPasswordBarPass] = useState('')
  const [passwordBarReveal, setPasswordBarReveal] = useState(false)
  const [defaultBrowserStatus, setDefaultBrowserStatus] = useState<DefaultBrowserStatusPayload | null>(null)
  const [defaultBrowserPromptDismissedSession, setDefaultBrowserPromptDismissedSession] = useState(false)
  const [historyForSuggest, setHistoryForSuggest] = useState<HistoryEntry[]>([])
  const [omnibarRemotePhrases, setOmnibarRemotePhrases] = useState<string[]>([])
  const [omnibarSuggestIndex, setOmnibarSuggestIndex] = useState(0)
  const [omnibarSuggestPos, setOmnibarSuggestPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const omnibarRef = useRef<HTMLInputElement>(null)
  
  const omnibarSyncTabIdRef = useRef<number | null>(null)
  const omnibarWasFocusedRef = useRef(false)
  
  const omnibarPendingSelectAllRef = useRef(false)
  
  const [omnibarSelectNonce, setOmnibarSelectNonce] = useState(0)
  const siteInfoLeadRef = useRef<HTMLButtonElement>(null)
  const siteInfoPopoverRef = useRef<HTMLDivElement>(null)
  const omnibarWrapRef = useRef<HTMLDivElement>(null)
  const omnibarSuggestPortalRef = useRef<HTMLDivElement>(null)
  const downloadAnchorRef = useRef<HTMLDivElement>(null)
  const downloadTriggerBtnRef = useRef<HTMLButtonElement>(null)
  const downloadPanelRef = useRef<HTMLDivElement>(null)
  const downloadDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const downloadSampleRef = useRef<Map<string, { t: number; b: number }>>(new Map())
  const [sessionDownloads, setSessionDownloads] = useState<DownloadEntry[]>([])
  const [downloadPanelOpen, setDownloadPanelOpen] = useState(false)
  const [adblockToast, setAdblockToast] = useState<AdblockToastPayload | null>(null)
  const adblockToastDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [updateToast, setUpdateToast] = useState<{ version: string } | null>(null)
  const [downloadPanelPos, setDownloadPanelPos] = useState<{
    top: number
    right: number
    maxHeight: number
    listMaxHeight: number
  } | null>(null)

  const active = useMemo(
    () => tabs.find((t) => t.id === activeId) ?? null,
    [tabs, activeId]
  )

  const showDefaultBrowserBanner = Boolean(
    defaultBrowserStatus?.isPackaged &&
      !defaultBrowserStatus.isDefault &&
      !defaultBrowserPromptDismissedSession
  )

  const showDefaultBrowserOverflowItem = Boolean(
    defaultBrowserStatus?.isPackaged && !defaultBrowserStatus.isDefault
  )

  const omnibarPageSec = useMemo(() => omnibarPageSecurity(active?.url), [active?.url])
  const siteInfoLabel = useMemo(() => siteLabelFromTabUrl(active?.url), [active?.url])

  const refreshDefaultBrowserStatus = useCallback((): void => {
    void window.velo.getDefaultBrowserStatus().then(setDefaultBrowserStatus)
  }, [])

  const onMakeDefaultBrowser = useCallback(async (): Promise<void> => {
    await window.velo.registerDefaultBrowserAndOpenSettings()
    refreshDefaultBrowserStatus()
  }, [refreshDefaultBrowserStatus])

  useEffect(() => {
    refreshDefaultBrowserStatus()
    const id = setInterval(refreshDefaultBrowserStatus, 2500)
    return () => clearInterval(id)
  }, [refreshDefaultBrowserStatus])

  useEffect(() => {
    const onVis = (): void => {
      if (document.visibilityState === 'visible') refreshDefaultBrowserStatus()
    }
    window.addEventListener('focus', refreshDefaultBrowserStatus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', refreshDefaultBrowserStatus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshDefaultBrowserStatus])

  useLayoutEffect(() => {
    const px = showDefaultBrowserBanner ? DEFAULT_BROWSER_PROMPT_SHELL_RESERVE : 0
    let cancelled = false
    void window.velo.shellDefaultBrowserPromptSetReserve(px).then(() => {
      if (!cancelled) void window.velo.shellEnsureChromeOnTop()
    })
    return () => {
      cancelled = true
      void window.velo.shellDefaultBrowserPromptSetReserve(0)
    }
  }, [showDefaultBrowserBanner])

  const refreshHistorySuggest = useCallback(() => {
    void window.velo.historyList(2500).then((rows) => {
      setHistoryForSuggest(rows)
    })
  }, [])

  useEffect(() => {
    void refreshHistorySuggest()
  }, [refreshHistorySuggest])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = window.velo.onTabsUpdated(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        refreshHistorySuggest()
      }, 450)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [refreshHistorySuggest])

  const omnibarSuggestRows = useMemo((): OmnibarSuggestionRow[] => {
    if (!omnibarFocused) return []
    const q = omnibar.trim()
    if (!q) return []
    const hist = buildHistorySuggestions(historyForSuggest, q, 12)
    
    return mergeSearchSuggestions(q, hist, omnibarRemotePhrases, 12, searchEngineLabel('google'))
  }, [omnibarFocused, omnibar, historyForSuggest, omnibarRemotePhrases])

  const omnibarTrimRef = useRef('')
  useEffect(() => {
    omnibarTrimRef.current = omnibar.trim()
  }, [omnibar])

  useEffect(() => {
    if (!omnibarFocused) {
      setOmnibarRemotePhrases([])
      return
    }
    const q = omnibar.trim()
    if (q.length < 1) {
      setOmnibarRemotePhrases([])
      return
    }
    if (/^velo:/i.test(q)) {
      setOmnibarRemotePhrases([])
      return
    }
    let cancelled = false
    const qAtStart = q
    const tid = setTimeout(() => {
      void window.velo
        .omnibarFetchSuggestions(qAtStart)
        .then((phrases) => {
          if (cancelled || omnibarTrimRef.current !== qAtStart) return
          setOmnibarRemotePhrases(phrases)
        })
        .catch(() => {
          if (cancelled || omnibarTrimRef.current !== qAtStart) return
          setOmnibarRemotePhrases([])
        })
    }, 320)
    return () => {
      cancelled = true
      clearTimeout(tid)
    }
  }, [omnibar, omnibarFocused])

  useEffect(() => {
    setOmnibarSuggestIndex(0)
  }, [omnibar])

  useEffect(() => {
    setOmnibarSuggestIndex((i) => {
      const n = omnibarSuggestRows.length
      if (n === 0) return 0
      return Math.min(i, n - 1)
    })
  }, [omnibarSuggestRows.length])

  const showOmnibarSuggest =
    omnibarFocused && omnibar.trim().length > 0 && omnibarSuggestRows.length > 0

  useLayoutEffect(() => {
    if (!showOmnibarSuggest) {
      setOmnibarSuggestPos(null)
      return
    }
    let raf1 = 0
    let raf2 = 0
    const measure = (): void => {
      const wrap = omnibarWrapRef.current
      if (!wrap) return
      const r = wrap.getBoundingClientRect()
      setOmnibarSuggestPos({
        top: Math.round(r.bottom + 4),
        left: Math.round(r.left),
        width: Math.max(280, Math.round(r.width))
      })
    }
    measure()
    const schedule = (): void => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(measure)
      })
    }
    schedule()
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.removeEventListener('resize', measure)
    }
  }, [showOmnibarSuggest, omnibar, omnibarSuggestRows.length])

  useLayoutEffect(() => {
    let cancelled = false
    const clearReserve = (): void => {
      void window.velo.shellOmnibarSuggestSetReserve(0)
    }

    if (!showOmnibarSuggest) {
      clearReserve()
      return () => {
        cancelled = true
        clearReserve()
      }
    }

    if (!omnibarSuggestPos) {
      return () => {
        cancelled = true
      }
    }

    const applyReserveFromDom = (): void => {
      if (cancelled) return
      const el = omnibarSuggestPortalRef.current
      let measuredBand = 0
      if (el) {
        measuredBand = Math.max(0, Math.ceil(el.getBoundingClientRect().bottom) - CHROME_HEIGHT + 12)
      }
      const rowHeuristic = Math.min(420, 48 * omnibarSuggestRows.length + 40)
      const reserve = Math.min(420, Math.max(OMNIBAR_SUGGEST_SHELL_RESERVE_FALLBACK, rowHeuristic, measuredBand))
      void window.velo.shellOmnibarSuggestSetReserve(reserve).then(() => {
        if (cancelled) return
        requestAnimationFrame(() => {
          if (cancelled) return
          const el2 = omnibarSuggestPortalRef.current
          if (!el2) return
          const bump = Math.max(0, Math.ceil(el2.getBoundingClientRect().bottom) - CHROME_HEIGHT + 12)
          if (bump <= reserve) return
          void window.velo.shellOmnibarSuggestSetReserve(Math.min(420, bump))
        })
      })
    }

    applyReserveFromDom()
    requestAnimationFrame(() => {
      if (!cancelled) applyReserveFromDom()
    })
    const onResize = (): void => {
      applyReserveFromDom()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      clearReserve()
    }
  }, [showOmnibarSuggest, omnibarSuggestPos, omnibarSuggestRows.length])

  useEffect(() => {
    document.documentElement.style.setProperty('--chrome-height', `${CHROME_HEIGHT}px`)
  }, [])

  useEffect(() => {
    void window.velo.settingsGet().then((s) => {
      applyShellPresentation(s)
    })
  }, [])

  useEffect(() => {
    const off = window.velo.onSettingsChanged((s) => {
      applyShellPresentation(s)
    })
    return off
  }, [])

  const tabsScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = window.velo.onTabsUpdated(({ tabs: next, activeId: nextActive }) => {
      setTabs(next)
      setActiveId(nextActive)
    })
    void window.velo.tabsGetState().then((initial) => {
      setTabs(initial.tabs)
      setActiveId(initial.activeId)
    })
    return unsub
  }, [])

  useEffect(() => {
    const byId = new Map(tabs.map((t) => [t.id, t]))
    setTabFaviconLoadFailed((prev) => {
      let changed = false
      const next = { ...prev }
      for (const idStr of Object.keys(next)) {
        const id = Number(idStr)
        const tab = byId.get(id)
        if (!tab?.favicon || tab.favicon !== next[id]) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [tabs])

  useEffect(() => {
    const wrap = tabsScrollRef.current
    const el = wrap?.querySelector<HTMLElement>('.tab.active')
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [activeId, tabs.length])

  useEffect(() => {
    if (!active?.url) {
      setIsBookmarked(false)
      return
    }
    void window.velo.bookmarksList().then((list) => {
      setIsBookmarked(list.some((b) => b.url === active.url))
    })
  }, [active?.url])

  useEffect(() => {
    const sync = (): void => {
      if (!active?.url) {
        setIsBookmarked(false)
        return
      }
      void window.velo.bookmarksList().then((list) => {
        setIsBookmarked(list.some((b) => b.url === active.url))
      })
    }
    window.addEventListener('velo-bookmarks-mutated', sync)
    return () => window.removeEventListener('velo-bookmarks-mutated', sync)
  }, [active?.url])

  useEffect(() => {
    const onOpen = (e: Event): void => {
      const ce = e as CustomEvent<{ url: string; title: string; favicon: string | null }>
      const d = ce.detail
      if (!d?.url) return
      void window.velo.bookmarksFoldersList().then((folders) => {
        setBookmarkSaveModal({
          url: d.url,
          title: (d.title || d.url).slice(0, 512),
          favicon: d.favicon ?? null,
          folderId: DEFAULT_BOOKMARK_FOLDER_ID,
          folders
        })
        setBookmarkNewFolderName('')
      })
    }
    window.addEventListener('velo-open-bookmark-save', onOpen)
    return () => window.removeEventListener('velo-open-bookmark-save', onOpen)
  }, [])

  useEffect(() => {
    return window.velo.onPasswordBarState((s) => {
      setPasswordBar(s)
      if (s.open) {
        setPasswordBarUser(s.username)
        setPasswordBarPass(s.password)
        setPasswordBarReveal(false)
      }
    })
  }, [])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key !== 'd' && e.key !== 'D') return
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.altKey || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, [contenteditable="true"]')) return
      e.preventDefault()
      const tab = tabs.find((x) => x.id === activeId)
      if (!tab?.url) return
      void (async () => {
        const list = await window.velo.bookmarksList()
        const hit = list.find((b) => b.url === tab.url)
        if (hit) {
          await window.velo.bookmarksRemove(hit.id)
          setIsBookmarked(false)
          window.dispatchEvent(new CustomEvent('velo-bookmarks-mutated'))
          return
        }
        const folders = await window.velo.bookmarksFoldersList()
        setBookmarkSaveModal({
          url: tab.url,
          title: (tab.title || tab.url).slice(0, 512),
          favicon: tab.favicon,
          folderId: DEFAULT_BOOKMARK_FOLDER_ID,
          folders
        })
        setBookmarkNewFolderName('')
      })()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tabs, activeId])

  useEffect(() => {
    if (!bookmarkSaveModal) return
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') setBookmarkSaveModal(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [bookmarkSaveModal])

  useEffect(() => {
    if (!active) {
      setOmnibar('')
      omnibarSyncTabIdRef.current = null
      omnibarWasFocusedRef.current = false
      return
    }

    const tabId = active.id
    const hadTab = omnibarSyncTabIdRef.current !== null
    const tabSwitched = hadTab && omnibarSyncTabIdRef.current !== tabId
    omnibarSyncTabIdRef.current = tabId

    const gainedFocus = omnibarFocused && !omnibarWasFocusedRef.current
    omnibarWasFocusedRef.current = omnibarFocused

    if (!omnibarFocused) {
      setOmnibar(omnibarPrettyFromTabUrl(active.url || ''))
      return
    }

    if (tabSwitched || gainedFocus) {
      omnibarPendingSelectAllRef.current = true
      const next = omnibarDisplayFromUrl(active.url || '')
      setOmnibar(next)
      if (next === omnibar) {
        setOmnibarSelectNonce((n) => n + 1)
      }
    }
  }, [active, omnibarFocused])

  useLayoutEffect(() => {
    if (!omnibarFocused) {
      omnibarPendingSelectAllRef.current = false
      return
    }
    if (!omnibarPendingSelectAllRef.current) return
    const el = omnibarRef.current
    if (!el) return
    omnibarPendingSelectAllRef.current = false
    el.select()
  }, [omnibar, omnibarFocused, omnibarSelectNonce])

  useEffect(() => {
    setSiteInfoOpen(false)
  }, [active?.id, active?.url])

  useEffect(() => {
    if (!siteInfoOpen) return
    const onDocDown = (e: globalThis.MouseEvent): void => {
      const node = e.target as Node
      if (siteInfoLeadRef.current?.contains(node)) return
      if (siteInfoPopoverRef.current?.contains(node)) return
      setSiteInfoOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') setSiteInfoOpen(false)
    }
    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [siteInfoOpen])

  const scheduleDownloadPanelClose = useCallback((ms: number) => {
    if (downloadDismissRef.current) clearTimeout(downloadDismissRef.current)
    downloadDismissRef.current = setTimeout(() => {
      setDownloadPanelOpen(false)
      downloadDismissRef.current = null
    }, ms)
  }, [])

  const closeDownloadPanel = useCallback(() => {
    if (downloadDismissRef.current) {
      clearTimeout(downloadDismissRef.current)
      downloadDismissRef.current = null
    }
    setDownloadPanelOpen(false)
  }, [])

  useEffect(() => {
    if (!downloadPanelOpen) return
    const onDocDown = (e: globalThis.MouseEvent): void => {
      const node = e.target as Node
      if (downloadPanelRef.current?.contains(node)) return
      if (downloadAnchorRef.current?.contains(node)) return
      closeDownloadPanel()
    }
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') closeDownloadPanel()
    }
    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [downloadPanelOpen, closeDownloadPanel])

  useEffect(() => {
    void window.velo.downloadsList().then((rows) => {
      if (rows.length) setSessionDownloads(rows.slice(0, 8))
    })
  }, [])

  useEffect(() => {
    const off = window.velo.onDownloadsChanged((entries) => {
      const next = entries.slice(0, 8)
      setSessionDownloads(next)
      if (next.length === 0) {
        setDownloadPanelOpen(false)
        if (downloadDismissRef.current) {
          clearTimeout(downloadDismissRef.current)
          downloadDismissRef.current = null
        }
        return
      }
      setDownloadPanelOpen(true)
      scheduleDownloadPanelClose(10000)
    })
    return () => {
      off()
      if (downloadDismissRef.current) {
        clearTimeout(downloadDismissRef.current)
        downloadDismissRef.current = null
      }
    }
  }, [scheduleDownloadPanelClose])

  useEffect(() => {
    const off = window.velo.onAdblockToast((payload: AdblockToastPayload) => {
      if (payload.count < 1) return
      if (adblockToastDismissRef.current) {
        clearTimeout(adblockToastDismissRef.current)
        adblockToastDismissRef.current = null
      }
      setAdblockToast(payload)
      const ms = payload.suggestSiteFix ? 10_500 : payload.quiet ? 2800 : 4200
      adblockToastDismissRef.current = setTimeout(() => {
        setAdblockToast(null)
        adblockToastDismissRef.current = null
      }, ms)
    })
    return () => {
      off()
      if (adblockToastDismissRef.current) {
        clearTimeout(adblockToastDismissRef.current)
        adblockToastDismissRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const off = window.velo.onAutoUpdateStatus((st: AutoUpdateStatusPayload) => {
      if (st.phase === 'downloaded') setUpdateToast({ version: st.version })
    })
    void window.velo.getAutoUpdateStatus().then((st) => {
      if (st.phase === 'downloaded') setUpdateToast({ version: st.version })
    })
    return off
  }, [])

  useEffect(() => {
    return () => {
      void window.velo.shellDownloadsPopoverSetReserve(0)
    }
  }, [])

  useEffect(() => {
    return () => {
      void window.velo.shellSiteInfoPopoverSetReserve(0)
    }
  }, [])

  useEffect(() => {
    return () => {
      void window.velo.shellBookmarkModalSetReserve(0)
    }
  }, [])

  useEffect(() => {
    return () => {
      void window.velo.shellOmnibarSuggestSetReserve(0)
    }
  }, [])

  useLayoutEffect(() => {
    const reserve = bookmarkSaveModal != null ? BOOKMARK_SAVE_MODAL_SHELL_RESERVE : 0
    let cancelled = false
    void window.velo.shellBookmarkModalSetReserve(reserve).then(() => {
      if (cancelled) return
      void window.velo.shellEnsureChromeOnTop()
      if (reserve > 0) {
        requestAnimationFrame(() => {
          if (cancelled) return
          void window.velo.shellEnsureChromeOnTop()
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [bookmarkSaveModal])

  useEffect(() => {
    if (!bookmarkSaveModal) return
    const onResize = (): void => {
      void window.velo.shellBookmarkModalSetReserve(BOOKMARK_SAVE_MODAL_SHELL_RESERVE)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [bookmarkSaveModal])

  useLayoutEffect(() => {
    const show = siteInfoOpen && (omnibarPageSec === 'https' || omnibarPageSec === 'http')
    let cancelled = false

    if (!show) {
      setSiteInfoPopoverPos(null)
    }

    const measure = (): void => {
      if (!show || cancelled) return
      const el = siteInfoLeadRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setSiteInfoPopoverPos({ top: Math.round(r.bottom + 6), left: Math.round(r.left) })
    }

    if (show) {
      measure()
    }

    const reserve = show ? SITE_INFO_POPOVER_SHELL_RESERVE : 0
    void window.velo.shellSiteInfoPopoverSetReserve(reserve).then(() => {
      if (cancelled) return
      void window.velo.shellEnsureChromeOnTop()
      if (show) {
        measure()
        requestAnimationFrame(() => {
          if (cancelled) return
          void window.velo.shellEnsureChromeOnTop()
          measure()
        })
      }
    })

    const onResize = (): void => {
      measure()
      if (show) void window.velo.shellEnsureChromeOnTop()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
    }
  }, [siteInfoOpen, omnibarPageSec])

  const positionDownloadPanel = useCallback(() => {
    const el = downloadTriggerBtnRef.current ?? downloadAnchorRef.current
    if (!el || !downloadPanelOpen) return
    const r = el.getBoundingClientRect()
    
    const gap = 2
    const edgePad = 6
    const top = Math.round(r.bottom + gap)
    const roomBelow = window.innerHeight - top - edgePad
    const maxHeight = Math.min(220, Math.max(72, roomBelow))
    const headerReserve = 44
    const listMaxHeight = Math.max(56, maxHeight - headerReserve)
    setDownloadPanelPos({
      top,
      right: Math.max(6, window.innerWidth - r.right),
      maxHeight,
      listMaxHeight
    })
  }, [downloadPanelOpen])

  useLayoutEffect(() => {
    const reserve =
      downloadPanelOpen && sessionDownloads.length > 0 ? DOWNLOAD_POPOVER_SHELL_RESERVE : 0
    if (!downloadPanelOpen || sessionDownloads.length === 0) {
      setDownloadPanelPos(null)
    }
    let cancelled = false
    void window.velo.shellDownloadsPopoverSetReserve(reserve).then(() => {
      if (cancelled) return
      if (reserve > 0) {
        positionDownloadPanel()
        requestAnimationFrame(() => {
          positionDownloadPanel()
          requestAnimationFrame(() => positionDownloadPanel())
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [downloadPanelOpen, sessionDownloads.length, positionDownloadPanel])

  useEffect(() => {
    if (!downloadPanelOpen || sessionDownloads.length === 0) return
    let cancelled = false
    requestAnimationFrame(() => {
      if (cancelled) return
      positionDownloadPanel()
      requestAnimationFrame(() => {
        if (!cancelled) positionDownloadPanel()
      })
    })
    return () => {
      cancelled = true
    }
  }, [sessionDownloads, downloadPanelOpen, positionDownloadPanel])

  useEffect(() => {
    if (!downloadPanelOpen) return
    const onResize = (): void => {
      positionDownloadPanel()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [downloadPanelOpen, positionDownloadPanel])

  const onSelectTab = useCallback(async (id: number) => {
    await window.velo.tabsSetActive(id)
    setActiveId(id)
  }, [])

  const onNewTab = useCallback(async () => {
    await window.velo.tabsCreate('velo://newtab')
  }, [])

  const onCloseTab = useCallback(async (e: MouseEvent, id: number) => {
    e.stopPropagation()
    await window.velo.tabsClose(id)
  }, [])

  const onNavigate = useCallback(
    async (inputOverride?: string) => {
      if (activeId == null) return
      await window.velo.navSubmit(activeId, inputOverride ?? omnibar)
    },
    [activeId, omnibar]
  )

  const onBack = useCallback(async () => {
    if (activeId == null) return
    await window.velo.navBack(activeId)
  }, [activeId])

  const onForward = useCallback(async () => {
    if (activeId == null) return
    await window.velo.navForward(activeId)
  }, [activeId])

  const onReload = useCallback(async () => {
    if (activeId == null) return
    if (active?.isLoading) await window.velo.navStop(activeId)
    else await window.velo.navReload(activeId)
  }, [activeId, active?.isLoading])

  const onOmnibarMouseDown = useCallback((e: MouseEvent<HTMLInputElement>) => {
    const el = omnibarRef.current
    if (!el) return
    
    if (document.activeElement === el) return
    e.preventDefault()
    el.focus()
  }, [])

  const onOmnibarFocus = useCallback(() => {
    setOmnibarFocused(true)
    refreshHistorySuggest()
  }, [refreshHistorySuggest])

  const onOmnibarBlur = useCallback(() => {
    setOmnibarFocused(false)
  }, [])

  const onAddShortcut = useCallback(async () => {
    await window.velo.shellOpenNewTabShortcutModal()
  }, [])

  const bookmarkCurrent = useCallback(async () => {
    if (!active?.url) return
    const list = await window.velo.bookmarksList()
    const existing = list.find((b) => b.url === active.url)
    if (existing) {
      await window.velo.bookmarksRemove(existing.id)
      setIsBookmarked(false)
      window.dispatchEvent(new CustomEvent('velo-bookmarks-mutated'))
    } else {
      const folders = await window.velo.bookmarksFoldersList()
      setBookmarkSaveModal({
        url: active.url,
        title: (active.title || active.url).slice(0, 512),
        favicon: active.favicon,
        folderId: DEFAULT_BOOKMARK_FOLDER_ID,
        folders
      })
      setBookmarkNewFolderName('')
    }
  }, [active?.url, active?.title, active?.favicon])

  const omnibarSuggestEl =
    showOmnibarSuggest && omnibarSuggestPos
      ? createPortal(
          <div
            ref={omnibarSuggestPortalRef}
            id="velo-omnibar-suggest-list"
            className="omnibar-suggest omnibar-suggest-portal"
            style={{
              position: 'fixed',
              top: omnibarSuggestPos.top,
              left: omnibarSuggestPos.left,
              width: omnibarSuggestPos.width,
              zIndex: 2147483000
            }}
            role="listbox"
            aria-label="Address bar suggestions"
            onPointerDown={(e) => e.preventDefault()}
          >
            {omnibarSuggestRows.map((row, idx) => (
              <button
                key={row.key}
                type="button"
                className={`omnibar-suggest-row${idx === omnibarSuggestIndex ? ' is-active' : ''}`}
                role="option"
                aria-selected={idx === omnibarSuggestIndex}
                onMouseEnter={() => setOmnibarSuggestIndex(idx)}
                onClick={() => {
                  void onNavigate(row.submitInput)
                  omnibarRef.current?.blur()
                }}
              >
                {row.source === 'search' ? (
                  <span className="omnibar-suggest-ic" aria-hidden>
                    <IconSearch size={17} />
                  </span>
                ) : row.source === 'navigate' ? (
                  <span className="omnibar-suggest-ic" aria-hidden>
                    <IconGlobe size={17} />
                  </span>
                ) : (
                  <span className="omnibar-suggest-ic" aria-hidden>
                    <IconHistory size={17} />
                  </span>
                )}
                <span className="omnibar-suggest-row-main">
                  {row.source === 'search' && row.secondary ? (
                    <span className="omnibar-suggest-line">
                      <span className="omnibar-suggest-primary">{row.primary}</span>
                      <span className="omnibar-suggest-sep"> — </span>
                      <span className="omnibar-suggest-engine">{row.secondary}</span>
                    </span>
                  ) : (
                    <>
                      <span
                        className={
                          row.source === 'navigate'
                            ? 'omnibar-suggest-primary omnibar-suggest-primary--navigate'
                            : 'omnibar-suggest-primary'
                        }
                      >
                        {row.primary}
                      </span>
                      {row.secondary ? (
                        <span className="omnibar-suggest-secondary">{row.secondary}</span>
                      ) : null}
                    </>
                  )}
                </span>
                {row.source === 'history' ? (
                  <span className="omnibar-suggest-badge">History</span>
                ) : row.suggestBadge ? (
                  <span className="omnibar-suggest-badge omnibar-suggest-badge--velo">{row.suggestBadge}</span>
                ) : null}
              </button>
            ))}
          </div>,
          document.body
        )
      : null

  const mac = isMac()
  const tabStripCrowded = tabs.length > 6

  const getDownloadToastLines = useCallback((d: DownloadEntry): { title: string; stat: string; detail: string } => {
    const title = d.filename
    if (d.fileRemovedFromDisk) {
      return { title, stat: 'Deleted', detail: '' }
    }
    if (d.state === 'completed') {
      return {
        title,
        stat: 'Done',
        detail: formatSizeBytes(d.totalBytes > 0 ? d.totalBytes : d.receivedBytes)
      }
    }
    if (d.state === 'cancelled') return { title, stat: 'Stopped', detail: '' }
    if (d.state === 'interrupted') return { title, stat: 'Failed', detail: '' }

    const now = Date.now()
    const prev = downloadSampleRef.current.get(d.id)
    let bps = 0
    if (prev && d.receivedBytes >= prev.b) {
      const dt = (now - prev.t) / 1000
      if (dt >= 0.08) bps = (d.receivedBytes - prev.b) / dt
    }
    downloadSampleRef.current.set(d.id, { t: now, b: d.receivedBytes })

    const pct = d.totalBytes > 0 ? Math.min(100, Math.round((100 * d.receivedBytes) / d.totalBytes)) : null
    const stat = pct != null ? `${pct}%` : 'Downloading…'

    const sizePart =
      d.totalBytes > 0
        ? `${formatSizeBytes(d.receivedBytes)} / ${formatSizeBytes(d.totalBytes)}`
        : `${formatSizeBytes(d.receivedBytes)}`

    const parts: string[] = [sizePart]
    const spd = formatSpeedBps(bps)
    if (spd) parts.push(spd)
    if (bps > 256 && d.totalBytes > 0 && d.receivedBytes < d.totalBytes) {
      const left = d.totalBytes - d.receivedBytes
      const sec = Math.ceil(left / bps)
      if (sec <= 1) parts.push('~1 s left')
      else if (sec < 60) parts.push(`~${sec} s left`)
      else if (sec < 3600) parts.push(`~${Math.ceil(sec / 60)} min left`)
      else parts.push(`~${Math.ceil(sec / 3600)} h left`)
    }
    return { title, stat, detail: parts.join(' · ') }
  }, [])

  const siteInfoPopoverEl =
    siteInfoOpen &&
    siteInfoPopoverPos &&
    (omnibarPageSec === 'https' || omnibarPageSec === 'http')
      ? createPortal(
          <div
            ref={siteInfoPopoverRef}
            className="site-info-popover"
            role="dialog"
            aria-label="Site connection"
            style={{ top: siteInfoPopoverPos.top, left: siteInfoPopoverPos.left }}
          >
            <div className="site-info-popover-header">
              <span className="site-info-popover-title">
                {siteInfoLabel ? `About ${siteInfoLabel}` : 'Site information'}
              </span>
              <button
                type="button"
                className="site-info-popover-close"
                aria-label="Close"
                onClick={() => setSiteInfoOpen(false)}
              >
                <IconTabClose size={14} />
              </button>
            </div>
            <p className="site-info-popover-body">
              {omnibarPageSec === 'https'
                ? 'This site uses a secure connection (HTTPS).'
                : 'Your connection to this site is not secure. Avoid entering sensitive information.'}
            </p>
          </div>,
          document.body
        )
      : null

  const downloadPanelEl =
    downloadPanelOpen && sessionDownloads.length > 0
      ? createPortal(
          <div
            ref={downloadPanelRef}
            className="download-toast no-drag"
            role="dialog"
            aria-label="Recent downloads"
            style={
              downloadPanelPos
                ? ({
                    top: downloadPanelPos.top,
                    right: downloadPanelPos.right,
                    maxHeight: downloadPanelPos.maxHeight,
                    ['--download-list-max' as string]: `${downloadPanelPos.listMaxHeight}px`,
                    bottom: 'auto',
                    left: 'auto',
                    visibility: 'visible'
                  } as CSSProperties)
                : { top: 0, right: 0, bottom: 'auto', left: 'auto', visibility: 'hidden' }
            }
            onMouseEnter={() => {
              if (downloadDismissRef.current) {
                clearTimeout(downloadDismissRef.current)
                downloadDismissRef.current = null
              }
            }}
            onMouseLeave={() => {
              if (downloadDismissRef.current) clearTimeout(downloadDismissRef.current)
              scheduleDownloadPanelClose(4000)
            }}
          >
            <div className="download-toast-header">
              <p className="download-toast-title">Downloads</p>
              <div className="download-toast-actions">
                <button
                  type="button"
                  className="download-toast-link"
                  onClick={() => {
                    void window.velo.tabsCreate('velo://settings/downloads')
                    closeDownloadPanel()
                  }}
                >
                  View all
                </button>
                <button
                  type="button"
                  className="download-toast-dismiss"
                  aria-label="Close"
                  onClick={() => closeDownloadPanel()}
                >
                  ×
                </button>
              </div>
            </div>
            <ul className="download-toast-list">
              {sessionDownloads.slice(0, 5).map((d) => {
                const { title, stat, detail } = getDownloadToastLines(d)
                const bar = downloadRowBarModel(d)
                const subline = detail ? `${stat} · ${detail}` : stat
                const showBar = d.state === 'progressing'
                const struck = downloadToastRowStruck(d)
                const showAct = downloadToastShowActionButton(d)
                const actTitle = d.state === 'progressing' ? 'Stop download' : 'Delete file'
                const actAria =
                  d.state === 'progressing'
                    ? `Stop downloading ${title}`
                    : `Delete ${title} from your Downloads folder`
                const canOpen =
                  d.state === 'completed' && !d.fileRemovedFromDisk && Boolean(d.path)
                return (
                  <li
                    key={d.id}
                    className={`download-toast-row${struck ? ' download-toast-row--struck' : ''}${canOpen ? ' download-toast-row--openable' : ''}`}
                    title={canOpen ? 'Double-click to open' : undefined}
                    onDoubleClick={
                      canOpen
                        ? () => {
                            void window.velo.downloadsOpenFile(d.id)
                          }
                        : undefined
                    }
                  >
                    <div className="download-toast-row-top">
                      <div className="download-toast-filename" title={title}>
                        {title}
                      </div>
                      {showAct ? (
                        <button
                          type="button"
                          className="download-toast-row-remove"
                          title={actTitle}
                          aria-label={actAria}
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadSampleRef.current.delete(d.id)
                            void window.velo.downloadsApplyAction(d.id)
                          }}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                    {showBar ? (
                      <div className="download-toast-row-bar" aria-hidden>
                        <div
                          className={`download-toast-row-bar-fill is-${bar.variant}${bar.indeterminate ? ' is-indeterminate' : ''}`}
                          style={bar.indeterminate ? undefined : { width: `${bar.pct}%` }}
                        />
                      </div>
                    ) : null}
                    <p className="download-toast-sub" title={subline}>
                      {subline}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body
        )
      : null

  const adblockToastEl =
    adblockToast != null
      ? createPortal(
          <div
            className={`velo-adblock-toast no-drag${adblockToast.suggestSiteFix ? ' velo-adblock-toast--wide' : ''}`}
            role="status"
            aria-live="polite"
            style={
              {
                top: 'calc(var(--chrome-height) + 10px)'
              } as CSSProperties
            }
          >
            <span className="velo-adblock-toast-ic" aria-hidden>
              <IconShieldPrivacy size={22} />
            </span>
            <div className="velo-adblock-toast-copy">
              <span className="velo-adblock-toast-line">
                {adblockToast.count === 1
                  ? 'Blocked 1 ad or tracker'
                  : `Blocked ${adblockToast.count} ads & trackers`}
              </span>
              {adblockToast.suggestSiteFix && adblockToast.pageHostname ? (
                <>
                  <p className="velo-adblock-toast-hint">
                    If the page looks wrong or stays blank, try adding <strong>{adblockToast.pageHostname}</strong> under Privacy → Ad block allowlist
                    (Velo already keeps first-party and WebSocket traffic unblocked).
                    and refresh, or use the button below.
                  </p>
                  <div className="velo-adblock-toast-actions">
                    <button
                      type="button"
                      className="velo-adblock-toast-btn"
                      disabled={activeId == null}
                      onClick={() => {
                        const h = adblockToast.pageHostname
                        if (!h || activeId == null) return
                        void (async () => {
                          const s = await window.velo.settingsGet()
                          const cur = s.adBlockAllowlistHostnames
                          if (!cur.includes(h)) {
                            await window.velo.settingsSet({ adBlockAllowlistHostnames: [...cur, h] })
                          }
                          void window.velo.navReload(activeId)
                          if (adblockToastDismissRef.current) {
                            clearTimeout(adblockToastDismissRef.current)
                            adblockToastDismissRef.current = null
                          }
                          setAdblockToast(null)
                        })()
                      }}
                    >
                      Allow this site & reload
                    </button>
                    <button
                      type="button"
                      className="velo-adblock-toast-btn velo-adblock-toast-btn--secondary"
                      onClick={() => {
                        void window.velo.tabsCreate('velo://settings/privacy')
                      }}
                    >
                      Privacy settings
                    </button>
                  </div>
                </>
              ) : null}
            </div>
            <button
              type="button"
              className="velo-adblock-toast-dismiss"
              aria-label="Dismiss"
              onClick={() => {
                if (adblockToastDismissRef.current) {
                  clearTimeout(adblockToastDismissRef.current)
                  adblockToastDismissRef.current = null
                }
                setAdblockToast(null)
              }}
            >
              <IconTabClose size={14} />
            </button>
          </div>,
          document.body
        )
      : null

  const updateToastEl =
    updateToast != null
      ? createPortal(
          <div
            className="velo-adblock-toast velo-update-toast no-drag"
            role="status"
            aria-live="polite"
            style={
              {
                top: 'calc(var(--chrome-height) + 10px)'
              } as CSSProperties
            }
          >
            <span className="velo-adblock-toast-ic" aria-hidden>
              <IconDownload size={22} />
            </span>
            <div className="velo-adblock-toast-copy">
              <span className="velo-adblock-toast-line">Update ready (v{updateToast.version})</span>
              <p className="velo-adblock-toast-hint">Restart Velo to finish installing.</p>
              <div className="velo-adblock-toast-actions">
                <button
                  type="button"
                  className="velo-adblock-toast-btn"
                  onClick={() => void window.velo.quitAndInstallUpdate()}
                >
                  Restart Velo
                </button>
                <button
                  type="button"
                  className="velo-adblock-toast-btn velo-adblock-toast-btn--secondary"
                  onClick={() => setUpdateToast(null)}
                >
                  Later
                </button>
              </div>
            </div>
            <button
              type="button"
              className="velo-adblock-toast-dismiss"
              aria-label="Dismiss"
              onClick={() => setUpdateToast(null)}
            >
              <IconTabClose size={14} />
            </button>
          </div>,
          document.body
        )
      : null

  const bookmarkSaveEl =
    bookmarkSaveModal != null
      ? createPortal(
          <div
            className="bookmark-save-backdrop no-drag"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setBookmarkSaveModal(null)
            }}
          >
            <div
              className="bookmark-save-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="bookmark-save-title"
              onMouseDown={(e) => {
                e.stopPropagation()
              }}
            >
              <h2 id="bookmark-save-title" className="bookmark-save-h">
                Save bookmark
              </h2>
              <label className="bookmark-save-label" htmlFor="bookmark-save-name">
                Name
              </label>
              <input
                id="bookmark-save-name"
                className="bookmark-save-input"
                value={bookmarkSaveModal.title}
                onChange={(e) =>
                  setBookmarkSaveModal({
                    ...bookmarkSaveModal,
                    title: e.target.value.slice(0, 512)
                  })
                }
                autoFocus
              />
              <label className="bookmark-save-label" htmlFor="bookmark-save-folder">
                Folder
              </label>
              <select
                id="bookmark-save-folder"
                className="bookmark-save-select"
                value={bookmarkSaveModal.folderId}
                onChange={(e) =>
                  setBookmarkSaveModal({ ...bookmarkSaveModal, folderId: e.target.value })
                }
              >
                {bookmarkSaveModal.folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <div className="bookmark-save-new-folder">
                <input
                  className="bookmark-save-input"
                  placeholder="New folder name"
                  value={bookmarkNewFolderName}
                  onChange={(e) => setBookmarkNewFolderName(e.target.value)}
                  aria-label="New folder name"
                />
                <button
                  type="button"
                  className="bookmark-save-btn secondary"
                  onClick={() =>
                    void (async () => {
                      const name = bookmarkNewFolderName.trim()
                      if (!name || !bookmarkSaveModal) return
                      const folder = await window.velo.bookmarksFolderAdd(name)
                      const folders = await window.velo.bookmarksFoldersList()
                      setBookmarkSaveModal({
                        ...bookmarkSaveModal,
                        folders,
                        folderId: folder.id
                      })
                      setBookmarkNewFolderName('')
                    })()
                  }
                >
                  Add folder
                </button>
              </div>
              <p className="bookmark-save-url" title={bookmarkSaveModal.url}>
                {bookmarkSaveModal.url}
              </p>
              <div className="bookmark-save-actions">
                <button
                  type="button"
                  className="bookmark-save-btn secondary"
                  onClick={() => setBookmarkSaveModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="bookmark-save-btn primary"
                  onClick={() =>
                    void (async () => {
                      if (!bookmarkSaveModal) return
                      const title = bookmarkSaveModal.title.trim() || bookmarkSaveModal.url
                      await window.velo.bookmarksAdd({
                        url: bookmarkSaveModal.url,
                        title,
                        folderId: bookmarkSaveModal.folderId,
                        favicon: bookmarkSaveModal.favicon
                      })
                      setIsBookmarked(true)
                      setBookmarkSaveModal(null)
                      window.dispatchEvent(new CustomEvent('velo-bookmarks-mutated'))
                    })()
                  }
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  const pbReserve = passwordBar.open ? PASSWORD_BAR_SHELL_RESERVE : 0
  const dbReserve = showDefaultBrowserBanner ? DEFAULT_BROWSER_PROMPT_SHELL_RESERVE : 0

  return (
    <>
      <div
        className="app"
        style={{ height: CHROME_HEIGHT + pbReserve + dbReserve, minHeight: CHROME_HEIGHT + pbReserve + dbReserve }}
      >
      <div
        className={`tab-row chrome-drag-region ${mac ? 'mac' : ''}`}
        data-tab-crowded={tabStripCrowded ? 'true' : 'false'}
      >
        <div className="tabs-scroll" ref={tabsScrollRef}>
          <div className="tabs-inner">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab no-drag ${t.id === activeId ? 'active' : ''}${t.isResting ? ' is-resting' : ''}`}
                onClick={() => void onSelectTab(t.id)}
              >
                <span className="tab-leading">
                  {t.isLoading ? (
                    <span className="tab-loading" aria-hidden="true" title="Loading" />
                  ) : t.favicon && tabFaviconLoadFailed[t.id] !== t.favicon ? (
                    <img
                      src={t.favicon}
                      alt=""
                      className="tab-favicon"
                      onError={() =>
                        setTabFaviconLoadFailed((p) => (p[t.id] === t.favicon ? p : { ...p, [t.id]: t.favicon! }))
                      }
                    />
                  ) : (
                    <span className="tab-favicon tab-favicon-placeholder" aria-hidden="true" />
                  )}
                </span>
                <span className="tab-title">{t.title || 'New tab'}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="tab-close no-drag"
                  title="Close tab"
                  onClick={(e) => void onCloseTab(e, t.id)}
                >
                  <IconTabClose size={18} />
                </span>
              </button>
            ))}
            <button
              type="button"
              className="new-tab no-drag"
              title="New tab"
              aria-label="New tab"
              onClick={() => void onNewTab()}
            >
              <IconPlus size={16} />
            </button>
          </div>
        </div>
        {!mac ? (
          <div className="window-controls no-drag">
            <button type="button" className="win-btn" title="Minimize" onClick={() => window.velo.windowMinimize()}>
              <IconWinMinimize size={11} />
            </button>
            <button type="button" className="win-btn" title="Maximize" onClick={() => window.velo.windowMaximizeToggle()}>
              <IconWinMaximize size={11} />
            </button>
            <button type="button" className="win-btn win-btn-close" title="Close" onClick={() => window.velo.windowClose()}>
              <IconWinClose size={11} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="toolbar no-drag">
        <div className="nav-cluster">
          <button
            type="button"
            className="tool-btn"
            title="Back"
            disabled={!active?.canGoBack}
            onClick={() => void onBack()}
          >
            <IconBack size={20} />
          </button>
          <button
            type="button"
            className="tool-btn"
            title="Forward"
            disabled={!active?.canGoForward}
            onClick={() => void onForward()}
          >
            <IconForward size={20} />
          </button>
          <button type="button" className="tool-btn" title={active?.isLoading ? 'Stop' : 'Reload'} onClick={() => void onReload()}>
            {active?.isLoading ? <IconStop size={18} /> : <IconReload size={18} />}
          </button>
        </div>
        <div className="omnibar-wrap" ref={omnibarWrapRef}>
          <div className="omnibar-field">
            <div className="omnibar-lead-anchor">
              <button
                ref={siteInfoLeadRef}
                type="button"
                className="omnibar-lead"
                title={
                  omnibarPageSec === 'https'
                    ? 'Connection is secure'
                    : omnibarPageSec === 'http'
                      ? 'Connection is not secure'
                      : 'Search or enter address'
                }
                aria-label={
                  omnibarPageSec === 'https'
                    ? 'Connection is secure'
                    : omnibarPageSec === 'http'
                      ? 'Connection is not secure'
                      : 'Search or enter address'
                }
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (omnibarPageSec === 'search') {
                    omnibarRef.current?.focus()
                    return
                  }
                  omnibarRef.current?.blur()
                  setSiteInfoOpen((open) => !open)
                }}
              >
                {omnibarPageSec === 'https' ? (
                  <IconLock size={18} />
                ) : omnibarPageSec === 'http' ? (
                  <IconInfo size={18} />
                ) : (
                  <IconSearch size={18} />
                )}
              </button>
            </div>
            <input
              ref={omnibarRef}
              className="omnibar"
              value={omnibar}
              placeholder="Search or type a URL"
              spellCheck={false}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showOmnibarSuggest}
              aria-controls="velo-omnibar-suggest-list"
              onMouseDown={onOmnibarMouseDown}
              onFocus={onOmnibarFocus}
              onBlur={onOmnibarBlur}
              onChange={(e) => setOmnibar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && showOmnibarSuggest) {
                  e.preventDefault()
                  setOmnibarSuggestIndex((i) => Math.min(omnibarSuggestRows.length - 1, i + 1))
                  return
                }
                if (e.key === 'ArrowUp' && showOmnibarSuggest) {
                  e.preventDefault()
                  setOmnibarSuggestIndex((i) => Math.max(0, i - 1))
                  return
                }
                if (e.key === 'Tab' && !e.shiftKey && showOmnibarSuggest) {
                  e.preventDefault()
                  const row =
                    omnibarSuggestRows[omnibarSuggestIndex] ?? omnibarSuggestRows[0] ?? null
                  if (row) setOmnibar(row.fillDisplay)
                  return
                }
                if (e.key === 'Escape' && showOmnibarSuggest) {
                  e.preventDefault()
                  omnibarRef.current?.blur()
                  return
                }
                if (e.key === 'Enter') {
                  if (showOmnibarSuggest) {
                    e.preventDefault()
                    const row = omnibarSuggestRows[omnibarSuggestIndex] ?? null
                    const useRowSubmit =
                      row != null && (row.source === 'history' || row.source === 'navigate')
                    void onNavigate(useRowSubmit ? row.submitInput : omnibar)
                    return
                  }
                  void onNavigate()
                }
              }}
            />
          </div>
        </div>
        <div className="actions">
          {active?.url && isNewTabPageUrl(active.url) ? (
            <button
              type="button"
              className="tool-btn"
              title="Add shortcut"
              aria-label="Add shortcut"
              onClick={() => void onAddShortcut()}
            >
              <IconShortcuts size={20} />
            </button>
          ) : null}
          {sessionDownloads.length > 0 ? (
            <div className="chrome-downloads-anchor" ref={downloadAnchorRef}>
              <button
                ref={downloadTriggerBtnRef}
                type="button"
                className={`tool-btn ${downloadPanelOpen ? 'is-active' : ''}`}
                title="Recent downloads"
                aria-label="Recent downloads"
                aria-expanded={downloadPanelOpen}
                onClick={() => {
                  setDownloadPanelOpen((open) => {
                    const next = !open
                    if (next) {
                      scheduleDownloadPanelClose(10000)
                    } else if (downloadDismissRef.current) {
                      clearTimeout(downloadDismissRef.current)
                      downloadDismissRef.current = null
                    }
                    return next
                  })
                }}
              >
                <IconDownload size={20} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={`bookmark-btn tool-btn ${isBookmarked ? 'is-bookmarked' : ''}`}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark this tab'}
            disabled={!active?.url}
            onClick={() => void bookmarkCurrent()}
          >
            {isBookmarked ? <IconStarFilled size={20} /> : <IconStarOutline size={20} />}
          </button>
          <ChromeOverflowMenu
            showMakeDefaultBrowser={showDefaultBrowserOverflowItem}
            onMakeDefaultBrowser={onMakeDefaultBrowser}
          />
        </div>
      </div>

      {showDefaultBrowserBanner ? (
        <div className="velo-default-browser-bar no-drag" role="region" aria-label="Default browser">
          <span className="velo-default-browser-bar-msg">Make Velo your default browser</span>
          <div className="velo-default-browser-bar-actions">
            <button type="button" className="velo-default-browser-bar-primary" onClick={() => void onMakeDefaultBrowser()}>
              Make default
            </button>
            <button
              type="button"
              className="velo-default-browser-bar-secondary"
              onClick={() => setDefaultBrowserPromptDismissedSession(true)}
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {passwordBar.open ? (
        <div className="velo-password-bar no-drag" role="region" aria-label="Save password">
          <span className="velo-password-bar-msg">Save password for {passwordBar.domain}?</span>
          <label className="velo-password-bar-label">
            <span>Username</span>
            <input
              type="text"
              value={passwordBarUser}
              onChange={(e) => setPasswordBarUser(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="velo-password-bar-label">
            <span>Password</span>
            <input
              type={passwordBarReveal ? 'text' : 'password'}
              value={passwordBarPass}
              onChange={(e) => setPasswordBarPass(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <div className="velo-password-bar-actions">
            <button type="button" className="velo-password-bar-secondary" onClick={() => setPasswordBarReveal((r) => !r)}>
              {passwordBarReveal ? 'Hide' : 'Reveal'}
            </button>
            <button
              type="button"
              className="velo-password-bar-primary"
              onClick={() => {
                if (!passwordBar.open) return
                void (async () => {
                  try {
                    await window.velo.passwordBarSave({
                      tabId: passwordBar.tabId,
                      domain: passwordBar.domain,
                      username: passwordBarUser,
                      password: passwordBarPass
                    })
                  } catch {}
                })()
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="velo-password-bar-secondary"
              onClick={() => {
                if (!passwordBar.open) return
                void window.velo.passwordBarNever({ tabId: passwordBar.tabId, domain: passwordBar.domain })
              }}
            >
              Never
            </button>
            <button
              type="button"
              className="velo-password-bar-secondary"
              onClick={() => {
                if (!passwordBar.open) return
                void window.velo.passwordBarDismiss({ tabId: passwordBar.tabId })
              }}
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}

      </div>
      {bookmarkSaveEl}
      {siteInfoPopoverEl}
      {downloadPanelEl}
      {adblockToastEl}
      {updateToastEl}
      {omnibarSuggestEl}
    </>
  )
}
