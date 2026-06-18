import type { Session } from 'electron'
import { renderBookmarksPage } from './velo-pages/bookmarks.js'
import { renderDownloadsPage } from './velo-pages/downloads.js'
import { renderHistoryPage } from './velo-pages/history.js'
import { renderNewTabPage } from './velo-pages/newtab.js'
import { renderNotFoundPage } from './velo-pages/not-found.js'
import { veloRouteKey } from './velo-pages/route-key.js'
import { renderSettingsPage } from './velo-pages/settings.js'
import { readVeloLogoPng } from './velo-pages/static-assets.js'
import { readBrowserBackgroundFile } from './velo-pages/browser-backgrounds.js'
import { renderWelcomePage } from './velo-pages/welcome.js'
import { renderAboutPage } from './velo-pages/about.js'


export function registerVeloProtocol(contentSession: Session): void {
  contentSession.protocol.handle('velo', async (request) => {
    try {
      new URL(request.url)
    } catch {
      return new Response('Bad URL', { status: 400 })
    }

    const route = veloRouteKey(request.url)
    const htmlHeaders = { 'content-type': 'text/html; charset=utf-8' }

    if (route === '/velo.png') {
      const png = readVeloLogoPng()
      if (!png) {
        return new Response('Not found', { status: 404 })
      }
      return new Response(png, {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=86400'
        }
      })
    }

    if (route.startsWith('/browser-backgrounds/')) {
      const leaf = route.slice('/browser-backgrounds/'.length)
      if (!leaf || leaf.includes('/') || leaf.includes('..')) {
        return new Response('Not found', { status: 404 })
      }
      try {
        const decoded = decodeURIComponent(leaf)
        const file = readBrowserBackgroundFile(decoded)
        if (!file) {
          return new Response('Not found', { status: 404 })
        }
        return new Response(file.buf, {
          headers: {
            'content-type': file.mime,
            'cache-control': 'public, max-age=86400'
          }
        })
      } catch {
        return new Response('Not found', { status: 404 })
      }
    }

    if (route === '/newtab') {
      return new Response(renderNewTabPage(), { headers: htmlHeaders })
    }

    
    if (route === '/history' || route === '/settings/history') {
      return new Response(renderHistoryPage(), { headers: htmlHeaders })
    }
    if (route === '/bookmarks' || route === '/settings/bookmarks') {
      return new Response(renderBookmarksPage(), { headers: htmlHeaders })
    }
    if (route === '/downloads' || route === '/settings/downloads') {
      return new Response(renderDownloadsPage(), { headers: htmlHeaders })
    }
    if (route === '/welcome') {
      let firstLaunch = false
      try {
        const u = new URL(request.url)
        firstLaunch = u.searchParams.get('intro') === '1' || u.searchParams.get('first') === '1'
      } catch {}
      return new Response(renderWelcomePage({ firstLaunch }), { headers: htmlHeaders })
    }

    if (route === '/about') {
      return new Response(renderAboutPage(), { headers: htmlHeaders })
    }

    if (route.startsWith('/settings')) {
      const settingsHtml = renderSettingsPage(route)
      if (settingsHtml != null) {
        return new Response(settingsHtml, { headers: htmlHeaders })
      }
    }

    return new Response(renderNotFoundPage(route), {
      status: 404,
      headers: htmlHeaders
    })
  })
}
