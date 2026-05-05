

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function dedupePreserveOrder(phrases: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of phrases) {
    const n = norm(p)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(p.trim())
  }
  return out
}


function prioritizeCompletions(phrases: string[], query: string): string[] {
  const list = dedupePreserveOrder(phrases)
  const q = query.trim().toLowerCase()
  if (!q) return list
  const idx = list.findIndex((p) => p.trim().toLowerCase() !== q)
  if (idx <= 0) return list
  const next = [...list]
  const [picked] = next.splice(idx, 1)
  next.unshift(picked)
  return next
}

function parseGoogleSuggestJson(text: string): string[] {
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

async function fetchGoogleSuggestionsRaw(query: string): Promise<string[]> {
  const q = query.trim()
  if (!q) return []
  const u =
    'https://suggestqueries.google.com/complete/search?client=chrome&hl=en&gl=us&q=' +
    encodeURIComponent(q)
  const res = await fetch(u, {
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      Accept: '*/*',
      'User-Agent': CHROME_UA
    }
  })
  if (!res.ok) return []
  const text = await res.text()
  return parseGoogleSuggestJson(text)
}

async function fetchDdgSuggestionsRaw(query: string): Promise<string[]> {
  const q = query.trim()
  if (!q) return []
  const u = `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`
  const res = await fetch(u, {
    credentials: 'omit',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA }
  })
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

export async function fetchOmnibarSuggestionsForShell(query: string): Promise<string[]> {
  const q = query.trim()
  if (!q) return []
  const g = await fetchGoogleSuggestionsRaw(q).catch(() => [] as string[])
  if (g.length) return prioritizeCompletions(g, q).slice(0, 8)
  const d = await fetchDdgSuggestionsRaw(q).catch(() => [] as string[])
  return prioritizeCompletions(d, q).slice(0, 8)
}
