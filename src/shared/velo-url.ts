
export function looksLikeBareHostname(input: string): boolean {
  if (input.includes(' ') || input.includes('\t')) return false
  const hostish = input.replace(/^\/+/, '')
  return /^[\w.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(hostish)
}


export function httpsUrlIfBareHostname(raw: string): string | null {
  const q = raw.trim()
  if (!q || !looksLikeBareHostname(q)) return null
  const withProto = q.includes('://') ? q : `https://${q.replace(/^\/+/, '')}`
  try {
    
    new URL(withProto)
    return withProto
  } catch {
    return null
  }
}


export function normalizeVeloNavigationInput(raw: string): string | null {
  const compact = raw.trim().replace(/\s+/g, '')
  if (!compact) return null
  if (!/^velo:/i.test(compact)) return null
  if (/^velo:\/\//i.test(compact)) {
    try {
      new URL(compact)
      return compact
    } catch {
      return compact
    }
  }
  const rest = compact.slice(5).replace(/^\/+/u, '')
  if (!rest) return 'velo://newtab'
  return `velo://${rest}`
}
