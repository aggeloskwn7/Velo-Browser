import type { Session, OnBeforeRequestListenerDetails } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { adsAndTrackingLists, adsLists } from '@cliqz/adblocker'
import type { Config } from '@cliqz/adblocker'
import { app, webContents } from 'electron'
import { ElectronBlocker } from '@cliqz/adblocker-electron'
import { parse } from 'tldts-experimental'
import type { AdBlockLevel } from '../shared/ipc.js'
import { noteAdblockNetworkAction } from './adblock-notify.js'
import { getSettings, normalizePinnedHostname } from './settings-store.js'

/** Strictest set (live mirrors); same safety Config as medium (no filter CSP, first-party bypass). */
const HIGH_FILTER_LISTS = [
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt',
  'https://secure.fanboy.co.nz/fanboy-annoyance.txt'
]

/** EasyList only (Ghostery mirror) — cosmetics + element hiding, no network cancel on low. */
const LOW_FILTER_LISTS = [adsLists[0]]

let contentSessionRef: Session | null = null
let activeBlocker: ElectronBlocker | null = null

function diskCacheForLevel(level: Exclude<AdBlockLevel, 'off'>) {
  const path = join(app.getPath('userData'), 'data', `adblock-engine-v2-${level}.bin`)
  return {
    path,
    read: async (p: string) => new Uint8Array(await readFile(p)),
    write: async (p: string, buffer: Uint8Array) => {
      await mkdir(dirname(p), { recursive: true })
      await writeFile(p, buffer)
    }
  }
}

function urlForRegistrableParse(raw: string): string {
  if (raw.startsWith('wss://')) return `https://${raw.slice(6)}`
  if (raw.startsWith('ws://')) return `http://${raw.slice(5)}`
  return raw
}

