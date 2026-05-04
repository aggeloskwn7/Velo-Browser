import { webContents, type WebContents } from 'electron'
import type { AdblockToastPayload } from '../shared/ipc.js'
import { getSettings, normalizePinnedHostname } from './settings-store.js'

const DEBOUNCE_MS = 450

const SITE_FIX_HINT_THRESHOLD = 6

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
  if (h.getActiveTabId() !== tabId) return

  const { adBlockLevel, adBlockAllowlistHostnames } = getSettings()
  const allowSet = new Set(adBlockAllowlistHostnames)
  const onAllowlist = Boolean(host && allowSet.has(host))
  const suggestSiteFix =
    adBlockLevel !== 'off' && !onAllowlist && Boolean(host) && n >= SITE_FIX_HINT_THRESHOLD

  const payload: AdblockToastPayload = {
    count: n,
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


export function noteAdblockNetworkAction(webContentsId: number | undefined): void {
  if (webContentsId == null) return
  const h = handlers
  if (!h) return
  const wc = webContents.fromId(webContentsId)
  if (!wc || wc.isDestroyed()) return
  const tabId = h.getTabIdForWebContents(wc)
  if (tabId == null) return
  if (h.getActiveTabId() !== tabId) return

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
