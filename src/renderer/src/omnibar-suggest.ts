import type { HistoryEntry, SearchEngine } from '@shared/ipc'
import { httpsUrlIfBareHostname, normalizeVeloNavigationInput } from '@shared/velo-url'

export type OmnibarSuggestionRow = {
  key: string
  source: 'history' | 'search' | 'navigate'
  
  suggestBadge?: string
  primary: string
  
  secondary?: string
  
  fillDisplay: string
  
  submitInput: string
}

type AggregatedHistory = {
  url: string
  title: string
  lastVisit: number
  count: number
}

function isSuggestibleHistoryUrl(url: string): boolean {
  const t = url.trim()
  if (!t) return false
  if (t.startsWith('velo:') || t.startsWith('data:') || t.startsWith('about:')) return false
  return true
}

export function aggregateHistory(entries: HistoryEntry[]): AggregatedHistory[] {
  const map = new Map<string, AggregatedHistory>()
  for (const e of entries) {
    if (!isSuggestibleHistoryUrl(e.url)) continue
    const prev = map.get(e.url)
    if (!prev) {
      map.set(e.url, {
        url: e.url,
        title: e.title || e.url,
        lastVisit: e.visitedAt,
        count: 1
      })
    } else {
      prev.count++
      if (e.visitedAt >= prev.lastVisit) {
        prev.lastVisit = e.visitedAt
        prev.title = e.title || prev.title
      }
    }
  }
  return [...map.values()]
}

export function extractSearchQueryFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    const q = u.searchParams.get('q') ?? u.searchParams.get('query') ?? u.searchParams.get('p')
    if (q == null || q === '') return null
    const searchHosts =
      host.includes('google.') ||
      host.includes('bing.com') ||
      host === 'duckduckgo.com' ||
      host.includes('search.brave.com') ||
      host.includes('ecosia.org')
    if (!searchHosts) return null
    try {
      return decodeURIComponent(q.replace(/\+/g, ' '))
    } catch {
      return q.replace(/\+/g, ' ')
    }
  } catch {
    return null
  }
}

function prettyUrlForOmnibar(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return (u.host + u.pathname + u.search + u.hash).replace(/\/$/, '') || u.host
    }
  } catch {}
  return url
}

