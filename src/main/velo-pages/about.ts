import { app } from 'electron'
import { manager as tabManager } from '../tab-manager.js'
import { escapeHtml, veloPageHtml } from './layout.js'
import { getSettings } from '../settings-store.js'

const FEATURES = [
  'Multi-tab browsing with optional session restore on startup',
  'Workspaces for separate tab collections in one window',
  'Pinned tabs that stay open across restarts',
  'Tab mute and unpin from the tab context menu',
  'Smart omnibar with history, bookmarks, open tabs, and web suggestions',
  'Bookmarks with folders and quick save from the toolbar',
  'Full browsing history with search and selective delete',
  'Downloads manager with open, reveal, and clear browsing data integration',
  'Password manager with OS-protected encryption, autofill, and CSV import/export',
  'Clear browsing data for history, cookies, cache, passwords, and downloads',
  'Import history, bookmarks, and downloads from Chromium-based browsers',
  'Custom new tab page with draggable shortcuts and solid or photo backgrounds',
  'Privacy settings with configurable ad blocking and site allowlist',
  'Performance controls for background tabs, battery mode, and pinned sites',
  'Appearance themes and customizable browser chrome',
  'Register Velo as your system default browser',
  'Automatic updates through GitHub Releases',
  'Cross-platform installers for Windows, macOS, and Linux',
  'Built-in developer tools for pages and the Velo shell UI'
]

const ABOUT_STYLE = `
  body:has(.about-root) {
    margin: 0;
    padding: 0;
    min-height: 100dvh;
    overflow-x: hidden;
  }
  .about-root {
    position: relative;
    min-height: 100dvh;
    padding:
      max(2.5rem, env(safe-area-inset-top))
      max(1.25rem, env(safe-area-inset-right))
      max(2.5rem, env(safe-area-inset-bottom))
      max(1.25rem, env(safe-area-inset-left));
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .about-root::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background:
      radial-gradient(ellipse 90% 60% at 50% -15%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 55%),
      radial-gradient(ellipse 50% 40% at 100% 100%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 50%);
  }
  .about-shell {
    position: relative;
    z-index: 1;
    width: min(680px, 100%);
  }
  .about-hero {
    text-align: center;
    margin-bottom: 2rem;
  }
  .about-logo {
    width: min(72px, 18vw);
    height: auto;
    margin: 0 auto 1rem;
    display: block;
    filter: drop-shadow(0 10px 24px color-mix(in srgb, var(--accent) 25%, transparent));
  }
  .about-title {
    margin: 0;
    font-size: clamp(1.75rem, 6vw, 2.35rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--fg);
    line-height: 1.15;
  }
  .about-version {
    margin: 0.45rem auto 0;
    font-size: clamp(0.95rem, 3vw, 1.05rem);
    font-weight: 500;
    color: var(--muted);
    letter-spacing: 0.02em;
    text-align: center;
    width: 100%;
  }
  .about-grid {
    display: grid;
    gap: 0.85rem;
  }
  @media (min-width: 560px) {
    .about-grid {
      grid-template-columns: 1fr 1fr;
    }
    .about-grid .about-panel--wide {
      grid-column: 1 / -1;
    }
  }
  .about-panel {
    background: color-mix(in srgb, var(--card) 96%, var(--bg-elevated));
    border: 1px solid color-mix(in srgb, var(--border) 88%, var(--accent));
    border-radius: 14px;
    padding: 1.1rem 1.2rem;
    box-shadow: 0 1px 0 color-mix(in srgb, var(--fg) 4%, transparent);
  }
  .about-panel h2 {
    margin: 0 0 0.75rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--accent) 75%, var(--muted));
  }
  .about-stack {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .about-stack li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    padding: 0.42rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    font-size: 0.9rem;
    color: var(--fg);
  }
  .about-stack li:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .about-stack li span:first-child {
    color: var(--muted);
    font-size: 0.84rem;
  }
  .about-stack li span:last-child {
    font-weight: 550;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .about-stats {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .about-stat {
    flex: 1 1 7rem;
    padding: 0.75rem 0.85rem;
    border-radius: 10px;
    background: color-mix(in srgb, var(--vel-input-bg, var(--bg-elevated)) 80%, var(--card));
    border: 1px solid var(--border);
  }
  .about-stat__val {
    display: block;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .about-stat__lbl {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .about-features {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.45rem;
  }
  .about-features li {
    position: relative;
    padding: 0 0 0 1.05rem;
    border: none;
    font-size: 0.875rem;
    line-height: 1.45;
    color: color-mix(in srgb, var(--fg) 92%, var(--muted));
  }
  .about-features li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.55em;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.85;
  }
  .about-links {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .about-links li {
    padding: 0.35rem 0;
    border: none;
  }
  .about-links a {
    font-size: 0.9rem;
    font-weight: 550;
    color: var(--accent);
    text-decoration: none;
  }
  .about-links a:hover {
    text-decoration: underline;
  }
  .about-links small {
    display: block;
    margin-top: 0.12rem;
    font-size: 0.78rem;
    color: var(--muted);
    font-weight: 400;
  }
  .about-foot {
    margin-top: 1.75rem;
    text-align: center;
    font-size: 0.8rem;
    color: var(--muted);
    letter-spacing: 0.01em;
  }
`

