import type { BookmarkEntry, HistoryEntry, SearchEngine, TabSnapshot } from '@shared/ipc'
import { httpsUrlIfBareHostname, normalizeVeloNavigationInput } from '@shared/velo-url'

export const OMNIBAR_MAX_SUGGESTIONS = 10
export const OMNIBAR_MAX_REMOTE_PHRASES = 5
/** Inline ghost completions need at least this score from {@link buildOmnibarSuggestions} rows */
export const OMNIBAR_INLINE_MIN_SCORE = 72

export type OmnibarSuggestionIcon = 'search' | 'globe' | 'history' | 'bookmark' | 'tab' | 'velo'

export type OmnibarSuggestionRow = {
  key: string
  type: 'search' | 'url' | 'history' | 'bookmark' | 'tab' | 'internal'
  icon: OmnibarSuggestionIcon
  primary: string
  secondary?: string
  fillDisplay: string
  submitInput: string
  score: number
  tabId?: number
}

export type OmnibarBuildInput = {
  query: string
  history: HistoryEntry[]
  bookmarks: Array<Pick<BookmarkEntry, 'url' | 'title'>>
  openTabs: Array<Pick<TabSnapshot, 'id' | 'url' | 'title'>>
  remoteSuggestions: string[]
  searchEngine: SearchEngine
  activeTabId?: number | null
}

type AggregatedHistory = {
  url: string
  title: string
  lastVisit: number
  count: number
}

const VELO_PAGE_HREFS = [
  'velo://newtab',
  'velo://history',
  'velo://bookmarks',
  'velo://downloads',
  'velo://settings',
  'velo://settings/appearance',
  'velo://settings/languages',
  'velo://settings/download-preferences',
  'velo://settings/privacy',
  'velo://settings/password-manager',
  'velo://settings/new-tab-page',
  'velo://settings/accessibility',
  'velo://settings/performance',
  'velo://settings/system',
  'velo://settings/default-browser',
  'velo://settings/import'
]

function isSuggestibleHttpUrl(url: string): boolean {
  const t = url.trim()
  if (!t) return false
  if (t.startsWith('velo:') || t.startsWith('data:') || t.startsWith('about:')) return false
  try {
    const u = new URL(t)
    if (u.protocol === 'http:' || u.protocol === 'https:') return true
  } catch {
    return false
  }
  return false
}

