import { veloFramedPageHtml, veloSettingsSidebarHtml } from './layout.js'
import { DEFAULT_BOOKMARK_FOLDER_ID } from '../../shared/ipc.js'

const BOOKMARKS_MAIN = `<p class="vp-lead">Organize saved pages into folders. Deleting a folder moves its bookmarks into <strong>Bookmarks</strong>.</p>
<style>
  .vp-bm-toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 1rem; }
  .vp-bm-folder { margin-top: 1.35rem; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--card); }
  .vp-bm-folder-head {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
    padding: 0.65rem 0.85rem; background: rgba(255,255,255,0.04); border-bottom: 1px solid var(--border);
  }
  .vp-bm-folder-title { font-weight: 600; font-size: 0.9rem; margin: 0; }
  .vp-bm-folder-actions { display: flex; gap: 0.35rem; flex-shrink: 0; }
  .vp-bm-folder-actions button { margin: 0; font-size: 0.8rem; padding: 0.35rem 0.55rem; min-height: 36px; }
  .vp-bm-list { list-style: none; margin: 0; padding: 0; }
  .vp-bm-row {
    display: flex; align-items: center; gap: 0.65rem; padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border); min-height: 48px;
  }
  .vp-bm-row:last-child { border-bottom: none; }
  .vp-bm-ico {
    width: 22px; height: 22px; flex-shrink: 0; border-radius: 4px;
    object-fit: contain; background: rgba(255,255,255,0.06);
  }
  .vp-bm-ico--ph { display: grid; place-items: center; font-size: 0.65rem; color: var(--muted); }
  .vp-bm-main { flex: 1; min-width: 0; }
  .vp-bm-main a { font-weight: 500; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vp-bm-url { font-size: 0.75rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; word-break: break-all; }
  .vp-bm-meta { font-size: 0.72rem; color: var(--muted); margin-top: 0.15rem; }
  .vp-bm-del { margin: 0; flex-shrink: 0; padding: 0.35rem 0.5rem; min-height: 36px; font-size: 0.78rem; }
  .vp-bm-empty { padding: 1rem 0.85rem; color: var(--muted); font-size: 0.88rem; margin: 0; }
</style>
<div class="vp-bm-toolbar">
  <button type="button" id="vp-bm-new-folder">New folder…</button>
</div>
<div id="vp-bm-root"></div>
<script>
  (function () {
    var api = window.veloPage;
    var DEFAULT_ID = ${JSON.stringify(DEFAULT_BOOKMARK_FOLDER_ID)};
    function el(id) { return document.getElementById(id); }
    function formatWhen(ts) {
      try { return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
      catch (e) { return ''; }
    }
    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    }
    async function load() {
      var root = el('vp-bm-root');
      if (!api || !root) return;
      var lib = await api.getBookmarksLibrary();
      var folders = lib.folders || [];
      var bookmarks = lib.bookmarks || [];
      var byFolder = {};
      for (var i = 0; i < folders.length; i++) {
        byFolder[folders[i].id] = [];
      }
      for (var j = 0; j < bookmarks.length; j++) {
        var b = bookmarks[j];
        var fid = b.folderId || DEFAULT_ID;
        if (!byFolder[fid]) byFolder[fid] = [];
        byFolder[fid].push(b);
      }
      var html = '';
      for (var f = 0; f < folders.length; f++) {
        var folder = folders[f];
        var rows = byFolder[folder.id] || [];
        var isDefault = folder.id === DEFAULT_ID;
        var headExtra = '';
        if (!isDefault) {
          headExtra = '<div class="vp-bm-folder-actions">' +
            '<button type="button" class="vp-bm-rm-folder" data-folder-id="' + esc(folder.id) + '" title="Delete folder (bookmarks move to Bookmarks)">Delete folder</button>' +
            '</div>';
        }
        html += '<section class="vp-bm-folder"><div class="vp-bm-folder-head">' +
          '<h3 class="vp-bm-folder-title">' + esc(folder.name) + '</h3>' + headExtra + '</div>';
        if (!rows.length) {
          html += '<p class="vp-bm-empty">No bookmarks in this folder.</p>';
        } else {
          html += '<ul class="vp-bm-list">';
          for (var r = 0; r < rows.length; r++) {
            var x = rows[r];
            var ico = x.favicon
              ? '<img class="vp-bm-ico" src="' + esc(x.favicon) + '" alt="" width="22" height="22" referrerpolicy="no-referrer" />'
              : '<span class="vp-bm-ico vp-bm-ico--ph" aria-hidden>◆</span>';
            html += '<li class="vp-bm-row">' + ico +
              '<div class="vp-bm-main"><a href="' + esc(x.url) + '">' + esc(x.title || x.url) + '</a>' +
              '<div class="vp-bm-url">' + esc(x.url) + '</div>' +
              '<div class="vp-bm-meta">Saved ' + esc(formatWhen(x.createdAt)) + '</div></div>' +
              '<button type="button" class="vp-bm-del" data-bm-id="' + esc(x.id) + '">Remove</button></li>';
          }
          html += '</ul>';
        }
        html += '</section>';
      }
      root.innerHTML = html;
      root.querySelectorAll('.vp-bm-del').forEach(function (btn) {
        btn.onclick = async function () {
          var id = btn.getAttribute('data-bm-id');
          if (!id || !api) return;
          await api.removeBookmark(id);
          await load();
        };
      });
      root.querySelectorAll('.vp-bm-rm-folder').forEach(function (btn) {
        btn.onclick = async function () {
          var fid = btn.getAttribute('data-folder-id');
          if (!fid || !api) return;
          if (!confirm('Delete this folder? Bookmarks inside will move to Bookmarks.')) return;
          await api.removeBookmarkFolder(fid);
          await load();
        };
      });
    }
    el('vp-bm-new-folder').onclick = async function () {
      if (!api) return;
      var name = window.prompt('Folder name');
      if (name == null) return;
      var t = name.trim();
      if (!t) return;
      await api.addBookmarkFolder(t);
      await load();
    };
    load();
  })();
</script>`

export function renderBookmarksPage(): string {
  return veloFramedPageHtml('Bookmarks', {
    sidebarHtml: veloSettingsSidebarHtml('bookmarks'),
    mainHtml: BOOKMARKS_MAIN
  })
}
