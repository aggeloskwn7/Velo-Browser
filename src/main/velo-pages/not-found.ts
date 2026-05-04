import { escapeHtml, veloFramedPageHtml, veloSettingsSidebarHtml } from './layout.js'

export function renderNotFoundPage(route: string): string {
  const safe = escapeHtml(route)
  const main = `<p class="vp-lead">No Velo page for <code>${safe}</code>.</p>
<p><a href="velo://newtab">velo://newtab</a></p>`
  return veloFramedPageHtml('Not found', {
    sidebarHtml: veloSettingsSidebarHtml(''),
    mainHtml: main
  })
}
