
export function veloRouteKey(requestUrl: string): string {
  const url = new URL(requestUrl)
  const host = (url.hostname || '').toLowerCase()
  let rawPath = url.pathname || '/'
  if (rawPath.length > 1 && rawPath.endsWith('/')) {
    rawPath = rawPath.slice(0, -1)
  }
  const path = rawPath || '/'

  
  if (!host && path !== '/') {
    const lower = path.toLowerCase()
    return lower === '/' ? '/newtab' : lower
  }

  if (host) {
    const base = `/${host}`
    if (path === '/') {
      const key = base.toLowerCase()
      return key === '/' ? '/newtab' : key
    }
    return `${base}${path}`.replace(/\/{2,}/g, '/').toLowerCase()
  }

  if (path === '/') return '/newtab'
  return path.toLowerCase()
}
