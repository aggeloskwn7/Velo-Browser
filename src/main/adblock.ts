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

const ADBLOCK_DEBUG = process.env.VELO_ADBLOCK_DEBUG === '1'

let runtimeAdBlockLevel: AdBlockLevel = 'off'
let runtimeAllowlistHosts: readonly string[] = []

export function refreshAdblockRuntimeSettings(): void {
  const s = getSettings()
  runtimeAdBlockLevel = s.adBlockLevel
  runtimeAllowlistHosts = s.adBlockAllowlistHostnames
}

refreshAdblockRuntimeSettings()

const LOW_FILTER_LISTS: string[] = [...adsLists]

const MEDIUM_FILTER_LISTS: string[] = [...adsAndTrackingLists]

const HIGH_FILTER_LISTS = [
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt',
  'https://secure.fanboy.co.nz/fanboy-annoyance.txt'
]

const BUILTIN_COMPAT_REGISTRABLE_DOMAINS = new Set([
  'chatgpt.com',
  'openai.com',
  'twitter.com',
  'x.com',
  'google.com',
  'youtube.com',
  'github.com',
  'discord.com',
  'discordapp.com',
  'live.com',
  'microsoft.com'
])

const BUILTIN_COMPAT_EXTRA_HOSTS = new Set([
  'chat.openai.com',
  'accounts.google.com',
  'login.live.com'
])

const KNOWN_AD_TRACKER_HOST_SUFFIXES = [
  'doubleclick.net',
  'googlesyndication.com',
  'google-analytics.com',
  'googleadservices.com',
  'googletagmanager.com',
  '2mdn.net',
  'scorecardresearch.com',
  'taboola.com',
  'outbrain.com',
  'adsystem.com',
  'amazon-adsystem.com',
  'criteo.com',
  'advertising.com',
  'moatads.com',
  'pubmatic.com',
  'rubiconproject.com',
  '3lift.com',
  'adsafeprotected.com',
  'chartbeat.com',
  'hotjar.com'
]

let contentSessionRef: Session | null = null
let activeBlocker: ElectronBlocker | null = null

function dbg(...args: unknown[]): void {
  if (ADBLOCK_DEBUG) console.log('[velo adblock]', ...args)
}

export function getHostname(url: string): string {
  try {
    return normalizePinnedHostname(new URL(urlForHttps(url)).hostname)
  } catch {
    return ''
  }
}