function buildRuntimeInfo(): {
  appVersion: string
  chromium: string
  electron: string
  node: string
  openTabs: number
  pinnedTabs: number
} {
  const snapshots = tabManager?.getSnapshots() ?? []
  return {
    appVersion: app.getVersion(),
    chromium: process.versions.chrome ?? '—',
    electron: process.versions.electron ?? '—',
    node: process.versions.node ?? '—',
    openTabs: snapshots.length,
    pinnedTabs: snapshots.filter((t) => t.pinned).length
  }
}

function featuresHtml(): string {
  return FEATURES.map((f) => `<li>${escapeHtml(f)}</li>`).join('')
}

export function renderAboutPage(): string {
  const info = buildRuntimeInfo()
  const body = `<div class="about-root">
  <div class="about-shell">
    <header class="about-hero">
      <img class="about-logo" src="velo:///Velo.png" alt="" width="72" height="72" decoding="async" />
      <h1 class="about-title">Velo Browser</h1>
      <p class="about-version">Version ${escapeHtml(info.appVersion)}</p>
    </header>
    <div class="about-grid">
      <section class="about-panel" aria-labelledby="about-built">
        <h2 id="about-built">Built with</h2>
        <ul class="about-stack">
          <li><span>Chromium</span><span>${escapeHtml(info.chromium)}</span></li>
          <li><span>Electron</span><span>${escapeHtml(info.electron)}</span></li>
          <li><span>Node.js</span><span>${escapeHtml(info.node)}</span></li>
        </ul>
      </section>
      <section class="about-panel" aria-labelledby="about-tabs">
        <h2 id="about-tabs">Tabs</h2>
        <div class="about-stats">
          <div class="about-stat">
            <span class="about-stat__val">${info.openTabs}</span>
            <span class="about-stat__lbl">Open tabs</span>
          </div>
          <div class="about-stat">
            <span class="about-stat__val">${info.pinnedTabs}</span>
            <span class="about-stat__lbl">Pinned tabs</span>
          </div>
        </div>
      </section>
      <section class="about-panel about-panel--wide" aria-labelledby="about-features">
        <h2 id="about-features">Features</h2>
        <ul class="about-features">${featuresHtml()}</ul>
      </section>
      <section class="about-panel" aria-labelledby="about-source">
        <h2 id="about-source">Source code</h2>
        <ul class="about-links">
          <li>
            <a href="https://github.com/aggeloskwn7/Velo-Browser" target="_blank" rel="noopener noreferrer">GitHub Repository</a>
            <small>Open source on GitHub</small>
          </li>
          <li>
            <a href="https://github.com/aggeloskwn7/Velo-Browser/blob/master/CHANGELOG.md" target="_blank" rel="noopener noreferrer">View Changelog</a>
            <small>Release notes and history</small>
          </li>
        </ul>
      </section>
      <section class="about-panel" aria-labelledby="about-links">
        <h2 id="about-links">Links</h2>
        <ul class="about-links">
          <li>
            <a href="https://github.com/aggeloskwn7" target="_blank" rel="noopener noreferrer">GitHub</a>
            <small>aggeloskwn7</small>
          </li>
          <li>
            <a href="https://github.com/aggeloskwn7/Velo-Browser/issues" target="_blank" rel="noopener noreferrer">Report an Issue</a>
            <small>Bug reports and feedback</small>
          </li>
        </ul>
      </section>
    </div>
    <p class="about-foot">Copyright © 2026 Velo Browser, aggeloskwn7</p>
  </div>
</div>`

  return veloPageHtml('About Velo', body, ABOUT_STYLE, getSettings().browserChromeTheme)
}