function scoreHistoryMatch(q: string, a: AggregatedHistory): number {
  const ql = q.trim().toLowerCase()
  if (!ql) return 0

  let host = ''
  try {
    host = new URL(a.url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    const title = (a.title || '').toLowerCase()
    return title.includes(ql) ? 35 : 0
  }

  const firstSeg = host.split('.')[0] || ''
  const title = (a.title || '').toLowerCase()
  const terms = (extractSearchQueryFromUrl(a.url) || '').toLowerCase()
  const urlLow = a.url.toLowerCase()

  let base = 0
  if (firstSeg.startsWith(ql)) base = Math.max(base, 130)
  if (host.startsWith(ql)) base = Math.max(base, 115)
  if (host.includes(ql)) base = Math.max(base, 72)
  if (terms.startsWith(ql)) base = Math.max(base, 102)
  if (terms.includes(ql)) base = Math.max(base, 78)
  if (title.startsWith(ql)) base = Math.max(base, 96)
  if (title.includes(ql)) base = Math.max(base, 58)
  if (urlLow.includes(ql)) base = Math.max(base, 42)

  if (base === 0) return 0

  const hours = (Date.now() - a.lastVisit) / 3600000
  const recency = Math.exp(-hours / 240)
  const freqBoost = 1 + 0.14 * Math.sqrt(a.count)
  return base * (0.42 + 0.58 * recency) * freqBoost
}

export function buildHistorySuggestions(
  entries: HistoryEntry[],
  query: string,
  limit: number
): OmnibarSuggestionRow[] {
  const q = query.trim()
  if (!q) return []
  const aggs = aggregateHistory(entries)
  const rows = aggs
    .map((a) => ({ a, s: scoreHistoryMatch(q, a) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => {
      if (y.s !== x.s) return y.s - x.s
      return y.a.lastVisit - x.a.lastVisit
    })
    .slice(0, limit)
    .map(({ a }, i) => {
      const hostPretty = (() => {
        try {
          return new URL(a.url).hostname.replace(/^www\./i, '')
        } catch {
          return a.url
        }
      })()
      const searched = extractSearchQueryFromUrl(a.url)
      const primary = (searched || hostPretty || a.title).slice(0, 120)
      const secondary = (() => {
        if (searched) return hostPretty
        if (a.title && a.title !== primary) return a.title.slice(0, 80)
        return prettyUrlForOmnibar(a.url).slice(0, 64)
      })()
      return {
        key: `h-${i}-${a.url.slice(0, 48)}`,
        source: 'history' as const,
        primary,
        secondary: secondary && secondary !== primary ? secondary : undefined,
        fillDisplay: searched
          ? searched
          : prettyUrlForOmnibar(a.url).replace(/^https?:\/\//i, ''),
        submitInput: a.url
      }
    })

  return rows
}

function normDedupe(s: string): string {
  return s.trim().toLowerCase()
}

function dedupePreserveOrder(phrases: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of phrases) {
    const n = normDedupe(p)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(p.trim())
  }
  return out
}


export function prioritizeSearchCompletions(raw: string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  const list = dedupePreserveOrder(raw)
  if (!q) return list
  const idx = list.findIndex((p) => p.trim().toLowerCase() !== q)
  if (idx <= 0) return list
  const next = [...list]
  const [picked] = next.splice(idx, 1)
  next.unshift(picked)
  return next
}

export function searchEngineLabel(engine: SearchEngine): string {
  switch (engine) {
    case 'google':
      return 'Google'
    case 'bing':
      return 'Bing'
    case 'duckduckgo':
      return 'DuckDuckGo'
    case 'brave':
      return 'Brave'
    case 'ecosia':
      return 'Ecosia'
    default:
      return 'Google'
  }
}


export async function fetchGoogleSuggestions(query: string, signal: AbortSignal): Promise<string[]> {
  const q = query.trim()
  if (!q) return []
  const u =
    'https://suggestqueries.google.com/complete/search?client=chrome&hl=en&gl=us&q=' +
    encodeURIComponent(q)
  const res = await fetch(u, {
    signal,
    credentials: 'omit',
    cache: 'no-store',
    headers: { Accept: '*/*' }
  })
  if (!res.ok) return []
  const text = await res.text()
  const cleaned = text.replace(/^\)\]\}'\n?/, '').trim()
  let data: unknown
  try {
    data = JSON.parse(cleaned)
  } catch {
    return []
  }
  if (!Array.isArray(data) || data.length < 2) return []
  const second = data[1]
  if (!Array.isArray(second)) return []
  const out: string[] = []
  for (const item of second) {
    if (typeof item === 'string') {
      if (item.trim()) out.push(item.trim())
    } else if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
      const s = item[0].trim()
      if (s) out.push(s)
    }
  }
  return dedupePreserveOrder(out)
}


