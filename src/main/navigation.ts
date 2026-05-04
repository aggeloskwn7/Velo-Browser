import type { SearchEngine } from '../shared/ipc.js'
import { httpsUrlIfBareHostname, normalizeVeloNavigationInput } from '../shared/velo-url.js'

export function searchUrlForQuery(engine: SearchEngine, rawQuery: string): string {
  const enc = encodeURIComponent(rawQuery)
  switch (engine) {
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${enc}`
    case 'bing':
      return `https://www.bing.com/search?q=${enc}`
    case 'brave':
      return `https://search.brave.com/search?q=${enc}`
    case 'ecosia':
      return `https://www.ecosia.org/search?q=${enc}`
    default:
      return `https://www.google.com/search?q=${enc}`
  }
}

export function resolveNavigation(input: string, engine: SearchEngine): string {
  const q = input.trim()
  if (!q) return 'velo://newtab'

  const veloNorm = normalizeVeloNavigationInput(q)
  if (veloNorm) return veloNorm

  if (/^(https?|file|about):/i.test(q)) {
    if (/^https?:\/\//i.test(q)) return q
    if (/^about:/i.test(q)) return q
    if (/^file:\/\//i.test(q)) return q
  }

  if (/^https?\s*:\s*\/\//i.test(q)) {
    return q.replace(/\s/g, '')
  }

  if (q.startsWith('//')) {
    return `https:${q}`
  }

  const bareHostUrl = httpsUrlIfBareHostname(q)
  if (bareHostUrl) return bareHostUrl

  return searchUrlForQuery(engine, q)
}
