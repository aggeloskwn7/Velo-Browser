import { veloFramedPageHtml, veloSettingsSidebarHtml } from './layout.js'


const DOWNLOADS_PAGE_EXTRA = `
  .dl-page-wrap { width: 100%; max-width: min(680px, 100%); margin: 0 auto; }
  .dl-page-panel {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.32);
    overflow: hidden;
    font-size: 13px;
    line-height: 1.4;
  }
  .dl-page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  .dl-page-title {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
    letter-spacing: normal;
  }
  .dl-page-list {
    list-style: none;
    margin: 0;
    padding: 2px 0;
    max-height: min(70dvh, 520px);
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .dl-page-list::-webkit-scrollbar { width: 6px; }
  .dl-page-list::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }
  .dl-page-row {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  .dl-page-row:last-child { border-bottom: none; }
  .dl-page-row-top {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .dl-page-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--fg);
    font-size: 13px;
    font-weight: 400;
  }
  .dl-page-show {
    flex-shrink: 0;
    margin: 0;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    min-height: 0;
    transition: color 0.14s ease, background 0.14s ease;
  }
  .dl-page-show:hover {
    color: var(--fg);
    background: rgba(255, 255, 255, 0.08);
  }
  .dl-page-bar {
    margin-top: 8px;
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }
  .dl-page-bar > span {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: var(--accent);
    transition: width 0.2s ease;
  }
  .dl-page-bar.is-muted > span { background: var(--muted); }
  .dl-page-sub {
    margin: 6px 0 0;
    padding: 0;
    font-size: 12px;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dl-page-row.is-struck .dl-page-name {
    text-decoration: line-through;
    opacity: 0.72;
  }
  .dl-page-row.is-struck .dl-page-sub { opacity: 0.78; }
  .dl-page-row--openable { cursor: pointer; }
  .dl-page-row--openable:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  html[data-chrome-theme='white'] .dl-page-row--openable:hover {
    background: rgba(0, 0, 0, 0.04);
  }
  .dl-page-empty {
    border: none !important;
    color: var(--muted);
    text-align: center;
    padding: 1.25rem 12px !important;
    font-size: 13px;
  }
  .dl-page-empty-err { color: #ff8a80; }
`

const DOWNLOADS_MAIN = `<p class="vp-lead">Files from the web appear here after each download.</p>
<div class="dl-page-wrap">
  <div class="dl-page-panel">
    <div class="dl-page-header">
      <h1 class="dl-page-title">Recent</h1>
    </div>
    <ul id="dlList" class="dl-page-list"><li class="dl-page-empty">Loading…</li></ul>
  </div>
</div>
<script>
(function () {
  var api = window.veloPage;
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }
  function formatBytes(n) {
    if (n == null || !isFinite(n) || n < 0) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function pct(r, t) {
    if (!t || t <= 0) return 0;
    return Math.min(100, Math.round((100 * r) / t));
  }
  function stateLabel(st, fileGone) {
    if (fileGone) return 'Deleted';
    if (st === 'completed') return 'Done';
    if (st === 'cancelled') return 'Stopped';
    if (st === 'interrupted') return 'Failed';
    if (st === 'progressing') return 'Downloading';
    return st || '';
  }
  function render(rows) {
    var el = document.getElementById('dlList');
    if (!el) return;
    if (!api) {
      el.innerHTML = '<li class="dl-page-empty dl-page-empty-err">Internal API unavailable.</li>';
      return;
    }
    if (!rows.length) {
      el.innerHTML = '<li class="dl-page-empty">No downloads yet.</li>';
      return;
    }
    el.innerHTML = rows
      .map(function (d) {
        var st = d.state || '';
        var struck = d.fileRemovedFromDisk || st === 'cancelled' || st === 'interrupted';
        var rowCls = 'dl-page-row' + (struck ? ' is-struck' : '');
        var showBtn =
          d.path && st === 'completed' && !d.fileRemovedFromDisk
            ? '<button type="button" class="dl-page-show" data-path="' + encodeURIComponent(d.path) + '">Show in folder</button>'
            : '';
        var prog =
          st === 'progressing' && d.totalBytes > 0
            ? '<div class="dl-page-bar"><span style="width:' + pct(d.receivedBytes, d.totalBytes) + '%"></span></div>'
            : '';
        var sizePart =
          formatBytes(d.receivedBytes) +
          (d.totalBytes > 0 ? ' / ' + formatBytes(d.totalBytes) : '');
        var stText = stateLabel(st, d.fileRemovedFromDisk);
        var sub = [stText, sizePart].join(' · ');
        var canOpen = st === 'completed' && !d.fileRemovedFromDisk && d.path;
        var openCls = canOpen ? ' dl-page-row--openable' : '';
        return (
          '<li class="' +
          rowCls +
          openCls +
          '" data-dl-id="' +
          esc(d.id) +
          '">' +
          '<div class="dl-page-row-top">' +
          '<div class="dl-page-name" title="' +
          esc(d.filename) +
          '">' +
          esc(d.filename) +
          '</div>' +
          showBtn +
          '</div>' +
          prog +
          '<p class="dl-page-sub" title="' +
          esc(sub) +
          '">' +
          esc(sub) +
          '</p>' +
          '</li>'
        );
      })
      .join('');
  }
  function load() {
    if (!api) {
      var missing = document.getElementById('dlList');
      if (missing) missing.innerHTML = '<li class="dl-page-empty dl-page-empty-err">Internal API unavailable.</li>';
      return;
    }
    api.getDownloads().then(render).catch(function () {
      var el = document.getElementById('dlList');
      if (el) el.innerHTML = '<li class="dl-page-empty dl-page-empty-err">Could not load downloads.</li>';
    });
  }
  document.getElementById('dlList').addEventListener('dblclick', function (e) {
    var row = e.target && e.target.closest && e.target.closest('.dl-page-row[data-dl-id]');
    if (!row || !api) return;
    if (!row.classList.contains('dl-page-row--openable')) return;
    var id = row.getAttribute('data-dl-id');
    if (!id) return;
    void api.openDownloadFile(id);
  });
  document.getElementById('dlList').addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.dl-page-show');
    if (!btn || !api) return;
    var raw = btn.getAttribute('data-path');
    if (!raw) return;
    try {
      var p = decodeURIComponent(raw);
      void api.revealDownloadInFolder(p);
    } catch (err) {}
  });
  load();
})();
</script>`

export function renderDownloadsPage(): string {
  return veloFramedPageHtml('Downloads', {
    sidebarHtml: veloSettingsSidebarHtml('downloads'),
    mainHtml: DOWNLOADS_MAIN,
    extraStyle: DOWNLOADS_PAGE_EXTRA
  })
}
