import type { Session, OnBeforeRequestListenerDetails } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app, webContents } from 'electron'
import { ElectronBlocker, parseFilters } from '@cliqz/adblocker-electron'
import type { AdBlockLevel } from '../shared/ipc.js'
import { noteAdblockNetworkAction } from './adblock-notify.js'
import { getSettings, normalizePinnedHostname } from './settings-store.js'


const HIGH_FILTER_LISTS = [
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt',
  'https://secure.fanboy.co.nz/fanboy-annoyance.txt'
]


const SITE_COMPAT_FILTERS_RAW = `
@@||statsigapi.net^$third-party,domain=chatgpt.com|openai.com
@@||statsig.com^$third-party,domain=chatgpt.com|openai.com
chatgpt.com#@#+js(set-session-storage-item, oai/apps/noAuthHasDismissedSoftRateLimitModal, true)
chatgpt.com#@#+js(set-cookie, oai_consent_analytics, false)
chatgpt.com#@#+js(set-cookie, oai_consent_marketing, false)
@@||chatgpt.com^$elemhide
@@||openai.com^$elemhide
`.trim()

function applySiteCompatibilityFilters(blocker: ElectronBlocker): void {
  const { networkFilters, cosmeticFilters, notSupportedFilters } = parseFilters(SITE_COMPAT_FILTERS_RAW)
  if (notSupportedFilters.length > 0) {
    console.warn('[velo adblock] site-compat dropped filters', notSupportedFilters.length)
  }
  if (networkFilters.length === 0 && cosmeticFilters.length === 0) return
  blocker.update({ newNetworkFilters: networkFilters, newCosmeticFilters: cosmeticFilters })
}

let contentSessionRef: Session | null = null
let activeBlocker: ElectronBlocker | null = null

function diskCacheForLevel(level: Exclude<AdBlockLevel, 'off'>) {
  const path = join(app.getPath('userData'), 'data', `adblock-engine-${level}.bin`)
  return {
    path,
    read: async (p: string) => new Uint8Array(await readFile(p)),
    write: async (p: string, buffer: Uint8Array) => {
      await mkdir(dirname(p), { recursive: true })
      await writeFile(p, buffer)
    }
  }
}

function isAllowlistedAdblockRequest(details: OnBeforeRequestListenerDetails): boolean {
  const allow = getSettings().adBlockAllowlistHostnames
  if (allow.length === 0) return false
  const set = new Set(allow)
  try {
    const reqHost = normalizePinnedHostname(new URL(details.url).hostname)
    if (reqHost && set.has(reqHost)) return true
  } catch {}
  const wcId = details.webContentsId ?? details.webContents?.id
  if (wcId != null) {
    const wc = webContents.fromId(wcId)
    if (wc && !wc.isDestroyed()) {
      const tabUrl = wc.getURL()
      if (tabUrl.startsWith('http')) {
        try {
          const pageHost = normalizePinnedHostname(new URL(tabUrl).hostname)
          if (pageHost && set.has(pageHost)) return true
        } catch {}
      }
    }
  }
  return false
}

function wrapBlockerForAdblockToast(blocker: ElectronBlocker): void {
  const orig = blocker.onBeforeRequest.bind(blocker)
  blocker.onBeforeRequest = (details, callback) => {
    if (isAllowlistedAdblockRequest(details)) {
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
    let blocker: ElectronBlocker
    const cache = diskCacheForLevel(level)
    if (level === 'low') {
      blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetchImpl, cache)
    } else if (level === 'medium') {
      blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetchImpl, cache)
    } else {
      blocker = await ElectronBlocker.fromLists(fetchImpl, HIGH_FILTER_LISTS, undefined, cache)
    }
    wrapBlockerForAdblockToast(blocker)
    applySiteCompatibilityFilters(blocker)
    activeBlocker = blocker
    blocker.enableBlockingInSession(session)
  } catch (err) {
    console.error('[velo adblock] init failed', level, err)
  }
}