export function aggregateHistory(entries: HistoryEntry[]): AggregatedHistory[] {
  const map = new Map<string, AggregatedHistory>()
  for (const e of entries) {
    if (!isSuggestibleHttpUrl(e.url)) continue
    const prev = map.get(e.url)
    if (!prev) {
      map.set(e.url, {
        url: e.url,
        title:
          e.title ||
          ((): string => {
            try {
              return new URL(e.url).hostname
            } catch {
              return e.url
            }
          })(),
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

export function prettyUrlForOmnibar(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return (u.host + u.pathname + u.search + u.hash).replace(/\/$/, '') || u.host
    }
  } catch {}
  return url
}

function normDedupe(s: string): string {
  return s.trim().toLowerCase()
}

export function dedupePreserveOrder(phrases: string[]): string[] {
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

function hostPretty(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

function textMatchScore(
  ql: string,
  host: string,
  firstSeg: string,
  title: string,
  urlLow: string,
  prevSearch: string | null
): number {
  let s = 0
  const ht = host.toLowerCase()
  const fs = firstSeg.toLowerCase()
  const tt = title.toLowerCase()
  const ps = (prevSearch || '').toLowerCase()

  if (ht.startsWith(ql)) s = Math.max(s, 200)
  if (fs.startsWith(ql)) s = Math.max(s, 180)
  if (tt.startsWith(ql)) s = Math.max(s, 130)
  if (ps.startsWith(ql)) s = Math.max(s, 120)
  if (ht.includes(ql)) s = Math.max(s, 90)
  if (tt.includes(ql)) s = Math.max(s, 70)
  if (urlLow.includes(ql)) s = Math.max(s, 50)
  if (ps && ps.includes(ql) && !ps.startsWith(ql)) s = Math.max(s, 78)

  return s
}

function sourceBoost(kind: 'tab' | 'bookmark' | 'history'): number {
  if (kind === 'tab') return 170
  if (kind === 'bookmark') return 160
  return 0
}

function applyRecencyAndFrequency(base: number, lastVisit: number | undefined, count: number | undefined): number {
  if (!lastVisit) return base
  const hours = (Date.now() - lastVisit) / 3600000
  const recency = Math.exp(-hours / 240)
  const c = count ?? 1
  const freqBoost = 1 + 0.14 * Math.sqrt(c)
  return base * (0.42 + 0.58 * recency) * freqBoost
}

export function registrableHost(hostname: string): string {
  const host = hostname.replace(/^www\./i, '').toLowerCase()
  const p = host.split('.').filter(Boolean)
  if (p.length <= 2) return p.join('.')
  const last2 = p.slice(-2).join('.')
  const last3 = p.slice(-3).join('.')
  const multiSuffix = new Set([
    'co.uk',
    'com.au',
    'co.jp',
    'co.nz',
    'com.br',
    'co.in',
    'com.cn',
    'github.io',
    'gitlab.io',
    'appspot.com',
    'cloudfront.net'
  ])
  if (multiSuffix.has(last2)) return last3
  return last2
}

function registrableHostFromUrl(url: string): string {
  try {
    return registrableHost(new URL(url).hostname)
  } catch {
    return ''
  }
}

function historyPathNoiseMultiplier(url: string, ql: string): number {
  try {
    const u = new URL(url)
    const segments = u.pathname.split('/').filter(Boolean)
    const depth = segments.length
    let f = 1
    if (depth > 3) f *= 0.72
    if (depth > 5) f *= 0.85
    if (depth > 7) f *= 0.88
    const pathLow = `${u.pathname}${u.search}`.toLowerCase()
    const noisyPattern =
      /\/(actions|runs|jobs|workflow|workflows|pipelines|pipeline|builds|artifacts|commit)\b|\/r\/\d+|pull\/\d+\/checks|\/compare\//.test(
        pathLow
      ) || /\/\d{5,}\b/.test(pathLow)
    const qHasNoise =
      /\b(actions?|runs?|jobs?|workflow|pipelines?|builds?|artifacts?|checks?)\b/i.test(ql) ||
      /\d{4,}/.test(ql) ||
      ql.includes('/')
    if (noisyPattern && !qHasNoise) f *= 0.52
    return f
  } catch {
    return 1
  }
}

function historyPerDomainCap(query: string): number {
  const q = query.trim()
  if (q.length >= 6 || q.includes('/')) return 3
  return 2
}

function scoreTabBookmark(
  ql: string,
  kind: 'tab' | 'bookmark',
  url: string,
  title: string,
  lastVisit?: number,
  count?: number
): number {
  let host = ''
  let firstSeg = ''
  try {
    const u = new URL(url)
    host = u.hostname.replace(/^www\./i, '').toLowerCase()
    firstSeg = host.split('.')[0] || ''
  } catch {
    const tt = (title || '').toLowerCase()
    if (!tt.includes(ql)) return 0
    return applyRecencyAndFrequency(70 + sourceBoost(kind), lastVisit, count)
  }
  const prev = extractSearchQueryFromUrl(url)
  const t0 = textMatchScore(ql, host, firstSeg, (title || '').toLowerCase(), url.toLowerCase(), prev)
  if (t0 === 0) return 0
  return applyRecencyAndFrequency(t0 + sourceBoost(kind), lastVisit, count)
}

function scoreHistoryAgg(ql: string, a: AggregatedHistory): number {
  let host = ''
  let firstSeg = ''
  try {
    const u = new URL(a.url)
    host = u.hostname.replace(/^www\./i, '').toLowerCase()
    firstSeg = host.split('.')[0] || ''
  } catch {
    const title = (a.title || '').toLowerCase()
    if (!title.includes(ql)) return 0
    return applyRecencyAndFrequency(70, a.lastVisit, a.count)
  }
  const prev = extractSearchQueryFromUrl(a.url)
  const t0 = textMatchScore(ql, host, firstSeg, (a.title || '').toLowerCase(), a.url.toLowerCase(), prev)
  if (t0 === 0) return 0
  const pathMul = historyPathNoiseMultiplier(a.url, ql)
  return applyRecencyAndFrequency(t0 + sourceBoost('history'), a.lastVisit, a.count) * pathMul
}

export function buildVeloInternalRows(query: string): OmnibarSuggestionRow[] {
  const compact = query.trim().replace(/\s+/g, '')
  if (!compact || !/^velo:/i.test(compact)) return []
  const ql = compact.toLowerCase()
  const rows: OmnibarSuggestionRow[] = []
  const seen = new Set<string>()
  for (const href of VELO_PAGE_HREFS) {
    const hl = href.toLowerCase()
    if (!hl.includes(ql)) continue
    if (seen.has(hl)) continue
    seen.add(hl)
    const score = hl.startsWith(ql) ? 450 : 280
    rows.push({
      key: `velo-${href}`,
      type: 'internal',
      icon: 'velo',
      primary: href,
      secondary: 'Open in Velo',
      fillDisplay: href,
      submitInput: href,
      score
    })
  }
  const normalized = normalizeVeloNavigationInput(query)
  if (normalized) {
    const nl = normalized.toLowerCase()
    if (!seen.has(nl)) {
      rows.push({
        key: `velo-norm-${normDedupe(normalized)}`,
        type: 'internal',
        icon: 'velo',
        primary: normalized,
        secondary: 'Open in Velo',
        fillDisplay: normalized,
        submitInput: normalized,
        score: 480
      })
    }
  }
  return rows.sort((a, b) => b.score - a.score)
}

function rowKeyFor(kind: string, id: string): string {
  return `${kind}-${normDedupe(id).slice(0, 72)}`
}

function historyToRow(a: AggregatedHistory, ql: string, idx: number, precomputedScore?: number): OmnibarSuggestionRow | null {
  const s = precomputedScore ?? scoreHistoryAgg(ql, a)
  if (s <= 0) return null
  const hp = hostPretty(a.url)
  const searched = extractSearchQueryFromUrl(a.url)
  const titleFallback = a.title || hp
  const primary =
    searched || (titleFallback.toLowerCase().includes(ql) ? titleFallback.slice(0, 120) : hp.slice(0, 120))
  const secondary = (() => {
    if (searched) return hp
    if (a.title && a.title !== primary) return prettyUrlForOmnibar(a.url).slice(0, 88)
    return prettyUrlForOmnibar(a.url).slice(0, 88)
  })()
  return {
    key: rowKeyFor('h', `${idx}-${a.url}`),
    type: 'history',
    icon: 'history',
    primary: primary.slice(0, 120),
    secondary: secondary && secondary !== primary ? secondary : undefined,
    fillDisplay: searched
      ? searched
      : prettyUrlForOmnibar(a.url).replace(/^https?:\/\//i, ''),
    submitInput: a.url,
    score: s
  }
}

function bookmarkToRow(b: Pick<BookmarkEntry, 'url' | 'title'>, ql: string, idx: number): OmnibarSuggestionRow | null {
  if (!isSuggestibleHttpUrl(b.url)) return null
  const s = scoreTabBookmark(ql, 'bookmark', b.url, b.title || '', undefined, undefined)
  if (s <= 0) return null
  const hp = hostPretty(b.url)
  const displayTitle = (b.title || '').trim() || hp
  return {
    key: rowKeyFor('b', `${idx}-${b.url}`),
    type: 'bookmark',
    icon: 'bookmark',
    primary: displayTitle.slice(0, 120),
    secondary: prettyUrlForOmnibar(b.url).slice(0, 88),
    fillDisplay: prettyUrlForOmnibar(b.url).replace(/^https?:\/\//i, ''),
    submitInput: b.url,
    score: s
  }
}

function tabToRow(
  t: Pick<TabSnapshot, 'id' | 'url' | 'title'>,
  ql: string,
  idx: number,
  activeTabId?: number | null
): OmnibarSuggestionRow | null {
  if (t.id === activeTabId) return null
  if (!isSuggestibleHttpUrl(t.url)) return null
  const s = scoreTabBookmark(ql, 'tab', t.url, t.title || '', undefined, undefined)
  if (s <= 0) return null
  const pretty = prettyUrlForOmnibar(t.url)
  const displayTitle = (t.title || '').trim() || hostPretty(t.url)
  return {
    key: rowKeyFor('t', `${t.id}-${t.url}`),
    type: 'tab',
    icon: 'tab',
    primary: displayTitle.slice(0, 120),
    secondary: `Switch to this tab · ${pretty.slice(0, 72)}`,
    fillDisplay: pretty.replace(/^https?:\/\//i, ''),
    submitInput: t.url,
    score: s,
    tabId: t.id
  }
}

function navigationUrlRow(query: string, scoreBoost: number): OmnibarSuggestionRow | null {
  const q = query.trim()
  if (!q || normalizeVeloNavigationInput(q)) return null
  const url = httpsUrlIfBareHostname(q)
  if (!url) return null
  const fillDisplay = prettyUrlForOmnibar(url).replace(/^https?:\/\//i, '')
  return {
    key: rowKeyFor('url', fillDisplay),
    type: 'url',
    icon: 'globe',
    primary: fillDisplay,
    secondary: 'Open URL',
    fillDisplay,
    submitInput: url,
    score: 400 + scoreBoost
  }
}

function defaultActionRow(query: string, engine: SearchEngine): OmnibarSuggestionRow {
  const q = query.trim()
  const label = searchEngineLabel(engine)
  const veloUrl = normalizeVeloNavigationInput(q)
  if (veloUrl) {
    return {
      key: 'default-velo',
      type: 'internal',
      icon: 'velo',
      primary: veloUrl,
      secondary: 'Open in Velo',
      fillDisplay: veloUrl,
      submitInput: veloUrl,
      score: 10_000
    }
  }
  const directUrl = httpsUrlIfBareHostname(q)
  if (directUrl) {
    const fillDisplay = prettyUrlForOmnibar(directUrl).replace(/^https?:\/\//i, '')
    return {
      key: 'default-url',
      type: 'url',
      icon: 'globe',
      primary: fillDisplay,
      secondary: 'Open URL',
      fillDisplay,
      submitInput: directUrl,
      score: 9999
    }
  }
  return {
    key: 'default-search',
    type: 'search',
    icon: 'search',
    primary: `Search ${label} for “${q}”`,
    secondary: `${label} Search`,
    fillDisplay: q,
    submitInput: q,
    score: 9990
  }
}

function searchPhraseRow(phrase: string, engine: SearchEngine, remoteIdx: number): OmnibarSuggestionRow {
  const label = searchEngineLabel(engine)
  return {
    key: rowKeyFor('s', `${remoteIdx}-${phrase}`),
    type: 'search',
    icon: 'search',
    primary: phrase,
    secondary: `${label} Search`,
    fillDisplay: phrase,
    submitInput: phrase,
    score: 80 - remoteIdx * 2
  }
}

export function buildOmnibarSuggestions(opts: OmnibarBuildInput): OmnibarSuggestionRow[] {
  const q = opts.query.trim()
  if (!q) return []

  const ql = q.toLowerCase()
  const engine = opts.searchEngine
  const isVeloTyped = /^velo:/i.test(q.replace(/\s+/g, ''))

  const defaultRow = defaultActionRow(q, engine)
  const seenNorm = new Set<string>([normDedupe(defaultRow.submitInput)])

  const locals: OmnibarSuggestionRow[] = []

  if (isVeloTyped) {
    locals.push(...buildVeloInternalRows(q))
  }

  const navHint = navigationUrlRow(q, 0)
  if (navHint && !seenNorm.has(normDedupe(navHint.submitInput))) {
    locals.push(navHint)
    seenNorm.add(normDedupe(navHint.submitInput))
  }

  for (let i = 0; i < opts.openTabs.length; i++) {
    const row = tabToRow(opts.openTabs[i]!, ql, i, opts.activeTabId)
    if (row && !seenNorm.has(normDedupe(row.submitInput))) {
      locals.push(row)
      seenNorm.add(normDedupe(row.submitInput))
    }
  }

  for (let i = 0; i < opts.bookmarks.length; i++) {
    const row = bookmarkToRow(opts.bookmarks[i]!, ql, i)
    if (row && !seenNorm.has(normDedupe(row.submitInput))) {
      locals.push(row)
      seenNorm.add(normDedupe(row.submitInput))
    }
  }

  const aggs = aggregateHistory(opts.history)
  const histScored = aggs
    .map((a) => ({ a, s: scoreHistoryAgg(ql, a) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)

  const histDomainCount = new Map<string, number>()
  const maxHistPerDomain = historyPerDomainCap(q)
  let hi = 0
  for (const { a, s } of histScored) {
    const reg = registrableHostFromUrl(a.url)
    if (reg) {
      const c = histDomainCount.get(reg) ?? 0
      if (c >= maxHistPerDomain) continue
      histDomainCount.set(reg, c + 1)
    }
    const row = historyToRow(a, ql, hi++, s)
    if (row && !seenNorm.has(normDedupe(row.submitInput))) {
      locals.push(row)
      seenNorm.add(normDedupe(row.submitInput))
    }
  }

  if (isVeloTyped) {
    locals.sort((a, b) => {
      if (a.type === 'internal' && b.type !== 'internal') return -1
      if (b.type === 'internal' && a.type !== 'internal') return 1
      return b.score - a.score
    })
  } else {
    locals.sort((a, b) => b.score - a.score)
  }

  const out: OmnibarSuggestionRow[] = [defaultRow]
  for (const r of locals) {
    if (out.length >= OMNIBAR_MAX_SUGGESTIONS) break
    const n = normDedupe(r.submitInput)
    if (n === normDedupe(defaultRow.submitInput)) continue
    if (out.some((x) => normDedupe(x.submitInput) === n)) continue
    out.push(r)
  }

  const remoteDeduped = dedupePreserveOrder(opts.remoteSuggestions)
  let remoteIdx = 0
  for (const phrase of remoteDeduped) {
    if (out.length >= OMNIBAR_MAX_SUGGESTIONS) break
    if (remoteIdx >= OMNIBAR_MAX_REMOTE_PHRASES) break
    const pn = normDedupe(phrase)
    if (!pn || out.some((x) => normDedupe(x.submitInput) === pn)) continue
    out.push(searchPhraseRow(phrase, engine, remoteIdx))
    remoteIdx++
  }

  return out
}

export function fillDisplayMatchesInlinePrefix(fillDisplay: string, rawQuery: string): boolean {
  const r = rawQuery.trim()
  if (!r) return false
  return fillDisplay.toLowerCase().startsWith(r.toLowerCase())
}

export function isUnsafeInlineCompletion(fill: string): boolean {
  const t = fill.trim().toLowerCase()
  return t.startsWith('javascript:') || t.startsWith('data:')
}

export function getInlineAutocompleteCandidate(
  rawQuery: string,
  suggestions: OmnibarSuggestionRow[]
): string | null {
  const q = rawQuery.trim()
  if (!q) return null
  if (/\s/.test(q) && !/^velo:/i.test(q)) return null
  if (isUnsafeInlineCompletion(q)) return null

  let best: OmnibarSuggestionRow | null = null
  for (const r of suggestions) {
    if (r.type === 'search') continue
    if (r.score < OMNIBAR_INLINE_MIN_SCORE) continue
    if (!fillDisplayMatchesInlinePrefix(r.fillDisplay, q)) continue
    if (isUnsafeInlineCompletion(r.fillDisplay)) continue
    if (!best || r.score > best.score) best = r
  }
  return best?.fillDisplay ?? null
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

export function splitHighlightParts(
  text: string,
  query: string
): Array<{ text: string; em: boolean }> {
  const q = query.trim()
  if (!q) return [{ text, em: false }]
  const tl = text.toLowerCase()
  const ql = q.toLowerCase()
  const idx = tl.indexOf(ql)
  if (idx < 0) return [{ text, em: false }]
  const parts: Array<{ text: string; em: boolean }> = []
  if (idx > 0) parts.push({ text: text.slice(0, idx), em: false })
  parts.push({ text: text.slice(idx, idx + q.length), em: true })
  if (idx + q.length < text.length) parts.push({ text: text.slice(idx + q.length), em: false })
  return parts
}
