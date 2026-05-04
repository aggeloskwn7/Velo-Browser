import { veloFramedPageHtml, veloSettingsSidebarHtml } from './layout.js'

const HISTORY_EXTRA = `
  .hist-toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .hist-search-wrap {
    width: 100%;
    max-width: min(400px, 100%);
    margin-bottom: 0.85rem;
  }
  .hist-search {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 0.55rem 0.85rem;
    min-height: var(--tap);
    font: inherit;
    font-size: 0.9rem;
    color: var(--fg);
    background: var(--vel-input-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    -webkit-appearance: none;
    appearance: none;
  }
  .hist-search::placeholder {
    color: var(--muted);
    opacity: 1;
  }
  .hist-search:hover:not(:focus) {
    border-color: color-mix(in srgb, var(--muted) 35%, var(--border));
  }
  .hist-search:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .hist-select-all-wrap {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    cursor: pointer;
    user-select: none;
    font-size: 0.9rem;
    line-height: 1.2;
    color: var(--fg);
    margin: 0;
  }
  .hist-select-all-wrap .vp-check-sm {
    margin: 0;
    flex-shrink: 0;
    align-self: center;
  }
  .hist-del-btn {
    margin-top: 0;
  }
  .hist-root { margin: 0; }
  .hist-day { margin-bottom: 1.25rem; }
  .hist-day:last-child { margin-bottom: 0; }
  .hist-day-h {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin: 0 0 0.5rem;
    padding: 0 2px;
  }
  .hist-day:first-child .hist-day-h { margin-top: 0; }
  .hist-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--card);
  }
  .hist-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px 0 12px;
    border-bottom: 1px solid var(--border);
    min-height: 48px;
  }
  .hist-row:last-child { border-bottom: none; }
  .hist-favicon {
    flex-shrink: 0;
    align-self: center;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    object-fit: contain;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border);
  }
  .hist-cb.vp-check-sm {
    width: 1.125rem;
    height: 1.125rem;
    margin: 0;
    flex-shrink: 0;
    align-self: center;
    border-radius: 6px;
  }
  .hist-hit {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 8px 10px 0;
    text-decoration: none;
    color: inherit;
    border: none;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  a.hist-hit:hover .hist-title {
    color: var(--accent);
    text-decoration: underline;
  }
  .hist-line1 {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 0.65rem;
    flex-wrap: wrap;
  }
  .hist-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .hist-domain {
    font-size: 0.82rem;
    color: var(--muted);
    flex-shrink: 0;
  }
  .hist-time {
    flex-shrink: 0;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .hist-empty {
    color: var(--muted);
    font-size: 0.9rem;
    padding: 1.25rem 0;
  }
`

