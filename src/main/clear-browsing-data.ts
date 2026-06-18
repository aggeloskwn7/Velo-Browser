import { session } from 'electron'
import type { ClearBrowsingDataPayload, ClearBrowsingDataResult, ClearBrowsingDataTimeRange } from '../shared/ipc.js'
import * as history from './history-store.js'
import * as downloads from './downloads-store.js'
import * as passwordVault from './password-vault.js'
import * as TabManager from './tab-manager.js'

export function cutoffMsFromTimeRange(range: ClearBrowsingDataTimeRange): number | null {
  if (range === 'all') return null
  const now = Date.now()
  switch (range) {
    case 'hour':
      return now - 60 * 60 * 1000
    case 'day':
      return now - 24 * 60 * 60 * 1000
    case 'week':
      return now - 7 * 24 * 60 * 60 * 1000
    case 'month':
      return now - 30 * 24 * 60 * 60 * 1000
    default:
      return null
  }
}

function contentSession() {
  return session.fromPartition('persist:velo')
}

async function clearCookies(cutoffMs: number | null): Promise<void> {
  const ses = contentSession()
  if (cutoffMs == null) {
    await ses.clearStorageData({ storages: ['cookies'] })
    return
  }
  const cutoffSec = cutoffMs / 1000
  const cookies = await ses.cookies.get({})
  await Promise.all(
    cookies.map(async (c) => {
      const created = c.creationDate ?? 0
      const accessed = c.lastAccessDate ?? created
      const ts = Math.max(created, accessed)
      if (ts < cutoffSec) return
      const proto = c.secure ? 'https' : 'http'
      const host = (c.domain ?? '').replace(/^\./, '')
      if (!host) return
      const path = c.path ?? '/'
      const url = `${proto}://${host}${path}`
      try {
        await ses.cookies.remove(url, c.name)
      } catch {}
    })
  )
  await ses.cookies.flushStore()
}

async function clearCacheFull(): Promise<void> {
  const ses = contentSession()
  await ses.clearCache()
  await ses.clearStorageData({
    storages: ['cachestorage', 'shadercache']
  })
}

export async function executeClearBrowsingData(
  payload: ClearBrowsingDataPayload
): Promise<ClearBrowsingDataResult> {
  const cutoff = cutoffMsFromTimeRange(payload.timeRange)
  const result: ClearBrowsingDataResult = {
    cleared: {
      history: 0,
      cookies: false,
      cache: false,
      passwords: 0,
      downloads: 0
    }
  }

  if (payload.history) {
    result.cleared.history = await history.removeHistoryInRange(cutoff)
  }
  if (payload.cookies) {
    await clearCookies(cutoff)
    result.cleared.cookies = true
  }
  if (payload.cache) {
    await clearCacheFull()
    result.cleared.cache = true
  }
  if (payload.passwords) {
    result.cleared.passwords = passwordVault.deleteEntriesInRange(cutoff)
  }
  if (payload.downloads) {
    result.cleared.downloads = downloads.clearDownloadsInRange(cutoff, true)
  }

  if (payload.cookies || payload.cache) {
    TabManager.manager?.reloadWebTabs()
  }

  return result
}
