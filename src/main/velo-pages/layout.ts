

import type { BrowserChromeTheme } from '../../shared/ipc.js'
import { getSettings } from '../settings-store.js'
import { VEL_APPEARANCE_THEME_CSS, metaThemeColorForBrowserTheme } from './velo-appearance-css.js'

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const VEL_BASE_STYLE = `
  :root {
    --tap: 44px;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; background: var(--bg); }
  body {
    margin: 0; font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
    background: var(--bg); color: var(--fg);
    min-height: 100dvh;
    padding-top: max(1.25rem, env(safe-area-inset-top));
    padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
    padding-left: max(clamp(0.875rem, 3vw, 2rem), env(safe-area-inset-left));
    padding-right: max(clamp(0.875rem, 3vw, 2rem), env(safe-area-inset-right));
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  h1 { font-size: clamp(1.2rem, 4.5vw, 1.5rem); font-weight: 600; letter-spacing: -0.02em; margin: 0 0 0.5rem; }
  p { color: var(--muted); margin: 0 0 1rem; max-width: min(52ch, 100%); }
  .vp-shell { width: 100%; max-width: min(720px, 100%); margin: 0 auto; }
  .card {
    background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    padding: clamp(1rem, 3vw, 1.25rem); width: 100%; max-width: min(640px, 100%);
  }
  @media (max-width: 480px) {
    .card { border-radius: 10px; padding: 1rem; }
    p { max-width: 100%; }
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  label { display: block; font-size: 0.85rem; color: var(--muted); margin: 0.75rem 0 0.25rem; }
  select {
    background: var(--vel-input-bg); color: var(--fg); border: 1px solid var(--border);
    border-radius: 8px; padding: 0.5rem 0.75rem; font: inherit;
    min-height: var(--tap);
    touch-action: manipulation;
    width: 100%;
    max-width: min(28rem, 100%);
  }
  button {
    background: var(--vel-input-bg); color: var(--fg); border: 1px solid var(--border);
    border-radius: 8px; padding: 0.5rem 0.75rem; font: inherit;
    min-height: var(--tap);
    touch-action: manipulation;
  }
  button { cursor: pointer; margin-top: 1rem; }
  button:hover { background: var(--vel-input-hover); }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  button:disabled:hover { background: var(--vel-input-bg); }
  ul { list-style: none; padding: 0; margin: 0; }
  li {
    padding: 0.65rem 0; border-bottom: 1px solid var(--border); font-size: clamp(0.85rem, 2.8vw, 0.9rem);
    overflow-wrap: anywhere; word-break: break-word;
  }
  li:last-child { border-bottom: none; }
  li a { display: inline-block; max-width: 100%; }
  small { color: var(--muted); display: block; margin-top: 0.25rem; }
  .logo { font-weight: 700; color: var(--accent); letter-spacing: 0.04em; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.75rem; }
`


