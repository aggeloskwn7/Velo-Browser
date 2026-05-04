

const ERR_ABORTED = -3
/** Chromium net::ERR_BLOCKED_BY_CLIENT — navigation or subresource blocked (e.g. Velo ad blocker). */
const ERR_BLOCKED_BY_CLIENT = -20

export function isLoadFailureIgnored(errorCode: number): boolean {
  return errorCode === ERR_ABORTED
}

export function isOurErrorPageUrl(url: string): boolean {
  return url.startsWith('data:text/html')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function errorCopy(
  errorCode: number,
  errorDescription: string
): { title: string; body: string; codeLabel: string; adblockBlocked?: boolean } {
  const desc = (errorDescription || '').trim()
  const errToken = /^ERR_[A-Z0-9_]+$/.test(desc) ? desc : ''

  if (
    desc.includes('ERR_BLOCKED_BY_CLIENT') ||
    errorCode === ERR_BLOCKED_BY_CLIENT ||
    errorCode === -20
  ) {
    return {
      title: 'Blocked by the ad blocker',
      body: "Velo's ad blocker stopped this navigation. That can happen when a strict filter matches the main page request. Try lowering the block level, or add this site's hostname under Privacy → Ad block allowlist.",
      codeLabel: errToken || 'ERR_BLOCKED_BY_CLIENT',
      adblockBlocked: true
    }
  }
  if (desc.includes('ERR_CONNECTION_REFUSED') || errorCode === -102) {
    return {
      title: "This site can't be reached",
      body: 'The connection was refused by the server.',
      codeLabel: errToken || 'ERR_CONNECTION_REFUSED'
    }
  }
  if (desc.includes('ERR_NAME_NOT_RESOLVED') || errorCode === -105) {
    return {
      title: "This site can't be reached",
      body: "The server's DNS address could not be found.",
      codeLabel: errToken || 'ERR_NAME_NOT_RESOLVED'
    }
  }
  if (desc.includes('ERR_CONNECTION_TIMED_OUT') || errorCode === -118) {
    return {
      title: 'This site took too long to respond',
      body: 'The server may be overloaded or the network may be slow.',
      codeLabel: errToken || 'ERR_CONNECTION_TIMED_OUT'
    }
  }
  if (desc.includes('ERR_CONNECTION_RESET') || errorCode === -101) {
    return {
      title: "This site can't be reached",
      body: 'The connection was reset.',
      codeLabel: errToken || 'ERR_CONNECTION_RESET'
    }
  }
  if (desc.includes('ERR_INTERNET_DISCONNECTED')) {
    return {
      title: 'No internet',
      body: 'Try checking your network connection.',
      codeLabel: errToken || 'ERR_INTERNET_DISCONNECTED'
    }
  }
  if (desc.includes('ERR_ADDRESS_UNREACHABLE')) {
    return {
      title: "This site can't be reached",
      body: 'The host was unreachable.',
      codeLabel: errToken || 'ERR_ADDRESS_UNREACHABLE'
    }
  }
  if (desc.includes('ERR_SSL') || desc.includes('ERR_CERT')) {
    return {
      title: 'Your connection is not private',
      body: 'The site may not be secure or your network may be intercepting the connection.',
      codeLabel: errToken || desc.slice(0, 64) || 'SSL error'
    }
  }

  return {
    title: "This site can't be reached",
    body: desc || 'Something went wrong while loading this page.',
    codeLabel: errToken || `NET_ERROR_${errorCode}`
  }
}

export function buildNetworkErrorDataUrl(
  validatedURL: string,
  errorCode: number,
  errorDescription: string
): string {
  const copy = errorCopy(errorCode, errorDescription)
  const { title, body, codeLabel, adblockBlocked } = copy
  const urlDisplay = escapeHtml(validatedURL)
  const titleE = escapeHtml(title)
  const bodyE = escapeHtml(body)
  const codeE = escapeHtml(codeLabel)
  const tip = adblockBlocked
    ? 'Open Privacy settings to adjust blocking or exclude this site.'
    : 'Check that the address is correct and the service is running. Reload to try again.'
  const adblockExtra = adblockBlocked
    ? `<p class="detail"><a class="velo-link" href="velo://settings/privacy">Open Privacy &amp; ad blocking</a></p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="dark">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titleE}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #202124;
    color: #e8eaed;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    -webkit-font-smoothing: antialiased;
  }
  .card { max-width: 600px; width: 100%; }
  .icon {
    width: 72px; height: 72px; margin-bottom: 24px;
    opacity: 0.9;
  }
  h1 {
    font-size: 1.375rem;
    font-weight: 400;
    margin-bottom: 12px;
    line-height: 1.35;
  }
  .url {
    font-size: 0.8125rem;
    color: #9aa0a6;
    word-break: break-all;
    margin-bottom: 20px;
    line-height: 1.45;
  }
  p.detail {
    font-size: 0.9375rem;
    color: #bdc1c6;
    line-height: 1.55;
    margin-bottom: 12px;
  }
  p.tip {
    font-size: 0.8125rem;
    color: #80868b;
    line-height: 1.45;
    margin-bottom: 28px;
  }
  .code {
    font-size: 0.75rem;
    color: #5f6368;
    margin-bottom: 28px;
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", Consolas, monospace;
  }
  button {
    background: #8ab4f8;
    color: #202124;
    border: none;
    border-radius: 999px;
    padding: 10px 28px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }
  button:hover { background: #aecbfa; }
  a.velo-link {
    color: #8ab4f8;
    font-weight: 500;
    text-decoration: none;
  }
  a.velo-link:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="card">
    <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#9aa0a6" stroke-width="1.5"/>
      <path d="M8 8l8 8M16 8l-8 8" stroke="#9aa0a6" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <h1>${titleE}</h1>
    <div class="url">${urlDisplay}</div>
    <p class="detail">${bodyE}</p>
    ${adblockExtra}
    <p class="tip">${escapeHtml(tip)}</p>
    <div class="code">${codeE}</div>
    <button type="button" id="reload">Reload</button>
  </div>
  <script>
    document.getElementById('reload').addEventListener('click', function () {
      var u = ${JSON.stringify(validatedURL)};
      if (window.veloTab && typeof window.veloTab.retryNavigation === 'function') {
        window.veloTab.retryNavigation(u);
      }
    });
  </script>
</body>
</html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}
