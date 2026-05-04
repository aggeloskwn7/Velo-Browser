import type { NewTabBackground, NewTabBackgroundPreset } from '../../shared/ipc.js'
import { NEW_TAB_BACKGROUND_PRESETS } from '../../shared/ipc.js'
import { isSafeBackgroundBasename, listBrowserBackgroundBasenames } from './browser-backgrounds.js'


export const NEW_TAB_PRESET_HEX: Record<Exclude<NewTabBackgroundPreset, 'default'>, string> = {
  red: '#c62828',
  orange: '#ef6c00',
  yellow: '#f9a825',
  green: '#2e7d32',
  blue: '#1565c0',
  indigo: '#3949ab',
  violet: '#6a1b9a',
  black: '#0a0a0a',
  white: '#f5f5f5',
  grey: '#6d6d72',
  'dark-grey': '#25252c',
  'light-grey': '#d8d8e2'
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}


export function presetForegroundMode(preset: NewTabBackgroundPreset): 'light' | 'dark' {
  if (preset === 'default') return 'dark'
  const hex = NEW_TAB_PRESET_HEX[preset as Exclude<NewTabBackgroundPreset, 'default'>]
  const rgb = hexToRgb(hex)
  if (!rgb) return 'dark'
  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  )
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return L > 0.45 ? 'light' : 'dark'
}

export function normalizeNewTabBackground(
  raw: unknown,
  allowedImages: ReadonlySet<string>
): NewTabBackground {
  if (!raw || typeof raw !== 'object') return { kind: 'preset', preset: 'default' }
  const o = raw as Record<string, unknown>
  if (o.kind === 'preset') {
    const p = o.preset
    if (typeof p === 'string' && (NEW_TAB_BACKGROUND_PRESETS as readonly string[]).includes(p)) {
      return { kind: 'preset', preset: p as NewTabBackgroundPreset }
    }
    return { kind: 'preset', preset: 'default' }
  }
  if (o.kind === 'image') {
    const f = typeof o.filename === 'string' ? o.filename.trim() : ''
    if (!isSafeBackgroundBasename(f)) return { kind: 'preset', preset: 'default' }
    if (!allowedImages.has(f)) return { kind: 'preset', preset: 'default' }
    return { kind: 'image', filename: f }
  }
  return { kind: 'preset', preset: 'default' }
}

export function allowedBackgroundImageSet(): Set<string> {
  return new Set(listBrowserBackgroundBasenames())
}

export type NewTabBgHtmlInject = {
  htmlAttrs: Record<string, string>
  
  styleBlock: string
}


const NT_CONTENT_ON_DARK_BG = `
    color-scheme: dark;
    --fg: #eaeaf0;
    --muted: #8b8b9e;
    --accent: #6c9eff;
    --border: #3a3a48;
    --card: rgba(28, 28, 36, 0.94);
    --vel-input-bg: rgba(37, 37, 48, 0.96);
    --vel-input-hover: rgba(50, 50, 62, 0.98);
    --nt-search-bg: rgba(39, 39, 49, 0.94);
    --nt-search-border: rgba(255, 255, 255, 0.12);
    --nt-search-shadow: 0 6px 24px rgba(0, 0, 0, 0.42);
    --nt-search-focus-border: rgba(108, 158, 255, 0.55);
    --nt-search-focus-ring: 0 0 0 1px rgba(108, 158, 255, 0.22), 0 4px 28px rgba(0, 0, 0, 0.48), 0 0 0 3px rgba(108, 158, 255, 0.1);
    --nt-icon-muted: rgba(255, 255, 255, 0.55);
    --nt-fab-fg: rgba(255, 255, 255, 0.75);
    --nt-fab-hover-border: rgba(255, 255, 255, 0.52);
    --nt-fab-hover-fg: #ffffff;
    --nt-label: rgba(235, 235, 242, 0.92);
    --nt-sub: rgba(210, 210, 222, 0.9);
    --nt-modal-border: #2a2a36;
    --nt-modal-shadow: 0 24px 64px rgba(0, 0, 0, 0.52);
    --nt-popover-border: #2a2a36;
    --nt-popover-shadow: 0 14px 44px rgba(0, 0, 0, 0.48);
    --nt-tile-label: #fff;
    --danger: #ff8a80;
`

export function buildNewTabBackgroundHtml(bg: NewTabBackground): NewTabBgHtmlInject {
  if (bg.kind === 'preset' && bg.preset === 'default') {
    return { htmlAttrs: {}, styleBlock: '' }
  }

  if (bg.kind === 'preset') {
    const hex = NEW_TAB_PRESET_HEX[bg.preset as Exclude<NewTabBackgroundPreset, 'default'>]
    const mode = presetForegroundMode(bg.preset)
    return {
      htmlAttrs: {
        'data-nt-bg': 'solid',
        'data-nt-surface': mode
      },
      styleBlock: `
  html[data-nt-bg="solid"] { background: ${hex} !important; }
  html[data-nt-bg="solid"] body {
    background: ${hex} !important;
    background-color: ${hex} !important;
  }
  html[data-nt-surface="light"] {
    --fg: #12121a;
    --muted: #5c5c6e;
    --accent: #2f6fed;
    --border: #c8c8d4;
    --card: rgba(255, 255, 255, 0.92);
    --vel-input-bg: rgba(255, 255, 255, 0.85);
    --vel-input-hover: rgba(255, 255, 255, 0.95);
    --nt-search-bg: rgba(255, 255, 255, 0.88);
    --nt-search-border: rgba(0, 0, 0, 0.12);
    --nt-search-shadow: 0 6px 24px rgba(0, 0, 0, 0.1);
    --nt-search-focus-border: rgba(47, 111, 237, 0.45);
    --nt-search-focus-ring: 0 0 0 1px rgba(47, 111, 237, 0.2), 0 4px 28px rgba(0, 0, 0, 0.12), 0 0 0 3px rgba(47, 111, 237, 0.12);
    --nt-icon-muted: rgba(0, 0, 0, 0.48);
    --nt-fab-fg: rgba(0, 0, 0, 0.58);
    --nt-fab-hover-border: rgba(0, 0, 0, 0.38);
    --nt-fab-hover-fg: rgba(0, 0, 0, 0.92);
    --nt-label: rgba(40, 40, 52, 0.88);
    --nt-sub: rgba(55, 55, 70, 0.75);
    --nt-modal-border: #d0d0dc;
    --nt-modal-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
    --nt-popover-border: #d0d0dc;
    --nt-popover-shadow: 0 14px 44px rgba(0, 0, 0, 0.16);
    --nt-tile-label: #fff;
    --danger: #c62828;
  }
  html[data-nt-surface="dark"] {
${NT_CONTENT_ON_DARK_BG}
  }
`
    }
  }

  const url = `velo:///browser-backgrounds/${encodeURIComponent(bg.filename)}`
  return {
    htmlAttrs: {
      'data-nt-bg': 'image',
      'data-nt-surface': 'dark'
    },
    styleBlock: `
  html[data-nt-bg="image"] {
${NT_CONTENT_ON_DARK_BG}
  }
  html[data-nt-bg="image"] body {
    background-color: #0a0a0a;
    background-image: url("${url}");
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
    background-repeat: no-repeat;
  }
  html[data-nt-bg="image"] body::before {
    content: "";
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.42);
    pointer-events: none;
    z-index: 0;
  }
  html[data-nt-bg="image"] .nt-wrap {
    position: relative;
    z-index: 1;
  }
`
  }
}