function registrableDomainFromUrl(url: string): string | null {
  if (!url || !/^(https?|wss?):\/\//i.test(url)) return null
  try {
    const p = parse(urlForRegistrableParse(url))
    return p.domain || null
  } catch {
    return null
  }
}

function documentContextPageUrls(details: OnBeforeRequestListenerDetails): string[] {
  const out: string[] = []
  const ref = details.referrer
  if (typeof ref === 'string' && ref.length > 0 && /^https?:\/\//i.test(ref)) out.push(ref)

  const fr = details.frame
  if (fr && !fr.isDestroyed()) {
    const top = fr.top
    if (top && !top.isDestroyed()) {
      const u = top.url
      if (typeof u === 'string' && u.toLowerCase().startsWith('http')) out.push(u)
    } else {
      const u = fr.url
      if (typeof u === 'string' && u.toLowerCase().startsWith('http')) out.push(u)
    }
  }

  const wcId = details.webContentsId ?? details.webContents?.id
  if (wcId != null) {
    const wc = webContents.fromId(wcId)
    if (wc && !wc.isDestroyed()) {
      const u = wc.getURL()
      if (u.toLowerCase().startsWith('http')) out.push(u)
    }
  }
  return [...new Set(out)]
}

/**
 * Same registrable domain as the embedding document (subdomains/CDN under same eTLD+1).
 * When domain is unknown (e.g. bare host), fall back to hostname equality.
 */
function isFirstPartyToDocumentContext(details: OnBeforeRequestListenerDetails): boolean {
  let reqHost: string
  try {
    reqHost = normalizePinnedHostname(new URL(urlForRegistrableParse(details.url)).hostname)
    if (!reqHost) return false
  } catch {
    return false
  }
  const reqDom = registrableDomainFromUrl(details.url)

  for (const pageUrl of documentContextPageUrls(details)) {
    const docDom = registrableDomainFromUrl(pageUrl)
    if (docDom != null && reqDom != null && docDom === reqDom) return true
    try {
      const docHost = normalizePinnedHostname(new URL(pageUrl).hostname)
      if (docHost && docHost === reqHost) return true
    } catch {}
  }
  return false
}

function shouldBypassNetworkIntervention(details: OnBeforeRequestListenerDetails): boolean {
  if (details.resourceType === 'webSocket') return true
  return isFirstPartyToDocumentContext(details)
}

/** True if `host` equals an allowlisted host or is a subdomain of one. */
function hostnameMatchesAllowlist(host: string, allowRaw: readonly string[]): boolean {
  const h = normalizePinnedHostname(host)
  if (!h || allowRaw.length === 0) return false
  for (const raw of allowRaw) {
    const a = normalizePinnedHostname(String(raw))
    if (!a) continue
    if (h === a) return true
    if (h.endsWith(`.${a}`)) return true
  }
  return false
}

function pageUrlMatchesAllowlist(pageUrl: string): boolean {
  const allow = getSettings().adBlockAllowlistHostnames
  if (allow.length === 0 || !pageUrl.toLowerCase().startsWith('http')) return false
  try {
    const host = normalizePinnedHostname(new URL(pageUrl).hostname)
    return hostnameMatchesAllowlist(host, allow)
  } catch {
    return false
  }
}

function isAllowlistedAdblockRequest(details: OnBeforeRequestListenerDetails): boolean {
  const allow = getSettings().adBlockAllowlistHostnames
  if (allow.length === 0) return false
  try {
    const reqHost = normalizePinnedHostname(new URL(details.url).hostname)
    if (hostnameMatchesAllowlist(reqHost, allow)) return true
  } catch {}
  const ref = details.referrer
  if (typeof ref === 'string' && ref.length > 0 && ref.toLowerCase().startsWith('http')) {
    try {
      const refHost = normalizePinnedHostname(new URL(ref).hostname)
      if (hostnameMatchesAllowlist(refHost, allow)) return true
    } catch {}
  }
  const wcId = details.webContentsId ?? details.webContents?.id
  if (wcId != null) {
    const wc = webContents.fromId(wcId)
    if (wc && !wc.isDestroyed()) {
      const tabUrl = wc.getURL()
      if (tabUrl.toLowerCase().startsWith('http')) {
        try {
          const pageHost = normalizePinnedHostname(new URL(tabUrl).hostname)
          if (hostnameMatchesAllowlist(pageHost, allow)) return true
        } catch {}
      }
    }
  }
  const fr = details.frame
  if (fr && !fr.isDestroyed()) {
    const top = fr.top
    const documentUrl =
      top && !top.isDestroyed() && top.url.toLowerCase().startsWith('http') ? top.url : fr.url
    if (documentUrl.toLowerCase().startsWith('http')) {
      try {
        const docHost = normalizePinnedHostname(new URL(documentUrl).hostname)
        if (hostnameMatchesAllowlist(docHost, allow)) return true
      } catch {}
    }
  }
  return false
}

function wrapBlockerForAdblockToast(blocker: ElectronBlocker): void {
  const orig = blocker.onBeforeRequest.bind(blocker)
  blocker.onBeforeRequest = (details, callback) => {
    if (isAllowlistedAdblockRequest(details) || shouldBypassNetworkIntervention(details)) {
      callback({ cancel: false })
      return
    }
    orig(details, (response) => {
      const cancel = Boolean(response && 'cancel' in response && response.cancel === true)
      const redirect =
        Boolean(response && 'redirectURL' in response && (response as { redirectURL?: string }).redirectURL)
      if (cancel || redirect) {
        const wcId = details.webContentsId ?? details.webContents?.id
        noteAdblockNetworkAction(wcId)
      }
      callback(response)
    })
  }
}

function wrapBlockerForAllowlistedSites(blocker: ElectronBlocker): void {
  const cosmeticFirst = blocker.onGetCosmeticFiltersFirst.bind(blocker)
  blocker.onGetCosmeticFiltersFirst = (event, url) => {
    if (pageUrlMatchesAllowlist(url)) {
      event.returnValue = null
      return
    }
    cosmeticFirst(event, url)
  }

  const cosmeticUpdated = blocker.onGetCosmeticFiltersUpdated.bind(blocker)
  blocker.onGetCosmeticFiltersUpdated = (event, url, msg) => {
    if (pageUrlMatchesAllowlist(url)) {
      return
    }
    cosmeticUpdated(event, url, msg)
  }

  const headersRecv = blocker.onHeadersReceived.bind(blocker)
  blocker.onHeadersReceived = (details, callback) => {
    try {
      const u = details.url
      if (typeof u === 'string' && u.toLowerCase().startsWith('http') && pageUrlMatchesAllowlist(u)) {
        callback({})
        return
      }
    } catch {}
    headersRecv(details, callback)
  }
}

/** Explicit list URLs and FiltersEngine config per tier (filter-list CSP off everywhere). */
function engineOptionsForLevel(level: Exclude<AdBlockLevel, 'off'>): {
  lists: string[]
  config: Partial<Config>
} {
  const sharedNetwork: Partial<Config> = {
    loadNetworkFilters: true,
    loadCosmeticFilters: true,
    loadCSPFilters: false,
    guessRequestTypeFromUrl: true,
    loadExtendedSelectors: false
  }

  if (level === 'low') {
    return {
      lists: LOW_FILTER_LISTS,
      config: {
        loadNetworkFilters: false,
        loadCosmeticFilters: true,
        loadGenericCosmeticsFilters: false,
        loadCSPFilters: false,
        enableMutationObserver: false,
        loadExtendedSelectors: false
      }
    }
  }
  if (level === 'medium') {
    return {
      lists: [...adsAndTrackingLists],
      config: sharedNetwork
    }
  }
  return {
    lists: HIGH_FILTER_LISTS,
    config: sharedNetwork
  }
}

async function createBlockerForLevel(
  level: Exclude<AdBlockLevel, 'off'>,
  fetchImpl: typeof fetch,
  cache: ReturnType<typeof diskCacheForLevel>
): Promise<ElectronBlocker> {
  const { lists, config } = engineOptionsForLevel(level)
  return ElectronBlocker.fromLists(fetchImpl, lists, config, cache)
}

export function registerContentSessionForAdblock(session: Session): void {
  contentSessionRef = session
}

function disableIfNeeded(): void {
  const session = contentSessionRef
  if (!session || !activeBlocker) return
  if (activeBlocker.isBlockingEnabled(session)) {
    try {
      activeBlocker.disableBlockingInSession(session)
    } catch (e) {
      console.warn('[velo adblock] disable failed', e)
    }
  }
  activeBlocker = null
}

export async function applyAdBlockLevel(level: AdBlockLevel): Promise<void> {
  const session = contentSessionRef
  if (!session) {
    console.warn('[velo adblock] no content session registered')
    return
  }

  disableIfNeeded()

  if (level === 'off') return

  const fetchImpl = globalThis.fetch.bind(globalThis) as typeof globalThis.fetch

  try {
    const cache = diskCacheForLevel(level)
    const blocker = await createBlockerForLevel(level, fetchImpl, cache)
    wrapBlockerForAdblockToast(blocker)
    wrapBlockerForAllowlistedSites(blocker)
    activeBlocker = blocker
    blocker.enableBlockingInSession(session)
  } catch (err) {
    console.error('[velo adblock] init failed', level, err)
  }
}