export async function fetchBingSuggestions(query: string, signal: AbortSignal): Promise<string[]> {
  const q = query.trim()
  if (!q) return []
  const u = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`
  const res = await fetch(u, {
    signal,
    credentials: 'omit',
    cache: 'no-store',
    headers: { Accept: '*/*' }
  })
  if (!res.ok) return []
  const data: unknown = await res.json()
  if (!Array.isArray(data) || data.length < 2) return []
  const second = data[1]
  if (!Array.isArray(second)) return []
  const out: string[] = []
  for (const item of second) {
    if (typeof item === 'string' && item.trim()) out.push(item.trim())
  }
  return dedupePreserveOrder(out)
}


export async function fetchDuckDuckGoSuggestions(query: string, signal: AbortSignal): Promise<string[]> {
  const q = query.trim()
  if (q.length < 1) return []
  const u = `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`
  const res = await fetch(u, { signal, credentials: 'omit' })
  if (!res.ok) return []
  const data: unknown = await res.json()
  if (!Array.isArray(data)) return []
  const out: string[] = []
  for (const item of data) {
    if (typeof item === 'string') {
      if (item.trim()) out.push(item.trim())
      continue
    }
    if (item && typeof item === 'object' && 'phrase' in item) {
      const p = (item as { phrase?: unknown }).phrase
      if (typeof p === 'string' && p.trim()) out.push(p.trim())
    }
  }
  return dedupePreserveOrder(out)
}

export async function fetchWebSearchCompletions(
  query: string,
  engine: SearchEngine,
  signal: AbortSignal
): Promise<string[]> {
  const q = query.trim()
  if (!q) return []

  const ddg = (): Promise<string[]> => fetchDuckDuckGoSuggestions(q, signal)
  const google = (): Promise<string[]> => fetchGoogleSuggestions(q, signal)
  const bing = (): Promise<string[]> => fetchBingSuggestions(q, signal)

  if (engine === 'google') {
    const g = await google().catch(() => [] as string[])
    if (g.length) return prioritizeSearchCompletions(g, q)
    const d = await ddg().catch(() => [] as string[])
    return prioritizeSearchCompletions(d, q)
  }

  if (engine === 'bing') {
    const b = await bing().catch(() => [] as string[])
    if (b.length) return prioritizeSearchCompletions(b, q)
    const g = await google().catch(() => [] as string[])
    if (g.length) return prioritizeSearchCompletions(g, q)
    const d = await ddg().catch(() => [] as string[])
    return prioritizeSearchCompletions(d, q)
  }

  const d = await ddg().catch(() => [] as string[])
  if (d.length) return prioritizeSearchCompletions(d, q)
  const g = await google().catch(() => [] as string[])
  if (g.length) return prioritizeSearchCompletions(g, q)
  const b = await bing().catch(() => [] as string[])
  return prioritizeSearchCompletions(b, q)
}

export function buildDirectNavigateSuggestion(query: string): OmnibarSuggestionRow | null {
  const q = query.trim()
  if (!q || normalizeVeloNavigationInput(q)) return null
  const url = httpsUrlIfBareHostname(q)
  if (!url) return null
  const fillDisplay = prettyUrlForOmnibar(url).replace(/^https?:\/\//i, '')
  return {
    key: `nav-${normDedupe(fillDisplay).slice(0, 72)}`,
    source: 'navigate',
    primary: fillDisplay,
    fillDisplay,
    submitInput: url
  }
}

export function mergeSearchSuggestions(
  query: string,
  historyRows: OmnibarSuggestionRow[],
  remotePhrases: string[],
  maxRemote: number,
  engineLabel: string
): OmnibarSuggestionRow[] {
  const q = query.trim()
  const qn = normDedupe(q)
  const veloUrl = normalizeVeloNavigationInput(query)
  const merged: OmnibarSuggestionRow[] = []
  if (veloUrl) {
    const normVelo = normDedupe(veloUrl)
    const histHasVelo = historyRows.some((r) => normDedupe(r.submitInput) === normVelo)
    if (!histHasVelo) {
      merged.push({
        key: `velo-${normVelo.slice(0, 64)}`,
        source: 'search',
        suggestBadge: 'Velo',
        primary: veloUrl,
        secondary: 'Open in Velo',
        fillDisplay: veloUrl,
        submitInput: veloUrl
      })
    }
  }

  const directRow = !veloUrl ? buildDirectNavigateSuggestion(query) : null
  const hostCompleteReorder = !!directRow

  const histNorm = new Set(historyRows.map((r) => normDedupe(r.fillDisplay)))
  const histSubmit = new Set(historyRows.map((r) => normDedupe(r.submitInput)))
  if (veloUrl) {
    const nv = normDedupe(veloUrl)
    histNorm.add(nv)
    histSubmit.add(nv)
  }

  const pushRemote = (): void => {
    let n = 0
    let engineLineUsed = false
    for (const phrase of remotePhrases) {
      if (n >= maxRemote) break
      const pn = normDedupe(phrase)
      if (!pn || histSubmit.has(pn)) continue
      const blockedByHistoryDisplay =
        histNorm.has(pn) && !(hostCompleteReorder && pn === qn)
      if (blockedByHistoryDisplay) continue
      histNorm.add(pn)
      const showEngine = !engineLineUsed
      if (showEngine) engineLineUsed = true
      merged.push({
        key: `s-${n}-${pn.slice(0, 24)}`,
        source: 'search',
        primary: phrase,
        secondary: showEngine ? `${engineLabel} Search` : undefined,
        fillDisplay: phrase,
        submitInput: phrase
      })
      n++
    }
  }

  if (hostCompleteReorder) {
    merged.push(directRow!)
    pushRemote()
    merged.push(...historyRows)
  } else {
    merged.push(...historyRows)
    pushRemote()
  }
  return merged
}