export function getRegistrableDomain(url: string): string | null {
  if (!url?.trim() || !/^(https?|wss?):\/\//i.test(url)) return null
  try {
    const p = parse(urlForHttps(url))
    return p.domain || null
  } catch {
    return null
  }
}

function urlForHttps(raw: string): string {
  if (raw.startsWith('wss://')) return `https://${raw.slice(6)}`
  if (raw.startsWith('ws://')) return `http://${raw.slice(5)}`
  return raw
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

export function isFirstPartyToDocumentContext(details: OnBeforeRequestListenerDetails): boolean {
  const reqHost = getHostname(details.url)
  if (!reqHost) return false
  const reqDom = getRegistrableDomain(details.url)

  for (const pageUrl of documentContextPageUrls(details)) {
    const docDom = getRegistrableDomain(pageUrl)
    if (docDom != null && reqDom != null && docDom === reqDom) return true
    try {
      const docHost = getHostname(pageUrl)
      if (docHost && docHost === reqHost) return true
    } catch {}
  }
  return false
}

export function isMajorCompatibilitySite(details: OnBeforeRequestListenerDetails): boolean {
  for (const pageUrl of documentContextPageUrls(details)) {
    const host = getHostname(pageUrl)
    if (!host) continue
    if (BUILTIN_COMPAT_EXTRA_HOSTS.has(host)) return true
    const dom = getRegistrableDomain(pageUrl)
    if (dom && BUILTIN_COMPAT_REGISTRABLE_DOMAINS.has(dom)) return true
  }
  return false
}

export function isSafeResourceTypeToCancel(
  rt: OnBeforeRequestListenerDetails['resourceType']
): boolean {
  return rt === 'image' || rt === 'subFrame' || rt === 'media' || rt === 'font'
}

export function isRiskyResourceType(
  rt: OnBeforeRequestListenerDetails['resourceType']
): boolean {
  return rt === 'script' || rt === 'xhr' || rt === 'stylesheet' || rt === 'other'
}

function hostnameMatchesKnownSuffix(host: string): boolean {
  const h = normalizePinnedHostname(host)
  if (!h) return false
  if (h.startsWith('adservice.google.') || h.includes('.adservice.google.')) return true
  for (const suf of KNOWN_AD_TRACKER_HOST_SUFFIXES) {
    if (h === suf || h.endsWith(`.${suf}`)) return true
  }
  if (h === 'connect.facebook.net' || h.endsWith('.facebook.net')) return true
  return false
}

export function isKnownAdOrTrackerHost(url: string): boolean {
  try {
    const host = getHostname(url)
    return hostnameMatchesKnownSuffix(host)
  } catch {
    return false
  }
}

function userAllowlistHosts(): readonly string[] {
  return runtimeAllowlistHosts
}

function hostnameMatchesUserAllowlist(host: string, allow: readonly string[]): boolean {
  return hostnameMatchesAllowlist(host, allow)
}

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

function pageUrlMatchesUserAllowlist(pageUrl: string): boolean {
  const allow = userAllowlistHosts()
  if (allow.length === 0 || !pageUrl.toLowerCase().startsWith('http')) return false
  try {
    const host = getHostname(pageUrl)
    return hostnameMatchesUserAllowlist(host, allow)
  } catch {
    return false
  }
}

export function pageUsesCompatOrAllowlist(details: OnBeforeRequestListenerDetails): boolean {
  if (isMajorCompatibilitySite(details)) return true
  for (const u of documentContextPageUrls(details)) {
    if (pageUrlMatchesUserAllowlist(u)) return true
  }
  return false
}

function requestTargetInUserAllowlist(details: OnBeforeRequestListenerDetails): boolean {
  const allow = userAllowlistHosts()
  if (allow.length === 0) return false
  try {
    return hostnameMatchesUserAllowlist(getHostname(details.url), allow)
  } catch {
    return false
  }
}

function pageUrlMatchesAllowlistForCosmetics(pageUrl: string): boolean {
  return pageUrlMatchesUserAllowlist(pageUrl)
}

export function canCancelNetworkRequest(
  details: OnBeforeRequestListenerDetails,
  level: Exclude<AdBlockLevel, 'off'>
): boolean {
  const rt = details.resourceType

  if (rt === 'mainFrame') return false
  if (rt === 'webSocket') return false
  if (requestTargetInUserAllowlist(details)) return false

  const firstParty = isFirstPartyToDocumentContext(details)
  const pageCompat = pageUsesCompatOrAllowlist(details)

  if (firstParty) {
    if (isRiskyResourceType(rt)) return false
    if (isSafeResourceTypeToCancel(rt)) return true
    if (rt === 'object' || rt === 'ping' || rt === 'cspReport') return true
    return false
  }

  if (isSafeResourceTypeToCancel(rt) || rt === 'object' || rt === 'ping' || rt === 'cspReport') {
    return true
  }

  if (!isRiskyResourceType(rt)) return false

  if (level === 'low') return false

  if (pageCompat) return false

  const known = isKnownAdOrTrackerHost(details.url)
  if (level === 'medium') return known

  return true
}

function diskCacheForLevel(level: Exclude<AdBlockLevel, 'off'>) {
  const path = join(app.getPath('userData'), 'data', `adblock-engine-v4-${level}.bin`)
  return {
    path,
    read: async (p: string) => new Uint8Array(await readFile(p)),
    write: async (p: string, buffer: Uint8Array) => {
      await mkdir(dirname(p), { recursive: true })
      await writeFile(p, buffer)
    }
  }
}

function wrapBlockerForNetworkGateAndToast(
  blocker: ElectronBlocker,
  getLevel: () => AdBlockLevel
): void {
  const orig = blocker.onBeforeRequest.bind(blocker)
  blocker.onBeforeRequest = (details, callback) => {
    const level = getLevel()
    if (level === 'off') {
      callback({ cancel: false })
      return
    }

    if (details.resourceType === 'mainFrame') {
      callback({})
      return
    }

    if (details.resourceType === 'webSocket') {
      callback({ cancel: false })
      return
    }

    orig(details, (response) => {
      const redirect =
        response &&
        'redirectURL' in response &&
        Boolean((response as { redirectURL?: string }).redirectURL)
      const cancel = Boolean(response && 'cancel' in response && response.cancel === true)

      if (!cancel && !redirect) {
        callback(response)
        return
      }

      const effLevel = level as Exclude<AdBlockLevel, 'off'>
      const allow = canCancelNetworkRequest(details, effLevel)

      if (!allow) {
        dbg('allow-compat', details.url, details.resourceType, {
          firstParty: isFirstPartyToDocumentContext(details),
          compatPage: pageUsesCompatOrAllowlist(details),
          level
        })
        callback({ cancel: false })
        return
      }

      if (redirect) {
        dbg('deny-redirect-stripped', details.url, details.resourceType, level)
        callback({ cancel: false })
        return
      }

      dbg('deny-cancel', details.url, details.resourceType, level)
      noteAdblockNetworkAction(details)
      callback(response)
    })
  }
}

function wrapBlockerForAllowlistedSites(blocker: ElectronBlocker): void {
  const cosmeticFirst = blocker.onGetCosmeticFiltersFirst.bind(blocker)
  blocker.onGetCosmeticFiltersFirst = (event, url) => {
    if (pageUrlMatchesAllowlistForCosmetics(url)) {
      event.returnValue = null
      return
    }
    cosmeticFirst(event, url)
    event.returnValue = null
  }

  const cosmeticUpdated = blocker.onGetCosmeticFiltersUpdated.bind(blocker)
  blocker.onGetCosmeticFiltersUpdated = (event, url, msg) => {
    if (pageUrlMatchesAllowlistForCosmetics(url)) {
      return
    }
    cosmeticUpdated(event, url, msg)
  }

  const headersRecv = blocker.onHeadersReceived.bind(blocker)
  blocker.onHeadersReceived = (details, callback) => {
    try {
      const u = details.url
      if (typeof u === 'string' && u.toLowerCase().startsWith('http') && pageUrlMatchesAllowlistForCosmetics(u)) {
        callback({})
        return
      }
    } catch {}
    headersRecv(details, callback)
  }
}

const sharedEngineConfig: Partial<Config> = {
  loadNetworkFilters: true,
  loadCosmeticFilters: true,
  loadCSPFilters: false,
  guessRequestTypeFromUrl: true,
  loadExtendedSelectors: false,
  loadGenericCosmeticsFilters: true,
  enableMutationObserver: true
}

const lowEngineConfig: Partial<Config> = {
  ...sharedEngineConfig,
  loadGenericCosmeticsFilters: false,
  enableMutationObserver: false
}

function engineOptionsForLevel(level: Exclude<AdBlockLevel, 'off'>): {
  lists: string[]
  config: Partial<Config>
} {
  if (level === 'low') {
    return { lists: LOW_FILTER_LISTS, config: lowEngineConfig }
  }
  if (level === 'medium') {
    return { lists: MEDIUM_FILTER_LISTS, config: { ...sharedEngineConfig, loadGenericCosmeticsFilters: false } }
  }
  return { lists: HIGH_FILTER_LISTS, config: sharedEngineConfig }
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

  if (level === 'off') {
    refreshAdblockRuntimeSettings()
    return
  }

  const fetchImpl = globalThis.fetch.bind(globalThis) as typeof globalThis.fetch

  try {
    const cache = diskCacheForLevel(level as Exclude<AdBlockLevel, 'off'>)
    const blocker = await createBlockerForLevel(level as Exclude<AdBlockLevel, 'off'>, fetchImpl, cache)
    wrapBlockerForNetworkGateAndToast(blocker, () => runtimeAdBlockLevel)
    wrapBlockerForAllowlistedSites(blocker)
    activeBlocker = blocker
    blocker.enableBlockingInSession(session)
    refreshAdblockRuntimeSettings()
  } catch (err) {
    console.error('[velo adblock] init failed', level, err)
  }
}
