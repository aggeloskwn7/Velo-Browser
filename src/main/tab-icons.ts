import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { WebContents } from 'electron'
import { getLastTabCommittedUrl } from './velo-page-origin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const VELO_ICON = 'Velo.ico'
const DEFAULT_ICON = 'default_favicon.ico'


function rendererStaticDir(): string {
  return join(__dirname, '../renderer')
}


function devRendererOrigin(): string | null {
  const u = process.env['ELECTRON_RENDERER_URL']
  if (u == null || u === '') return null
  return u.replace(/\/$/, '')
}

function hrefForPublicIcon(filename: string): string | null {
  const origin = devRendererOrigin()
  if (origin) return `${origin}/${filename}`

  const disk = join(rendererStaticDir(), filename)
  if (!existsSync(disk)) return null
  return pathToFileURL(disk).href
}

let veloHref: string | null | undefined
let defaultHref: string | null | undefined

function veloTabIconHref(): string | null {
  if (veloHref !== undefined) return veloHref
  veloHref = hrefForPublicIcon(VELO_ICON)
  if (veloHref === null) {
    console.warn(`[velo] Missing public/${VELO_ICON} — internal tab icon will fall back to page favicon or default.`)
  }
  return veloHref
}

function defaultTabIconHref(): string | null {
  if (defaultHref !== undefined) return defaultHref
  defaultHref = hrefForPublicIcon(DEFAULT_ICON)
  if (defaultHref === null) {
    console.warn(`[velo] Missing public/${DEFAULT_ICON} — tabs without favicons show the empty placeholder.`)
  }
  return defaultHref
}


export function tabStripFavicon(wc: WebContents, stored: string | null): string | null {
  const live = wc.getURL() || ''
  const recorded = getLastTabCommittedUrl(wc) ?? ''
  const pageUrl = live.length > 0 ? live : recorded

  if (pageUrl.toLowerCase().startsWith('velo://')) {
    return veloTabIconHref() ?? stored ?? defaultTabIconHref()
  }
  if (stored && stored.length > 0) return stored
  return defaultTabIconHref()
}