const HISTORY_MAIN = `<p class="vp-lead">Recent visits are stored locally on your device.</p>
<div class="hist-search-wrap">
  <input type="search" id="histSearch" class="hist-search" placeholder="Search by title, URL, or site" autocomplete="off" enterkeyhint="search" aria-label="Search history" />
</div>
<div class="hist-toolbar">
  <label class="hist-select-all-wrap">
    <input type="checkbox" class="vp-check-sm" id="histSelectAll" aria-label="Select all entries" />
    <span>Select all</span>
  </label>
  <button type="button" class="hist-del-btn" id="histDelete" disabled>Delete selected</button>
</div>
<div id="histRoot" class="hist-root" aria-live="polite"><p class="hist-empty">Loading…</p></div>
<script>
(function () {
  var api = window.veloPage;
  var root = document.getElementById('histRoot');
  var selAll = document.getElementById('histSelectAll');
  var delBtn = document.getElementById('histDelete');
  var searchEl = document.getElementById('histSearch');var allRows = [];

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function localDayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function sameLocalDay(aTs, bTs) {
    return localDayKey(aTs) === localDayKey(bTs);
  }

  function isToday(ts) {
    return sameLocalDay(ts, Date.now());
  }

  function isYesterday(ts) {
    var t = new Date();
    t.setDate(t.getDate() - 1);
    return sameLocalDay(ts, t.getTime());
  }

  function groupHeading(ts) {
    if (isToday(ts)) return 'Today';
    if (isYesterday(ts)) return 'Yesterday';
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function displayHost(url) {
    try {
      var u = new URL(url);
      return (u.hostname || '').replace(/^www\\./i, '') || '';
    } catch (e) {
      return '';
    }
  }function tabTitle(h) {
    var t = (h.title || '').trim();
    if (t) return t;
    try {
      var u = new URL(h.url);
      if (u.hostname) return u.hostname;
    } catch (e) {}
    return 'Untitled page';
  }

  var HIST_FAVICON_PLACE = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" rx="5" fill="%232a2a38"/></svg>'
  );

  function faviconSrc(url) {
    try {
      var u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return HIST_FAVICON_PLACE;
      if (!u.hostname) return HIST_FAVICON_PLACE;
      return (
        'https://www.google.com/s2/favicons?sz=32&domain=' + encodeURIComponent(u.hostname)
      );
    } catch (e) {
      return HIST_FAVICON_PLACE;
    }
  }

  function bindFaviconFallback() {
    root.querySelectorAll('.hist-favicon').forEach(function (img) {
      img.addEventListener(
        'error',
        function () {
          if (img.getAttribute('data-fallback') === '1') return;
          img.setAttribute('data-fallback', '1');
          img.src = HIST_FAVICON_PLACE;
        },
        { once: true }
      );
    });
  }

  function syncSelectAllState() {
    var cbs = root.querySelectorAll('.hist-cb');
    var n = cbs.length;
    if (n === 0) {
      selAll.checked = false;
      selAll.indeterminate = false;
      delBtn.disabled = true;
      return;
    }
    var checked = 0;
    for (var i = 0; i < cbs.length; i++) {
      if (cbs[i].checked) checked++;
    }
    selAll.checked = checked === n;
    selAll.indeterminate = checked > 0 && checked < n;
    delBtn.disabled = checked === 0;
  }

  function bindRowCbs() {
    root.querySelectorAll('.hist-cb').forEach(function (cb) {
      cb.addEventListener('change', syncSelectAllState);
    });
  }

  function rowMatchesQuery(h, qLower) {
    if (!qLower) return true;
    var title = (tabTitle(h) || '').toLowerCase();
    var url = (h.url || '').toLowerCase();
    var host = displayHost(h.url).toLowerCase();
    return title.indexOf(qLower) >= 0 || url.indexOf(qLower) >= 0 || host.indexOf(qLower) >= 0;
  }

  function applyFilter() {
    var q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    if (!allRows.length) {
      render([], false);
      return;
    }
    var filtered = q ? allRows.filter(function (h) { return rowMatchesQuery(h, q); }) : allRows.slice();
    if (!filtered.length) {
      render([], true);
      return;
    }
    render(filtered, false);
  }

  function render(rows, filteredNoMatch) {
    if (!rows.length) {
      var msg = filteredNoMatch ? 'No entries match your search.' : 'No history yet.';
      root.innerHTML = '<p class="hist-empty">' + msg + '</p>';
      selAll.checked = false;
      selAll.indeterminate = false;
      delBtn.disabled = true;
      return;
    }

    var groups = [];
    var lastKey = null;
    for (var i = 0; i < rows.length; i++) {
      var h = rows[i];
      var k = localDayKey(h.visitedAt);
      if (k !== lastKey) {
        lastKey = k;
        groups.push({ ts: h.visitedAt, items: [] });
      }
      groups[groups.length - 1].items.push(h);
    }

    var html = '';
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g];
      html += '<section class="hist-day" aria-label="' + esc(groupHeading(grp.ts)) + '">';
      html += '<h3 class="hist-day-h">' + esc(groupHeading(grp.ts)) + '</h3>';
      html += '<ul class="hist-list">';
      for (var j = 0; j < grp.items.length; j++) {
        var row = grp.items[j];
        var safeUrl = esc(row.url);
        var title = esc(tabTitle(row));
        var host = esc(displayHost(row.url));
        var timeStr = new Date(row.visitedAt).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit'
        });
        var iconUrl = esc(faviconSrc(row.url));
        html += '<li class="hist-row">';
        html +=
          '<input type="checkbox" class="hist-cb vp-check-sm" data-id="' +
          esc(row.id) +
          '" aria-label="Select ' +
          title +
          '" />';
        html +=
          '<img class="hist-favicon" src="' +
          iconUrl +
          '" width="20" height="20" alt="" decoding="async" loading="lazy" />';
        html += '<a class="hist-hit" href="' + safeUrl + '">';
        html += '<span class="hist-line1">';
        html += '<span class="hist-title">' + title + '</span>';
        if (host) html += '<span class="hist-domain">' + host + '</span>';
        html += '</span>';
        html += '<span class="hist-time">' + esc(timeStr) + '</span>';
        html += '</a></li>';
      }
      html += '</ul></section>';
    }
    root.innerHTML = html;
    bindFaviconFallback();
    bindRowCbs();
    selAll.checked = false;
    selAll.indeterminate = false;
    syncSelectAllState();
  }

  function load() {
    if (!api) {
      root.innerHTML = '<p class="hist-empty">History is unavailable in this view.</p>';
      return;
    }
    api
      .getHistory(2000)
      .then(function (rows) {
        allRows = rows || [];
        applyFilter();
      })
      .catch(function () {
        allRows = [];
        root.innerHTML = '<p class="hist-empty">Could not load history.</p>';
      });
  }

  if (searchEl) {
    searchEl.addEventListener('input', function () {
      applyFilter();
    });
  }

  selAll.addEventListener('change', function () {
    var on = selAll.checked;
    root.querySelectorAll('.hist-cb').forEach(function (cb) {
      cb.checked = on;
    });
    selAll.indeterminate = false;
    syncSelectAllState();
  });

  delBtn.addEventListener('click', function () {
    if (!api) return;
    var ids = [];
    root.querySelectorAll('.hist-cb:checked').forEach(function (cb) {
      ids.push(cb.getAttribute('data-id'));
    });
    if (!ids.length) return;
    api
      .removeHistoryEntries(ids)
      .then(function () {
        return load();
      })
      .catch(function () {});
  });

  load();
})();
</script>`

export function renderHistoryPage(): string {
  return veloFramedPageHtml('History', {
    sidebarHtml: veloSettingsSidebarHtml('history'),
    mainHtml: HISTORY_MAIN,
    extraStyle: HISTORY_EXTRA
  })
}
