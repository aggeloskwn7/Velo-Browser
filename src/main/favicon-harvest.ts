import type { WebContents } from 'electron'
import { getLastTabCommittedUrl } from './velo-page-origin.js'


const HARVEST_SCRIPT = `(function () {
  function relTokens(rel) {
    return (rel || '')
      .toLowerCase()
      .trim()
      .split(/\\s+/)
      .filter(Boolean)
  }

  function isFaviconRel(rel) {
    var t = relTokens(rel)
    if (t.indexOf('icon') >= 0) return true
    if (t.indexOf('apple-touch-icon') >= 0) return true
    if (t.indexOf('apple-touch-icon-precomposed') >= 0) return true
    if (t.indexOf('mask-icon') >= 0) return true
    return false
  }

  var candidates = []
  var links = document.querySelectorAll('link[rel][href]')
  for (var i = 0; i < links.length; i++) {
    var link = links[i]
    if (!isFaviconRel(link.getAttribute('rel'))) continue
    var href = link.getAttribute('href')
    if (!href) continue
    try {
      var abs = new URL(href, document.baseURI).href
      if (abs.indexOf('blob:') === 0) continue
      var rt = relTokens(link.getAttribute('rel'))
      var sizes = link.getAttribute('sizes') || ''
      var type = (link.getAttribute('type') || '').toLowerCase()
      var score = 16
      var multi = sizes.trim().split(/\\s+/)
      for (var j = 0; j < multi.length; j++) {
        var mm = multi[j].match(/^(\\d+)x(\\d+)$/i)
        if (mm) {
          var px = parseInt(mm[1], 10) * parseInt(mm[2], 10)
          if (px > score) score = px
        }
      }
      if (type.indexOf('image/svg') >= 0) score += 100000
      else if (type.indexOf('image/png') >= 0) score += 50000
      else if (type.indexOf('image/webp') >= 0) score += 40000
      else if (type.indexOf('image/jpeg') >= 0 || type.indexOf('image/jpg') >= 0) score += 30000
      else if (type.indexOf('image/x-icon') >= 0 || type.indexOf('image/vnd.microsoft.icon') >= 0) score += 80000
      else if (type.indexOf('image/ico') >= 0) score += 75000
      if (rt.indexOf('mask-icon') >= 0) score += 20000
      if (rt.indexOf('apple-touch-icon-precomposed') >= 0) score -= 1000
      if (rt.indexOf('apple-touch-icon') >= 0) score -= 500
      if (/\\.ico(\\?|#|$)/i.test(abs)) score += 45000
      candidates.push({ abs: abs, score: score })
    } catch (e) {}
  }

  candidates.sort(function (a, b) {
    return b.score - a.score
  })
  var out = []
  for (var k = 0; k < candidates.length; k++) {
    var u = candidates[k].abs
    if (out.indexOf(u) < 0) out.push(u)
  }

  try {
    var loc = document.location
    if (loc && (loc.protocol === 'https:' || loc.protocol === 'http:')) {
      var guess = new URL('/favicon.ico', loc.origin).href
      if (out.indexOf(guess) < 0) out.push(guess)
    }
  } catch (e2) {}

  return out
})()`


export function normalizeFaviconForShell(pageUrl: string, candidate: string | null | undefined): string | null {
  if (candidate == null || candidate === '') return null
  const t = candidate.trim()
  if (t.startsWith('blob:')) return null
  if (t.startsWith('chrome:') || t.startsWith('about:') || t.startsWith('javascript:')) return null
  if (t.startsWith('data:')) {
    return /^data:image\//i.test(t) ? t : null
  }
  try {
    if (/^https?:\/\//i.test(t)) return t
    const base = pageUrl.trim()
    if (!/^https?:/i.test(base)) return null
    return new URL(t, base).href
  } catch {
    return null
  }
}

export function shellCanDisplayFavicon(url: string | null | undefined): boolean {
  if (url == null || url === '') return false
  return /^https?:\/\//i.test(url) || url.startsWith('data:image/')
}


export async function harvestFaviconCandidates(wc: WebContents): Promise<string[]> {
  if (wc.isDestroyed()) return []
  const pageUrl = wc.getURL() || getLastTabCommittedUrl(wc) || ''
  try {
    const raw: unknown = await wc.executeJavaScript(HARVEST_SCRIPT)
    if (!Array.isArray(raw)) return []
    const seen = new Set<string>()
    const out: string[] = []
    for (const u of raw) {
      if (typeof u !== 'string' || u.length === 0) continue
      const n = normalizeFaviconForShell(pageUrl, u)
      if (n && !seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    return out
  } catch {
    return []
  }
}