export const VEL_FRAME_STYLE = `
  body:has(.vp-root) {
    padding: 0;
    height: 100dvh;
    overflow: hidden;
  }
  .vp-root {
    min-height: 0;
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .vp-body {
    flex: 1;
    display: flex;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    align-items: stretch;
  }
  .vp-side {
    flex: 0 0 252px;
    width: 252px;
    border-right: 1px solid var(--vp-side-border);
    background: var(--vp-side-bg);
    padding: 12px 10px 20px;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(90, 90, 110, 0.35) transparent;
    align-self: stretch;
    min-height: 0;
  }
  .vp-side::-webkit-scrollbar {
    width: 5px;
  }
  .vp-side::-webkit-scrollbar-thumb {
    background: rgba(90, 90, 110, 0.35);
    border-radius: 100px;
  }
  .vp-side-label {
    padding: 16px 14px 8px;
    font-size: 0.61rem;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    opacity: 0.72;
  }
  .vp-side-label:first-child {
    padding-top: 6px;
  }
  .vp-side-item {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 12px 9px 11px;
    margin: 0 4px 3px;
    font-size: 0.8125rem;
    font-weight: 450;
    letter-spacing: 0.01em;
    color: var(--vp-side-item-fg);
    text-decoration: none;
    border: none;
    background: transparent;
    width: calc(100% - 8px);
    max-width: calc(100% - 8px);
    text-align: left;
    cursor: pointer;
    font: inherit;
    box-sizing: border-box;
    border-radius: 12px;
    transition:
      background 0.16s ease,
      color 0.16s ease,
      box-shadow 0.16s ease;
  }
  .vp-side-ic {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 8px;
    background: var(--vp-side-ic-bg);
    color: var(--vp-side-ic-fg);
    transition:
      background 0.16s ease,
      color 0.16s ease;
  }
  .vp-side-ic svg {
    display: block;
    width: 15px;
    height: 15px;
  }
  .vp-side-txt {
    flex: 1;
    min-width: 0;
    line-height: 1.3;
  }
  .vp-side-item:hover {
    color: var(--vp-side-item-hover-fg);
    background: var(--vp-side-item-hover-bg);
    text-decoration: none;
    box-shadow: var(--vp-side-item-hover-shadow);
  }
  .vp-side-item:hover .vp-side-ic {
    background: var(--vp-side-ic-hover-bg);
    color: var(--vp-side-ic-hover-fg);
  }
  .vp-side-item.is-active {
    color: var(--fg);
    font-weight: 560;
    background: var(--vp-side-active-bg);
    box-shadow: var(--vp-side-active-shadow);
  }
  .vp-side-item.is-active .vp-side-ic {
    background: var(--vp-side-active-ic-bg);
    color: var(--accent);
  }
  .vp-main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .vp-main-inner {
    max-width: min(800px, 100%);
    padding: 1.25rem clamp(1rem, 3vw, 1.75rem) 2.5rem;
    margin: 0 auto;
  }
  .vp-main-inner .vp-shell {
    max-width: none;
    margin: 0;
    width: 100%;
  }
  .vp-main-inner .card {
    max-width: none;
  }
  .vp-lead {
    color: var(--muted);
    margin: 0 0 1rem;
    max-width: min(52ch, 100%);
    font-size: 0.9rem;
  }
  .vp-set-h {
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0 0 0.65rem;
    color: var(--fg);
  }
  .vp-set-note {
    font-size: 0.85rem;
    color: var(--muted);
    margin: 0 0 0.75rem;
    max-width: min(52ch, 100%);
  }
  .vp-set-status {
    margin-top: 0.75rem;
    margin-bottom: 0;
    font-size: 0.85rem;
    color: var(--muted);
    max-width: none;
  }.vp-set-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem 1.5rem;
    padding: 0.9rem 0;
    border-bottom: 1px solid var(--border);
  }
  .vp-set-row:first-of-type {
    padding-top: 0;
  }
  .vp-set-row:last-of-type {
    border-bottom: none;
    padding-bottom: 0;
  }
  .vp-set-row__text {
    flex: 1;
    min-width: 0;
  }
  .vp-set-row__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--fg);
    margin: 0;
    line-height: 1.35;
  }
  .vp-set-row__desc {
    font-size: 0.8125rem;
    color: var(--muted);
    margin: 0.28rem 0 0;
    line-height: 1.45;
    max-width: min(42ch, 100%);
  }
  .vp-set-row__control {
    flex-shrink: 0;
    padding-top: 0.2rem;
  }
  .vp-set-row__control select {
    width: auto;
    min-width: min(11rem, 100%);
    max-width: min(16rem, 100%);
  }.vp-switch {
    -webkit-appearance: none;
    appearance: none;
    box-sizing: border-box;
    width: 2.875rem;
    height: 1.75rem;
    margin: 0;
    flex-shrink: 0;
    border-radius: 999px;
    background: var(--vel-input-bg);
    border: 1px solid var(--border);
    cursor: pointer;
    position: relative;
    transition:
      background 0.22s ease,
      border-color 0.22s ease,
      box-shadow 0.22s ease;
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.14),
      0 1px 0 rgba(255, 255, 255, 0.04);
    vertical-align: middle;
  }
  .vp-switch:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  }
  .vp-switch::after {
    content: '';
    position: absolute;
    width: 1.3125rem;
    height: 1.3125rem;
    border-radius: 50%;
    top: 50%;
    left: 0.2rem;
    transform: translate(0, -50%);
    background: linear-gradient(180deg, #ffffff 0%, #e8e8ef 100%);
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.28),
      0 0 0 1px rgba(0, 0, 0, 0.07);
    transition:
      transform 0.26s cubic-bezier(0.33, 1.12, 0.52, 1),
      box-shadow 0.2s ease,
      background 0.2s ease;
  }
  .vp-switch:checked {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--accent) 78%, #ffffff) 0%,
      var(--accent) 100%
    );
    border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.22),
      0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent);
  }
  .vp-switch:checked::after {
    transform: translate(calc(2.875rem - 1.3125rem - 0.4rem), -50%);
    background: linear-gradient(180deg, #ffffff 0%, #f3f3f8 100%);
    box-shadow:
      0 2px 7px rgba(0, 0, 0, 0.2),
      0 0 0 1px rgba(0, 0, 0, 0.06);
  }
  .vp-switch:active:not(:disabled)::after {
    transform: translate(0, -50%) scale(0.94);
  }
  .vp-switch:active:not(:disabled):checked::after {
    transform: translate(calc(2.875rem - 1.3125rem - 0.4rem), -50%) scale(0.94);
  }
  .vp-switch:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .vp-switch:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }.vp-check-sm {
    -webkit-appearance: none;
    appearance: none;
    box-sizing: border-box;
    width: 1.125rem;
    height: 1.125rem;
    margin: 0;
    flex-shrink: 0;
    border-radius: 6px;
    border: 2px solid color-mix(in srgb, var(--muted) 65%, var(--border));
    background: var(--card);
    cursor: pointer;
    position: relative;
    vertical-align: middle;
    transition:
      border-color 0.16s ease,
      background 0.16s ease,
      box-shadow 0.16s ease;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
  }
  .vp-check-sm:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }
  .vp-check-sm:checked {
    background: var(--accent);
    border-color: var(--accent);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .vp-check-sm:checked::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 45%;
    width: 0.28rem;
    height: 0.55rem;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: translate(-50%, -50%) rotate(45deg);
  }
  .vp-check-sm:indeterminate {
    background: color-mix(in srgb, var(--accent) 22%, var(--card));
    border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  }
  .vp-check-sm:indeterminate::after {
    content: '';
    position: absolute;
    left: 3px;
    right: 3px;
    top: 50%;
    height: 2px;
    margin-top: -1px;
    background: var(--accent);
    border-radius: 1px;
    border: none;
    transform: none;
  }
  .vp-check-sm:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .vp-check-sm:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  @media (prefers-reduced-motion: reduce) {
    .vp-switch,
    .vp-switch::after,
    .vp-check-sm {
      transition: none;
    }
  }
  @media (max-width: 520px) {
    .vp-set-row {
      flex-direction: column;
      align-items: stretch;
    }
    .vp-set-row__control select {
      width: 100%;
      max-width: none;
    }
  }
  .vp-download-path {
    font-size: 0.8125rem;
    word-break: break-all;
    margin: 0.35rem 0 0;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    font-family: ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Consolas, monospace;
    color: var(--fg);
    line-height: 1.45;
    max-width: 100%;
  }
  .vp-dl-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.85rem;
  }
  @media (max-width: 720px) {
    .vp-body {
      flex-direction: column;
    }
    .vp-side {
      flex: none;
      width: 100%;
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 12px 10px 14px;
      max-height: none;
    }
    .vp-side-label {
      width: 100%;
      padding: 8px 8px 4px;
    }
    .vp-side-item {
      width: auto;
      max-width: none;
      flex: 1 1 auto;
      min-width: min(160px, 100%);
      margin: 0;
      border-radius: 11px;
      padding: 8px 11px;
    }
  }
`

