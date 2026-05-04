import { webContents, type WebContents, type WebFrameMain } from 'electron'
import type { AdblockToastPayload } from '../shared/ipc.js'
import { getSettings, normalizePinnedHostname } from './settings-store.js'

const DEBOUNCE_MS = 450

const SITE_FIX_HINT_THRESHOLD = 3

export type AdblockNotifyHandlers = {
  sendToast: (payload: AdblockToastPayload) => void
  getTabIdForWebContents: (wc: WebContents) => number | null
  getActiveTabId: () => number | null
}

let handlers: AdblockNotifyHandlers | null = null

type Pending = {
  count: number
  timer: ReturnType<typeof setTimeout> | null
  
  pageHostname: string
}
const pendingByTab = new Map<number, Pending>()

export function registerAdblockNotifyHandlers(next: AdblockNotifyHandlers): void {
  handlers = next
}

function visiblePageHostname(wc: WebContents): string {
  try {
    const u = wc.getURL()
    if (!u.startsWith('http')) return ''
    return normalizePinnedHostname(new URL(u).hostname)
  } catch {
    return ''
  }
}

function flushTab(tabId: number): void {
  const p = pendingByTab.get(tabId)
  if (!p) return
  p.timer = null
  const n = p.count
  const host = p.pageHostname
  p.count = 0
  if (n <= 0) return
  const h = handlers
  if (!h) return

  const activeId = h.getActiveTabId()
  const quiet = activeId != null && tabId !== activeId

  const { adBlockLevel, adBlockAllowlistHostnames } = getSettings()
  const allowSet = new Set(adBlockAllowlistHostnames)
  const onAllowlist = Boolean(host && allowSet.has(host))
  const suggestSiteFix =
    adBlockLevel !== 'off' &&
    !onAllowlist &&
    Boolean(host) &&
    n >= SITE_FIX_HINT_THRESHOLD &&
    !quiet

  const payload: AdblockToastPayload = {
    count: n,
    ...(quiet ? { quiet: true as const } : {}),
    ...(suggestSiteFix ? { suggestSiteFix: true as const, pageHostname: host } : {})
  }
  h.sendToast(payload)
}


export function clearAdblockNotifyForTab(tabId: number): void {
  const p = pendingByTab.get(tabId)
  if (p?.timer) clearTimeout(p.timer)
  pendingByTab.delete(tabId)
}


export function clearAllAdblockNotify(): void {
  for (const p of pendingByTab.values()) {
    if (p.timer) clearTimeout(p.timer)
  }
  pendingByTab.clear()
}


type RequestDetailsLike = {
  webContents?: WebContents
  webContentsId?: number
  frame?: WebFrameMain | null
}

export function noteAdblockNetworkAction(detailsOrWcId: RequestDetailsLike | number | undefined): void {
  const h = handlers
  if (!h) return

  let wc: WebContents | null = null
  if (typeof detailsOrWcId === 'number' || detailsOrWcId == null) {
    const id = detailsOrWcId
    if (id == null) return
    const w = webContents.fromId(id)
    if (w && !w.isDestroyed()) wc = w
  } else {
    const d = detailsOrWcId
    if (d.webContents && !d.webContents.isDestroyed()) wc = d.webContents
    else {
      const id = d.webContentsId
      if (id != null) {
        const w = webContents.fromId(id)
        if (w && !w.isDestroyed()) wc = w
      }
    }
    if (wc == null && d.frame && !d.frame.isDestroyed()) {
      try {
        const w = webContents.fromFrame(d.frame)
        if (w && !w.isDestroyed()) wc = w
      } catch {}
    }
  }

  if (!wc) return
  const tabId = h.getTabIdForWebContents(wc)
  if (tabId == null) return

  const ph = visiblePageHostname(wc)

  let p = pendingByTab.get(tabId)
  if (!p) {
    p = { count: 0, timer: null, pageHostname: ph }
    pendingByTab.set(tabId, p)
  }
  if (ph && !p.pageHostname) p.pageHostname = ph
  p.count += 1
  if (p.timer) clearTimeout(p.timer)
  p.timer = setTimeout(() => flushTab(tabId), DEBOUNCE_MS)
}