const VP_SVG = (
  paths: string
) =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`

const VP_SIDE_ICONS: Record<string, string> = {
  appearance: VP_SVG(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v1.5M12 20.5V22M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M2 12h1.5M20.5 12H22M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06"/>'
  ),
  languages: VP_SVG('<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 000 20"/>'),
  'download-preferences': VP_SVG(
    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>'
  ),
  privacy: VP_SVG('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  'password-manager': VP_SVG(
    '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M12 15v2M8 11V7a4 4 0 018 0v4"/>'
  ),
  'new-tab-page': VP_SVG(
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>'
  ),
  accessibility: VP_SVG(
    '<circle cx="12" cy="5" r="1.8"/><path d="M12 8v5"/><path d="M8 21v-5l4-3 4 3v5"/><path d="M5.5 11h13"/>'
  ),
  performance: VP_SVG('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'),
  system: VP_SVG('<circle cx="8" cy="15" r="2"/><circle cx="16" cy="9" r="2"/><path d="M8 3v6M16 3v2M16 21v-6M8 21v-2"/>'),
  'default-browser': VP_SVG(
    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>'
  ),
  import: VP_SVG(
    '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 21h16"/>'
  ),
  history: VP_SVG('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  bookmarks: VP_SVG('<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>'),
  downloads: VP_SVG(
    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>'
  ),
  _fallback: VP_SVG('<circle cx="12" cy="12" r="3.5"/>')
}

function veloSideNavItem(slug: string, label: string, activeSlug: string): string {
  const icon = VP_SIDE_ICONS[slug] ?? VP_SIDE_ICONS._fallback
  const active = slug === activeSlug ? ' is-active' : ''
  return `<a class="vp-side-item${active}" href="velo://settings/${slug}"><span class="vp-side-ic" aria-hidden="true">${icon}</span><span class="vp-side-txt">${escapeHtml(label)}</span></a>`
}


export function veloSettingsSidebarHtml(activeSlug: string): string {
  const preferences: { slug: string; label: string }[] = [
    { slug: 'appearance', label: 'Appearance' },
    { slug: 'languages', label: 'Languages' },
    { slug: 'download-preferences', label: 'Download preferences' },
    { slug: 'privacy', label: 'Privacy' },
    { slug: 'password-manager', label: 'Password Manager & Autofill' },
    { slug: 'new-tab-page', label: 'New Tab Page' },
    { slug: 'accessibility', label: 'Accessibility' },
    { slug: 'performance', label: 'Performance' },
    { slug: 'system', label: 'System' },
    { slug: 'default-browser', label: 'Default browser' },
    { slug: 'import', label: 'Import browser data' }
  ]
  const library: { slug: string; label: string }[] = [
    { slug: 'history', label: 'History' },
    { slug: 'bookmarks', label: 'Bookmarks' },
    { slug: 'downloads', label: 'Downloads' }
  ]
  const prefLinks = preferences.map((c) => veloSideNavItem(c.slug, c.label, activeSlug)).join('')
  const libLinks = library.map((c) => veloSideNavItem(c.slug, c.label, activeSlug)).join('')
  return `<aside class="vp-side" aria-label="Settings">
    <div class="vp-side-label">Preferences</div>
    ${prefLinks}
    <div class="vp-side-label">Library</div>
    ${libLinks}
  </aside>`
}

export function veloFramedPageHtml(
  title: string,
  options: {
    sidebarHtml: string
    mainHtml: string
    extraStyle?: string
  }
): string {
  const body = `<div class="vp-root">
    <div class="vp-body">
      ${options.sidebarHtml}
      <main class="vp-main"><div class="vp-main-inner">${options.mainHtml}</div></main>
    </div>
  </div>`
  return veloPageHtml(title, body, VEL_FRAME_STYLE + (options.extraStyle ?? ''))
}

export function veloPageHtml(
  title: string,
  body: string,
  extraStyle = '',
  chromeTheme?: BrowserChromeTheme,
  htmlAttrs: Record<string, string> = {}
): string {
  const t = chromeTheme ?? getSettings().browserChromeTheme
  const safeTitle = escapeHtml(title)
  const safeThemeColor = escapeHtml(metaThemeColorForBrowserTheme(t))
  const safeChrome = escapeHtml(t)
  const extraHtmlAttrs = Object.entries(htmlAttrs)
    .map(([k, v]) => ` ${escapeHtml(k)}="${escapeHtml(v)}"`)
    .join('')
  return `<!DOCTYPE html>
<html lang="en" data-chrome-theme="${safeChrome}"${extraHtmlAttrs}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="${safeThemeColor}" />
  <title>${safeTitle}</title>
  <style>${VEL_BASE_STYLE}${VEL_APPEARANCE_THEME_CSS}${extraStyle}</style>
</head>
<body>${body}</body>
</html>`
}
