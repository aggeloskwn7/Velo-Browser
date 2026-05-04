import { veloFramedPageHtml, veloSettingsSidebarHtml, escapeHtml } from './layout.js'
import { listBrowserBackgroundBasenames } from './browser-backgrounds.js'
import { NEW_TAB_BACKGROUND_PRESETS, type NewTabBackgroundPreset } from '../../shared/ipc.js'
import { NEW_TAB_PRESET_HEX } from './newtab-background.js'


export const SETTINGS_PANEL_SLUGS = [
  'appearance',
  'languages',
  'download-preferences',
  'privacy',
  'password-manager',
  'new-tab-page',
  'accessibility',
  'performance',
  'system',
  'default-browser'
] as const

export type SettingsPanelSlug = (typeof SETTINGS_PANEL_SLUGS)[number]

const PANEL_TITLE: Record<SettingsPanelSlug, string> = {
  appearance: 'Appearance',
  languages: 'Languages',
  'download-preferences': 'Download preferences',
  privacy: 'Privacy',
  'password-manager': 'Password Manager & Autofill',
  'new-tab-page': 'New Tab Page',
  accessibility: 'Accessibility',
  performance: 'Performance',
  system: 'System',
  'default-browser': 'Default browser'
}

export function parseSettingsRoute(route: string): SettingsPanelSlug | null {
  if (route === '/settings') return 'appearance'
  const prefix = '/settings/'
  if (!route.startsWith(prefix)) return null
  let slug = route.slice(prefix.length)
  if (!slug || slug.includes('/')) return null
  if (slug === 'browser-default') slug = 'default-browser'
  return (SETTINGS_PANEL_SLUGS as readonly string[]).includes(slug) ? (slug as SettingsPanelSlug) : null
}

function panelAppearance(): string {
  return `<h2 class="vp-set-h">Appearance</h2>
<p class="vp-set-note">Looks for the chrome and Velo pages. Changes apply immediately.</p>
<div class="card">
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="appearance-theme-label">Theme</div>
      <p class="vp-set-row__desc">Top bar, menus, and built-in pages such as settings, history, and new tab.</p>
    </div>
    <div class="vp-set-row__control">
      <select id="appearance-theme" aria-labelledby="appearance-theme-label">
        <option value="default">Default</option>
        <option value="white">White</option>
        <option value="black">Black</option>
        <option value="grey">Grey</option>
      </select>
    </div>
  </div>
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="engine-label">Default search engine</div>
      <p class="vp-set-row__desc">Used when you search from the address bar or new tab.</p>
    </div>
    <div class="vp-set-row__control">
      <select id="engine" aria-labelledby="engine-label">
        <option value="google">Google</option>
        <option value="bing">Bing</option>
        <option value="duckduckgo">DuckDuckGo</option>
        <option value="brave">Brave</option>
        <option value="ecosia">Ecosia</option>
      </select>
    </div>
  </div>
</div>
<script>
  (function(){
    var api = window.veloPage;
    function el(id){ return document.getElementById(id); }
    async function applyAppearance(){
      if (!api) return;
      await api.setSettings({
        browserChromeTheme: el('appearance-theme').value,
        searchEngine: el('engine').value
      });
    }
    async function load(){
      if (!api) return;
      var s = await api.getSettings();
      el('appearance-theme').value = s.browserChromeTheme;
      el('engine').value = s.searchEngine;
    }
    el('appearance-theme').onchange = function(){ void applyAppearance(); };
    el('engine').onchange = function(){ void applyAppearance(); };
    load();
  })();
</script>`
}

function panelLanguages(): string {
  return `<h2 class="vp-set-h">Languages</h2>
<p class="vp-set-note">Additional languages and controls will appear here as they ship.</p>
<div class="card">
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="ui-lang-label">Display language</div>
      <p class="vp-set-row__desc">Velo uses your system language until other languages are available.</p>
    </div>
    <div class="vp-set-row__control">
      <select id="ui-lang" aria-labelledby="ui-lang-label" disabled>
        <option>Match system (default)</option>
      </select>
    </div>
  </div>
</div>`
}

function panelDownloadPreferences(): string {
  return `<h2 class="vp-set-h">Download preferences</h2>
<p class="vp-set-note">Choose where Velo saves files from the web. By default this matches your system Downloads folder.</p>
<div class="card">
  <label for="download-path">Location</label>
  <div id="download-path" class="vp-download-path" role="status">—</div>
  <p id="download-hint" class="vp-set-note" style="margin-top:0.65rem"></p>
  <div class="vp-dl-actions">
    <button type="button" id="btn-change-download-dir">Change…</button>
    <button type="button" id="btn-reset-download-dir">Use default folder</button>
  </div>
  <p style="margin:1rem 0 0;max-width:none"><a href="velo://settings/downloads">View download list</a></p>
</div>
<script>
  (function(){
    var api = window.veloPage;
    function el(id){ return document.getElementById(id); }
    async function load(){
      if (!api) return;
      var s = await api.getSettings();
      var pathEl = el('download-path');
      pathEl.textContent = s.downloadDirectory;
      pathEl.title = s.downloadDirectory;
      el('download-hint').textContent = s.downloadLocationIsDefault
        ? 'Using the system Downloads folder. Click Change to pick another folder.'
        : 'Files are saved here. “Use default folder” restores the system Downloads folder.';
      el('btn-reset-download-dir').disabled = s.downloadLocationIsDefault;
    }
    el('btn-change-download-dir').onclick = async function changeDir(){
      if (!api) return;
      var picked = await api.pickDownloadFolder();
      if (!picked) return;
      await api.setSettings({ downloadDirectory: picked });
      await load();
    };
    el('btn-reset-download-dir').onclick = async function resetDir(){
      if (!api) return;
      await api.setSettings({ downloadDirectory: '' });
      await load();
    };
    load();
  })();
</script>`
}

function panelPrivacy(): string {
  return `<h2 class="vp-set-h">Privacy</h2>
<p class="vp-set-note">Control how Velo filters ads and trackers. The default is <strong>Medium</strong>. If a page looks broken (blank screen, login fails), add its hostname to the allowlist below or use the toast suggestion when Velo blocks many requests.</p>
<div class="card">
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="adblock-level-label">Ad blocking</div>
      <p class="vp-set-row__desc">Off turns off network blocking on all sites. Low uses a small allow-ads list. Medium balances privacy and compatibility. High is strictest (more filter lists) and breaks some sites — use the allowlist for those.</p>
    </div>
    <div class="vp-set-row__control">
      <select id="adblock-level" aria-labelledby="adblock-level-label">
        <option value="off">Off</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>
  </div>
</div>
<div class="card" style="margin-top:1rem">
  <h3 class="vp-set-h" style="font-size:1rem;margin:0 0 0.65rem">Ad block allowlist</h3>
  <p class="vp-set-note" style="margin-top:0">No ads or trackers are blocked on these sites (helpful when strict lists break something). Use the hostname only, e.g. <code>chatgpt.com</code> — not a full URL.</p>
  <label class="vp-pw-field" style="max-width:480px">Add site
    <input type="text" id="adblock-allow-input" placeholder="example.com" autocomplete="off" enterkeyhint="done" />
  </label>
  <div class="vp-pw-actions">
    <button type="button" id="adblock-allow-add">Add to allowlist</button>
  </div>
  <p id="adblock-allow-err" style="display:none;margin:0.5rem 0 0;color:var(--danger,#c62828);font-size:0.9rem"></p>
  <div id="adblock-allow-list" style="margin-top:0.75rem"></div>
</div>
<script>
(function(){
  var api = window.veloPage;
  function el(id){ return document.getElementById(id); }
  function normHost(raw){
    return String(raw || '').trim().toLowerCase().replace(/^https?:\\/\\//, '').replace(/\\/.*$/, '').replace(/^www\\./, '');
  }
  function showErr(t){
    var e = el('adblock-allow-err');
    if (!e) return;
    e.textContent = t || '';
    e.style.display = t ? 'block' : 'none';
  }
  function renderList(hosts){
    var box = el('adblock-allow-list');
    if (!box) return;
    box.innerHTML = '';
    if (!hosts || hosts.length === 0) {
      box.innerHTML = '<p class="vp-set-note" style="margin:0">None</p>';
      return;
    }
    hosts.slice().sort().forEach(function(h){
      var row = document.createElement('div');
      row.className = 'vp-pw-never-item';
      row.innerHTML = '<span></span><button type="button" class="adblock-allow-rm">Remove</button>';
      row.querySelector('span').textContent = h;
      row.querySelector('.adblock-allow-rm').onclick = async function(){
        if (!api) return;
        var next = hosts.filter(function(x){ return x !== h; });
        await api.setSettings({ adBlockAllowlistHostnames: next });
        await load();
      };
      box.appendChild(row);
    });
  }
  async function load(){
    if (!api) return;
    var s = await api.getSettings();
    el('adblock-level').value = s.adBlockLevel;
    renderList(s.adBlockAllowlistHostnames || []);
    showErr('');
  }
  el('adblock-level').onchange = async function(){
    if (!api) return;
    await api.setSettings({ adBlockLevel: el('adblock-level').value });
    await load();
  };
  el('adblock-allow-add').onclick = async function(){
    if (!api) return;
    var h = normHost(el('adblock-allow-input').value);
    if (!h) { showErr('Enter a hostname.'); return; }
    if (h.length > 253) { showErr('Hostname too long.'); return; }
    var s = await api.getSettings();
    var cur = s.adBlockAllowlistHostnames || [];
    if (cur.indexOf(h) >= 0) { showErr('Already on the list.'); return; }
    if (cur.length >= 80) { showErr('Allowlist is full (80 sites).'); return; }
    await api.setSettings({ adBlockAllowlistHostnames: cur.concat([h]) });
    el('adblock-allow-input').value = '';
    await load();
  };
  el('adblock-allow-input').addEventListener('keydown', function(ev){
    if (ev.key === 'Enter') { ev.preventDefault(); el('adblock-allow-add').click(); }
  });
  load();
})();
</script>`
}

function panelPasswordManager(): string {
  return `<h2 class="vp-set-h">Password Manager & Autofill</h2>
<p class="vp-set-note">Velo encrypts saved passwords on disk. Use a strong passphrase; you will need it to unlock this page and to save new passwords while browsing. Enable autofill below (on focus and/or Ctrl+Shift+L) while the vault is unlocked.</p>
<style>
  .vp-pw-field { display:block; margin:0.5rem 0; max-width:420px; }
  .vp-pw-field input { width:100%; margin-top:0.25rem; padding:0.45rem 0.5rem; box-sizing:border-box; }
  .vp-pw-actions { display:flex; flex-wrap:wrap; gap:0.5rem; margin:0.75rem 0; }
  .vp-pw-table-wrap { overflow-x:auto; width:100%; margin-top:0.75rem; -webkit-overflow-scrolling:touch; }
  .vp-pw-table { width:100%; border-collapse:collapse; font-size:0.9rem; table-layout:fixed; }
  .vp-pw-table th, .vp-pw-table td { text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid var(--border); vertical-align:middle; word-break:break-word; }
  .vp-pw-col-site { width:22%; }
  .vp-pw-col-user { width:22%; }
  .vp-pw-col-pass { width:36%; }
  .vp-pw-col-pass input { width:100%; max-width:100%; min-width:0; box-sizing:border-box; padding:0.35rem 0.45rem; }
  .vp-pw-col-act { width:20%; white-space:nowrap; text-align:right; }
  .vp-pw-col-act button { margin-left:0.35rem; }
  .vp-pw-never-item { display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding:0.35rem 0; border-bottom:1px solid var(--border); max-width:100%; }
  .vp-pw-search-label { display:block; font-size:0.875rem; font-weight:600; margin:1rem 0 0.35rem; color:var(--text); }
  .vp-pw-search { width:100%; max-width:480px; padding:0.5rem 0.65rem; box-sizing:border-box; border:1px solid var(--border); border-radius:8px; font-size:0.95rem; background:var(--vel-input-bg, var(--bg-elevated)); color:inherit; }
  .vp-pw-search::placeholder { color:var(--muted); }
</style>
<div class="card">
  <div id="vp-pw-setup" style="display:none">
    <p style="margin:0 0 0.75rem">Create your vault passphrase (minimum 4 characters).</p>
    <p id="vp-pw-setup-err" style="display:none;margin:0 0 0.5rem;color:var(--danger,#c62828);font-size:0.9rem"></p>
    <label class="vp-pw-field">Passphrase<input type="password" id="vp-pw-new1" autocomplete="off" /></label>
    <label class="vp-pw-field">Confirm<input type="password" id="vp-pw-new2" autocomplete="off" /></label>
    <div class="vp-set-row" style="margin-top:0.5rem">
      <div class="vp-set-row__text">
        <div class="vp-set-row__title" id="vp-pw-remember-create-label">Remember on this device</div>
        <p class="vp-set-row__desc">Unlock the vault automatically when you open Velo (stored with OS secure storage for this user only).</p>
      </div>
      <div class="vp-set-row__control">
        <input type="checkbox" class="vp-switch" id="vp-pw-remember-create" aria-labelledby="vp-pw-remember-create-label" />
      </div>
    </div>
    <div class="vp-pw-actions"><button type="button" id="vp-pw-create">Create vault</button></div>
  </div>
  <div id="vp-pw-locked" style="display:none">
    <label class="vp-pw-field">Passphrase<input type="password" id="vp-pw-unlock-pass" autocomplete="current-password" /></label>
    <div class="vp-set-row" style="margin-top:0.5rem">
      <div class="vp-set-row__text">
        <div class="vp-set-row__title" id="vp-pw-remember-unlock-label">Remember on this device</div>
        <p class="vp-set-row__desc">Skip this unlock step next time you start Velo (same secure storage as above).</p>
      </div>
      <div class="vp-set-row__control">
        <input type="checkbox" class="vp-switch" id="vp-pw-remember-unlock" aria-labelledby="vp-pw-remember-unlock-label" />
      </div>
    </div>
    <div class="vp-pw-actions"><button type="button" id="vp-pw-unlock">Unlock</button></div>
    <p id="vp-pw-unlock-err" style="margin:0.5rem 0 0;color:var(--danger,#c62828);font-size:0.9rem"></p>
  </div>
  <div id="vp-pw-main" style="display:none">
    <div class="vp-pw-actions">
      <button type="button" id="vp-pw-lock">Lock</button>
      <button type="button" id="vp-pw-import">Import CSV…</button>
      <button type="button" id="vp-pw-export">Export CSV…</button>
    </div>
    <div class="vp-set-row" style="margin-top:1rem">
      <div class="vp-set-row__text">
        <div class="vp-set-row__title" id="vp-pw-remember-device-label">Remember on this device</div>
        <p class="vp-set-row__desc">When off, you enter your passphrase after each launch and Velo forgets the saved device key.</p>
      </div>
      <div class="vp-set-row__control">
        <input type="checkbox" class="vp-switch" id="vp-pw-remember-device" aria-labelledby="vp-pw-remember-device-label" />
      </div>
    </div>
    <div class="vp-set-row" style="margin-top:1rem">
      <div class="vp-set-row__text">
        <div class="vp-set-row__title" id="vp-pw-offer-label">Offer to save passwords</div>
        <p class="vp-set-row__desc">Show the save bar on HTTPS pages when you sign in (vault must be unlocked).</p>
      </div>
      <div class="vp-set-row__control">
        <input type="checkbox" class="vp-switch" id="vp-pw-offer" aria-labelledby="vp-pw-offer-label" />
      </div>
    </div>
    <div class="vp-set-row">
      <div class="vp-set-row__text">
        <div class="vp-set-row__title" id="vp-pw-autofill-focus-label">Autofill on password focus</div>
        <p class="vp-set-row__desc">When the vault is unlocked, filling a matching site after you focus a password field (only if the field is still empty).</p>
      </div>
      <div class="vp-set-row__control">
        <input type="checkbox" class="vp-switch" id="vp-pw-autofill-focus" aria-labelledby="vp-pw-autofill-focus-label" />
      </div>
    </div>
    <div class="vp-set-row">
      <div class="vp-set-row__text">
        <div class="vp-set-row__title" id="vp-pw-autofill-hotkey-label">Autofill hotkey (Ctrl+Shift+L)</div>
        <p class="vp-set-row__desc">When the vault is unlocked, fills the first saved login for this site; can overwrite fields.</p>
      </div>
      <div class="vp-set-row__control">
        <input type="checkbox" class="vp-switch" id="vp-pw-autofill-hotkey" aria-labelledby="vp-pw-autofill-hotkey-label" />
      </div>
    </div>
    <h3 class="vp-set-h" style="font-size:1rem;margin:1.25rem 0 0">Saved passwords</h3>
    <label class="vp-pw-search-label" for="vp-pw-search">Search</label>
    <input type="search" id="vp-pw-search" class="vp-pw-search" placeholder="Filter by site or username…" autocomplete="off" enterkeyhint="search" />
    <div id="vp-pw-list-wrap"></div>
    <h3 class="vp-set-h" style="font-size:1rem;margin:1.25rem 0 0">Never save for these sites</h3>
    <div id="vp-pw-never"></div>
  </div>
</div>
<script>
(function(){
  var api = window.veloPage;
  function q(id){ return document.getElementById(id); }
  function show(which){
    ['vp-pw-setup','vp-pw-locked','vp-pw-main'].forEach(function(id){
      var el = q(id); if (el) el.style.display = id === which ? 'block' : 'none';
    });
  }
  async function refreshToggles(){
    if (!api) return;
    var s = await api.getSettings();
    q('vp-pw-offer').checked = s.passwordOfferToSave;
    q('vp-pw-autofill-focus').checked = s.passwordAutofillOnFocus;
    q('vp-pw-autofill-hotkey').checked = s.passwordAutofillHotkey;
    var rem = s.passwordVaultRememberDevice !== false;
    var rc = q('vp-pw-remember-create'); if (rc) rc.checked = rem;
    var ru = q('vp-pw-remember-unlock'); if (ru) ru.checked = rem;
    var rd = q('vp-pw-remember-device'); if (rd) rd.checked = rem;
  }
  var pwEntriesCache = [];
  function searchTokens(){
    var raw = (q('vp-pw-search') && q('vp-pw-search').value || '').trim().toLowerCase();
    if (!raw) return [];
    return raw.split(/\\s+/).filter(function(t){ return t.length > 0; });
  }
  function entryMatchesSearch(e, tokens){
    if (!tokens.length) return true;
    var d = (e.domain || '').toLowerCase();
    var u = (e.username || '').toLowerCase();
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (d.indexOf(t) < 0 && u.indexOf(t) < 0) return false;
    }
    return true;
  }
  function renderNever(domains){
    var box = q('vp-pw-never');
    if (!box) return;
    box.innerHTML = '';
    if (!domains || domains.length === 0) {
      box.innerHTML = '<p class="vp-set-note" style="margin:0">None</p>';
      return;
    }
    domains.forEach(function(d){
      var row = document.createElement('div');
      row.className = 'vp-pw-never-item';
      row.innerHTML = '<span></span><button type="button" class="vp-pw-rm-never">Remove</button>';
      row.querySelector('span').textContent = d;
      row.querySelector('button').onclick = async function(){
        if (!api) return;
        var next = domains.filter(function(x){ return x !== d; });
        await api.setSettings({ passwordsNeverSaveDomains: next });
        await renderMain();
      };
      box.appendChild(row);
    });
  }
  async function renderList(){
    if (!api) return;
    var wrap = q('vp-pw-list-wrap');
    if (!wrap) return;
    try {
      pwEntriesCache = await api.passwordVaultList();
    } catch (e) {
      pwEntriesCache = [];
    }
    drawPasswordTable();
  }
  function drawPasswordTable(){
    if (!api) return;
    var wrap = q('vp-pw-list-wrap');
    if (!wrap) return;
    var entries = pwEntriesCache || [];
    var tokens = searchTokens();
    if (entries.length === 0) {
      wrap.innerHTML = '<p class="vp-set-note" style="margin:0">No saved passwords yet.</p>';
      return;
    }
    var rows = entries.filter(function(e){ return entryMatchesSearch(e, tokens); });
    if (rows.length === 0) {
      wrap.innerHTML = '<p class="vp-set-note" style="margin:0">No entries match your search.</p>';
      return;
    }
    var scroll = document.createElement('div');
    scroll.className = 'vp-pw-table-wrap';
    var t = document.createElement('table');
    t.className = 'vp-pw-table';
    t.innerHTML = '<thead><tr><th class="vp-pw-col-site">Site</th><th class="vp-pw-col-user">Username</th><th class="vp-pw-col-pass">Password</th><th class="vp-pw-col-act">Actions</th></tr></thead><tbody></tbody>';
    var tb = t.querySelector('tbody');
    rows.forEach(function(e){
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="vp-pw-col-site"></td><td class="vp-pw-col-user"></td><td class="vp-pw-col-pass"><input type="password" readonly /></td><td class="vp-pw-col-act"></td>';
      tr.cells[0].textContent = e.domain;
      tr.cells[1].textContent = e.username;
      var inp = tr.querySelector('input');
      if (inp) inp.value = e.password;
      var tdAct = tr.cells[3];
      var btnR = document.createElement('button');
      btnR.type = 'button';
      btnR.textContent = 'Reveal';
      var revealed = false;
      btnR.onclick = function(){
        if (!inp) return;
        revealed = !revealed;
        inp.type = revealed ? 'text' : 'password';
        btnR.textContent = revealed ? 'Hide' : 'Reveal';
      };
      var btnD = document.createElement('button');
      btnD.type = 'button';
      btnD.textContent = 'Delete';
      btnD.onclick = async function(){
        if (!api || !confirm('Delete password for ' + e.domain + '?')) return;
        await api.passwordVaultDelete(e.id);
        await renderList();
      };
      tdAct.appendChild(btnR);
      tdAct.appendChild(btnD);
      tb.appendChild(tr);
    });
    scroll.appendChild(t);
    wrap.innerHTML = '';
    wrap.appendChild(scroll);
  }
  async function renderMain(){
    show('vp-pw-main');
    await refreshToggles();
    if (!api) return;
    var s = await api.getSettings();
    renderNever(s.passwordsNeverSaveDomains || []);
    await renderList();
  }
  function clearSetupErr(){
    var er = q('vp-pw-setup-err');
    if (!er) return;
    er.style.display = 'none';
    er.textContent = '';
  }
  function showSetupErr(msg){
    var er = q('vp-pw-setup-err');
    if (!er) return;
    er.textContent = msg;
    er.style.display = 'block';
  }
  async function boot(){
    if (!api) return;
    await refreshToggles();
    var exists = await api.passwordVaultExists();
    var unlocked = await api.passwordVaultUnlocked();
    if (!exists) {
      clearSetupErr();
      show('vp-pw-setup');
      return;
    }
    if (!unlocked) {
      show('vp-pw-locked');
      q('vp-pw-unlock-err').textContent = '';
      return;
    }
    await renderMain();
  }
  q('vp-pw-create').onclick = async function(){
    if (!api) return;
    clearSetupErr();
    var el1 = q('vp-pw-new1');
    var el2 = q('vp-pw-new2');
    var a = el1 ? el1.value : '';
    var b = el2 ? el2.value : '';
    if (a.length < 4) {
      showSetupErr('Passphrase must be at least 4 characters.');
      requestAnimationFrame(function(){ try { el1.focus(); el1.select(); } catch (x) {} });
      return;
    }
    if (a !== b) {
      showSetupErr('Passphrases do not match.');
      requestAnimationFrame(function(){ try { el2.focus(); el2.select(); } catch (x) {} });
      return;
    }
    try {
      var remember = q('vp-pw-remember-create') ? q('vp-pw-remember-create').checked : true;
      await api.passwordVaultCreate(a, remember);
      if (el1) el1.value = '';
      if (el2) el2.value = '';
      clearSetupErr();
      await boot();
    } catch (err) {
      var msg = err && err.message ? String(err.message) : 'Could not create vault';
      showSetupErr(msg);
      requestAnimationFrame(function(){ try { el1.focus(); el1.select(); } catch (x) {} });
    }
  };
  q('vp-pw-unlock').onclick = async function(){
    if (!api) return;
    q('vp-pw-unlock-err').textContent = '';
    try {
      var remU = q('vp-pw-remember-unlock') ? q('vp-pw-remember-unlock').checked : true;
      await api.passwordVaultUnlock(q('vp-pw-unlock-pass').value, remU);
      q('vp-pw-unlock-pass').value = '';
      await boot();
    } catch (err) {
      q('vp-pw-unlock-err').textContent = 'Could not unlock. Check your passphrase.';
    }
  };
  q('vp-pw-lock').onclick = async function(){
    if (!api) return;
    await api.passwordVaultLock();
    await boot();
  };
  q('vp-pw-offer').onchange = async function(){
    if (!api) return;
    await api.setSettings({ passwordOfferToSave: q('vp-pw-offer').checked });
  };
  q('vp-pw-autofill-focus').onchange = async function(){
    if (!api) return;
    await api.setSettings({ passwordAutofillOnFocus: q('vp-pw-autofill-focus').checked });
  };
  q('vp-pw-autofill-hotkey').onchange = async function(){
    if (!api) return;
    await api.setSettings({ passwordAutofillHotkey: q('vp-pw-autofill-hotkey').checked });
  };
  var rdEl = q('vp-pw-remember-device');
  if (rdEl) rdEl.onchange = async function(){
    if (!api) return;
    await api.setSettings({ passwordVaultRememberDevice: rdEl.checked });
    await refreshToggles();
  };
  q('vp-pw-import').onclick = async function(){
    if (!api) return;
    try {
      var r = await api.passwordVaultImport();
      alert('Imported ' + r.imported + ' credential(s).');
      await renderList();
    } catch (err) {
      alert(err && err.message ? err.message : 'Import failed');
    }
  };
  q('vp-pw-export').onclick = async function(){
    if (!api) return;
    try {
      var r = await api.passwordVaultExport();
      if (r.ok) alert('Exported to ' + r.path);
      else if (r.reason !== 'cancelled') alert('Nothing to export or cancelled.');
    } catch (err) {
      alert(err && err.message ? err.message : 'Export failed');
    }
  };
  q('vp-pw-search').oninput = function(){ drawPasswordTable(); };
  boot();
})();
</script>`
}

const NT_PAGE_PRESET_LABELS: Record<NewTabBackgroundPreset, string> = {
  default: 'Default (follows theme)',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  indigo: 'Indigo',
  violet: 'Violet',
  black: 'Black',
  white: 'White',
  grey: 'Grey',
  'dark-grey': 'Dark grey',
  'light-grey': 'Light grey'
}

function panelNewTabPage(): string {
  const files = listBrowserBackgroundBasenames()
  const presetButtons = NEW_TAB_BACKGROUND_PRESETS.map((p) => {
    const lab = escapeHtml(NT_PAGE_PRESET_LABELS[p])
    if (p === 'default') {
      return `<button type="button" class="vp-nt-bg-preset vp-nt-bg-preset--default" data-preset="${p}" aria-label="${lab}" title="${lab}"></button>`
    }
    const hex = NEW_TAB_PRESET_HEX[p as Exclude<NewTabBackgroundPreset, 'default'>]
    return `<button type="button" class="vp-nt-bg-preset" data-preset="${p}" aria-label="${lab}" title="${lab}" style="background:${hex}"></button>`
  }).join('')
  const photoButtons =
    files.length === 0
      ? ''
      : files
          .map((f) => {
            const safe = escapeHtml(f)
            const u = `velo:///browser-backgrounds/${encodeURIComponent(f)}`
            return `<button type="button" class="vp-nt-bg-photo" data-file="${safe}" aria-label="Background: ${safe}" title="${safe}" style="background-image:url('${u}')"></button>`
          })
          .join('')
  return `<h2 class="vp-set-h">New Tab Page</h2>
<p class="vp-set-note">Background applies only to <a href="velo://newtab">new tab</a>. Put images in the <strong>browser-backgrounds</strong> folder at the project root (PNG, JPEG, WebP, GIF, AVIF). Restart or reload the new tab to pick up new files.</p>
<style>
  .vp-nt-bg-presets {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 10px;
    margin-top: 0.75rem;
    max-width: min(420px, 100%);
  }
  .vp-nt-bg-preset {
    margin: 0;
    padding: 0;
    width: 100%;
    aspect-ratio: 1;
    min-height: 44px;
    border: 2px solid var(--border);
    border-radius: 12px;
    cursor: pointer;
    box-sizing: border-box;
    transition: border-color 0.15s ease, transform 0.12s ease;
  }
  .vp-nt-bg-preset:hover { transform: scale(1.03); }
  .vp-nt-bg-preset.is-picked {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .vp-nt-bg-preset--default {
    background: conic-gradient(from 200deg, #6c9eff, #1a1a22, #f4f4f8, #6c9eff);
  }
  .vp-nt-bg-photos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 10px;
    margin-top: 0.75rem;
  }
  .vp-nt-bg-photo {
    margin: 0;
    padding: 0;
    width: 100%;
    aspect-ratio: 4/3;
    min-height: 64px;
    border: 2px solid var(--border);
    border-radius: 12px;
    cursor: pointer;
    background-size: cover;
    background-position: center;
    box-sizing: border-box;
    transition: border-color 0.15s ease, transform 0.12s ease;
  }
  .vp-nt-bg-photo:hover { transform: scale(1.02); }
  .vp-nt-bg-photo.is-picked {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .vp-code { font-size: 0.85em; background: var(--vel-input-bg); padding: 0.12em 0.35em; border-radius: 6px; }
</style>
<div class="card">
  <label>Solid background</label>
  <div class="vp-nt-bg-presets" id="vpNtPresets" role="group" aria-label="Solid colors">${presetButtons}</div>
  <label style="margin-top:1.1rem">Photos from browser-backgrounds</label>
  ${
    files.length === 0
      ? '<p class="vp-set-note" style="margin:0.5rem 0 0">No images found. Add files to <code class="vp-code">browser-backgrounds/</code>.</p>'
      : `<div class="vp-nt-bg-photos" id="vpNtPhotos" role="group" aria-label="Background images">${photoButtons}</div>`
  }
</div>
<script>
  (function () {
    var api = window.veloPage
    function sync(bg) {
      document.querySelectorAll('.vp-nt-bg-preset, .vp-nt-bg-photo').forEach(function (el) {
        el.classList.remove('is-picked')
      })
      if (!bg) return
      if (bg.kind === 'preset') {
        var b = document.querySelector('.vp-nt-bg-preset[data-preset="' + bg.preset + '"]')
        if (b) b.classList.add('is-picked')
      } else if (bg.kind === 'image') {
        var p = document.querySelector('.vp-nt-bg-photo[data-file="' + bg.filename + '"]')
        if (p) p.classList.add('is-picked')
      }
    }
    async function load() {
      if (!api) return
      var s = await api.getSettings()
      sync(s.newTabBackground)
    }
    function wire() {
      if (!api) return
      document.querySelectorAll('.vp-nt-bg-preset').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var p = btn.getAttribute('data-preset')
          if (!p) return
          void api.setSettings({ newTabBackground: { kind: 'preset', preset: p } }).then(load)
        })
      })
      document.querySelectorAll('.vp-nt-bg-photo').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var f = btn.getAttribute('data-file')
          if (!f) return
          void api.setSettings({ newTabBackground: { kind: 'image', filename: f } }).then(load)
        })
      })
    }
    wire()
    load()
  })()
</script>`
}

function panelAccessibility(): string {
  return `<h2 class="vp-set-h">Accessibility</h2>
<p class="vp-set-note">Text size, contrast, and assistive options.</p>
<div class="card">
  <p style="margin:0;color:var(--muted);font-size:0.9rem">Settings will appear here as they are implemented.</p>
</div>`
}

function panelPerformance(): string {
  return `<h2 class="vp-set-h">Performance</h2>
<p class="vp-set-note">Tune how Velo uses the network, notifications, and background work for tabs you are not viewing.</p>

<div class="card">
  <h3 class="vp-set-h" style="font-size:1rem;margin:0 0 0.75rem">General</h3>
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="perf-prefetch-l">Warm network paths</div>
      <p class="vp-set-row__desc">After each navigation, open an early connection to the site origin when possible. Can make return visits quicker.</p>
    </div>
    <div class="vp-set-row__control">
      <input type="checkbox" class="vp-switch" id="perf-prefetch" aria-labelledby="perf-prefetch-l" />
    </div>
  </div>
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="perf-notify-l">Alert when a tab stops responding</div>
      <p class="vp-set-row__desc">Send a desktop note when the system detects an unresponsive page.</p>
    </div>
    <div class="vp-set-row__control">
      <input type="checkbox" class="vp-switch" id="perf-notify" aria-labelledby="perf-notify-l" />
    </div>
  </div>
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="perf-dim-l">Soften tabs that are idle in the background</div>
      <p class="vp-set-row__desc">Tint non-active tabs that have been shifted to a lower scheduling mode so you can tell they are at rest.</p>
    </div>
    <div class="vp-set-row__control">
      <input type="checkbox" class="vp-switch" id="perf-dim" aria-labelledby="perf-dim-l" />
    </div>
  </div>
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="perf-pin-l">Never throttle these sites</div>
      <p class="vp-set-row__desc">Host names or registrable domains (e.g. chat.example.com or example.com). Subdomains of a listed domain match.</p>
    </div>
    <div class="vp-set-row__control" style="flex:1;min-width:0;max-width:100%">
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-top:0.35rem">
        <input type="text" id="perf-pin-input" placeholder="example.com" autocomplete="off"
          style="flex:1;min-width:140px;padding:0.45rem 0.55rem;border-radius:8px;border:1px solid var(--border);background:var(--vel-input-bg, var(--bg-elevated));color:inherit;font:inherit" />
        <button type="button" id="perf-pin-add" style="margin:0">Add site</button>
      </div>
      <ul id="perf-pin-list" style="margin:0.65rem 0 0;padding:0;list-style:none;max-width:100%"></ul>
    </div>
  </div>
</div>

<div class="card" style="margin-top:1rem">
  <h3 class="vp-set-h" style="font-size:1rem;margin:0 0 0.75rem">Power savings</h3>
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="perf-lowpow-l">Prioritize battery for background tabs</div>
      <p class="vp-set-row__desc">Use shorter delays before background tabs are nudged into low-priority scheduling.</p>
    </div>
    <div class="vp-set-row__control">
      <input type="checkbox" class="vp-switch" id="perf-lowpow" aria-labelledby="perf-lowpow-l" />
    </div>
  </div>
</div>

<div class="card" style="margin-top:1rem">
  <h3 class="vp-set-h" style="font-size:1rem;margin:0 0 0.75rem">Memory &amp; background work</h3>
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="perf-auto-l">Slow background tabs after idle</div>
      <p class="vp-set-row__desc">After the delay below, tabs you are not viewing can run timers and painting less often until you return.</p>
    </div>
    <div class="vp-set-row__control">
      <input type="checkbox" class="vp-switch" id="perf-auto" aria-labelledby="perf-auto-l" />
    </div>
  </div>
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="perf-delay-l">Delay before background slowdown</div>
      <p class="vp-set-row__desc">Applies to ordinary web tabs that are not on the list above. Built-in Velo pages are never slowed this way.</p>
    </div>
    <div class="vp-set-row__control">
      <select id="perf-delay" aria-labelledby="perf-delay-l">
        <option value="5">5 minutes</option>
        <option value="15">15 minutes</option>
        <option value="30">30 minutes</option>
        <option value="60">1 hour</option>
      </select>
    </div>
  </div>
</div>

<div class="card" style="margin-top:1rem">
  <h3 class="vp-set-h" style="font-size:1rem;margin:0 0 0.75rem">Gaming &amp; heavy workloads</h3>
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="perf-game-l">Leaner browser during games or heavy tasks</div>
      <p class="vp-set-row__desc">Shorten the wait before background tabs calm down further. Pair with “Prioritize battery” if you want very brisk cutbacks.</p>
    </div>
    <div class="vp-set-row__control">
      <input type="checkbox" class="vp-switch" id="perf-game" aria-labelledby="perf-game-l" />
    </div>
  </div>
</div>

<script>
(function(){
  var api = window.veloPage;
  function q(id){ return document.getElementById(id); }
  function normHost(raw){
    var t = String(raw || '').trim().toLowerCase().replace(/^https:\\/\\//, '').replace(/^www\\./, '');
    var si = t.indexOf('/');
    if (si >= 0) t = t.slice(0, si);
    var qi = t.indexOf('?');
    if (qi >= 0) t = t.slice(0, qi);
    var hi = t.indexOf('#');
    if (hi >= 0) t = t.slice(0, hi);
    var pi = t.indexOf(':');
    if (pi >= 0) t = t.slice(0, pi);
    return t;
  }
  function renderPins(hosts){
    var ul = q('perf-pin-list');
    if (!ul) return;
    ul.innerHTML = '';
    if (!hosts || !hosts.length) {
      var li0 = document.createElement('li');
      li0.style.cssText = 'color:var(--muted);font-size:0.9rem;padding:0.35rem 0';
      li0.textContent = 'None yet';
      ul.appendChild(li0);
      return;
    }
    hosts.forEach(function(h){
      var li = document.createElement('li');
      li.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--border)';
      var span = document.createElement('span');
      span.textContent = h;
      span.style.wordBreak = 'break-word';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = 'Remove';
      rm.style.margin = '0';
      rm.onclick = async function(){
        if (!api) return;
        var next = hosts.filter(function(x){ return x !== h; });
        await api.setSettings({ alwaysActiveHostnames: next });
        var s = await api.getSettings();
        renderPins(s.alwaysActiveHostnames);
      };
      li.appendChild(span);
      li.appendChild(rm);
      ul.appendChild(li);
    });
  }
  async function load(){
    if (!api) return;
    var s = await api.getSettings();
    q('perf-prefetch').checked = s.prefetchNetworkConnections;
    q('perf-notify').checked = s.notifyOnTabFreeze;
    q('perf-dim').checked = s.dimRestingTabs;
    q('perf-lowpow').checked = s.lowPowerBackgroundMode;
    q('perf-auto').checked = s.autoThrottleBackgroundTabs;
    q('perf-delay').value = String(s.backgroundTabRestMinutes);
    q('perf-game').checked = s.gameQuietBackground;
    q('perf-delay').disabled = !s.autoThrottleBackgroundTabs;
    renderPins(s.alwaysActiveHostnames);
  }
  function wireToggle(id, key){
    q(id).onchange = async function(){
      if (!api) return;
      var patch = {};
      patch[key] = q(id).checked;
      await api.setSettings(patch);
      await load();
    };
  }
  wireToggle('perf-prefetch', 'prefetchNetworkConnections');
  wireToggle('perf-notify', 'notifyOnTabFreeze');
  wireToggle('perf-dim', 'dimRestingTabs');
  wireToggle('perf-lowpow', 'lowPowerBackgroundMode');
  wireToggle('perf-auto', 'autoThrottleBackgroundTabs');
  wireToggle('perf-game', 'gameQuietBackground');
  q('perf-delay').onchange = async function(){
    if (!api) return;
    var v = parseInt(q('perf-delay').value, 10);
    if (v !== 5 && v !== 15 && v !== 30 && v !== 60) return;
    await api.setSettings({ backgroundTabRestMinutes: v });
    await load();
  };
  q('perf-pin-add').onclick = async function(){
    if (!api) return;
    var host = normHost(q('perf-pin-input').value);
    if (!host || host.length > 253) return;
    var s = await api.getSettings();
    var list = (s.alwaysActiveHostnames || []).slice();
    if (list.indexOf(host) >= 0) return;
    list.push(host);
    await api.setSettings({ alwaysActiveHostnames: list });
    q('perf-pin-input').value = '';
    await load();
  };
  load();
})();
</script>`
}

function panelSystem(): string {
  return `<h2 class="vp-set-h">System</h2>
<p class="vp-set-note">Startup, session behavior, and low-level rendering.</p>

<div class="card">
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="startup-label">On startup</div>
      <p class="vp-set-row__desc">What happens when you open Velo after it was fully closed.</p>
    </div>
    <div class="vp-set-row__control">
      <select id="startup" aria-labelledby="startup-label">
        <option value="new-tab">Open new tab</option>
        <option value="restore-tabs">Restore previous session</option>
      </select>
    </div>
  </div>
</div>

<div class="card" style="margin-top:1rem">
  <div class="vp-set-row__text">
    <div class="vp-set-row__title" id="sys-upd-label">Updates</div>
    <p class="vp-set-row__desc">Installed Velo checks <strong>GitHub Releases</strong> for newer versions and downloads updates in the background.</p>
    <p id="sys-upd-line" class="vp-set-note" style="margin:0.6rem 0 0.75rem"></p>
    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
      <button type="button" id="sys-upd-check" aria-describedby="sys-upd-line">Check for updates</button>
      <button type="button" id="sys-upd-restart" style="display:none;background:var(--vel-input-bg);color:inherit" aria-describedby="sys-upd-line">Restart to update</button>
    </div>
  </div>
</div>

<div class="card" style="margin-top:1rem">
  <div class="vp-set-row">
    <div class="vp-set-row__text">
      <div class="vp-set-row__title" id="sys-hw-label">Use hardware acceleration when available</div>
      <p class="vp-set-row__desc">Lets Velo use your GPU for rendering and video where Chromium allows it. Turn off if pages flicker, show wrong colors, or the whole app feels unstable on your machine.</p>
      <p class="vp-set-note" style="margin:0.5rem 0 0">Changing this only takes effect after Velo fully restarts (all windows close and the app starts again).</p>
    </div>
    <div class="vp-set-row__control">
      <input type="checkbox" class="vp-switch" id="sys-hw" aria-labelledby="sys-hw-label" />
    </div>
  </div>
  <div id="sys-hw-pending" style="display:none;margin-top:0.85rem;padding:0.65rem 0.75rem;border-radius:8px;border:1px solid var(--border);background:var(--card);">
    <p style="margin:0;font-size:0.9rem" id="sys-hw-pending-msg">Restart Velo to apply this change.</p>
    <button type="button" id="sys-hw-restart" style="margin:0.65rem 0 0">Restart Velo</button>
  </div>
</div>

<script>
  (function(){
    var api = window.veloPage;
    function el(id){ return document.getElementById(id); }
    var baselineHw = true;
    async function load(){
      if (!api) return;
      var s = await api.getSettings();
      el('startup').value = s.startupBehavior;
      baselineHw = s.useHardwareAcceleration;
      el('sys-hw').checked = baselineHw;
      el('sys-hw-pending').style.display = 'none';
    }
    el('startup').onchange = async function(){
      if (!api) return;
      await api.setSettings({ startupBehavior: el('startup').value });
      await load();
    };
    el('sys-hw').onchange = async function(){
      if (!api) return;
      var next = el('sys-hw').checked;
      await api.setSettings({ useHardwareAcceleration: next });
      var changed = next !== baselineHw;
      el('sys-hw-pending').style.display = changed ? 'block' : 'none';
    };
    el('sys-hw-restart').onclick = function(){
      if (!api) return;
      void api.relaunchApp();
    };
    function formatUpd(st){
      if (!st) return '';
      if (st.phase === 'dev') return 'Automatic updates apply to packaged installs only (not while running from source with npm run dev).';
      if (st.phase === 'idle') return 'No update in progress. Velo also checks periodically in the background.';
      if (st.phase === 'checking') return 'Checking for updates…';
      if (st.phase === 'available') return 'Version ' + st.version + ' available — downloading…';
      if (st.phase === 'downloading') return 'Downloading… ' + st.percent + '%';
      if (st.phase === 'downloaded') return 'Version ' + st.version + ' is downloaded. Restart Velo to finish installing.';
      if (st.phase === 'error') return 'Update error: ' + st.message;
      return '';
    }
    async function refreshUpd(){
      if (!api || !api.getAutoUpdateStatus) return;
      var st = await api.getAutoUpdateStatus();
      var line = el('sys-upd-line');
      var btnR = el('sys-upd-restart');
      if (line) line.textContent = formatUpd(st);
      if (btnR) btnR.style.display = st.phase === 'downloaded' ? 'inline-block' : 'none';
    }
    el('sys-upd-check').onclick = function(){
      if (!api || !api.checkAutoUpdate) return;
      void api.checkAutoUpdate();
      setTimeout(refreshUpd, 400);
      setTimeout(refreshUpd, 2000);
      setTimeout(refreshUpd, 8000);
    };
    el('sys-upd-restart').onclick = function(){
      if (!api || !api.quitAndInstallUpdate) return;
      void api.quitAndInstallUpdate();
    };
    load();
    void refreshUpd();
    setInterval(refreshUpd, 4000);
  })();
</script>`
}

function panelDefaultBrowser(): string {
  return `<h2 class="vp-set-h">Default browser</h2>
<p class="vp-set-note">Use Velo for web links from other apps (HTTP and HTTPS).</p>
<div class="card">
  <p id="def-br-status" style="margin:0 0 0.75rem;font-size:0.95rem;line-height:1.45"></p>
  <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
    <button type="button" id="def-br-set-default">Set default</button>
  </div>
  <p id="def-br-msg" class="vp-set-note" style="margin:0.75rem 0 0"></p>
</div>

<script>
  (function(){
    var api = window.veloPage;
    function el(id){ return document.getElementById(id); }
    async function refresh(){
      if (!api || !api.getDefaultBrowserStatus) return;
      var st = await api.getDefaultBrowserStatus();
      var t = el('def-br-status');
      if (!t) return;
      if (!st.isPackaged) {
        t.textContent = 'You are running a development build. Install Velo from an installer to set it as the default browser.';
      } else if (st.isDefault) {
        t.textContent = 'Velo is registered as the default handler for HTTP and HTTPS links on this system.';
      } else if (st.http || st.https) {
        t.textContent = 'Velo is only partly registered (HTTP: ' + (st.http ? 'yes' : 'no') + ', HTTPS: ' + (st.https ? 'yes' : 'no') + '). Use Set default below to finish in Windows Settings.';
      } else {
        t.textContent = 'Another app is currently the default browser. Use Set default to register Velo and open the right page in Settings.';
      }
      var btn = el('def-br-set-default');
      if (btn) btn.disabled = !st.isPackaged;
    }
    var btnDef = el('def-br-set-default');
    if (btnDef) btnDef.onclick = async function(){
      var m = el('def-br-msg');
      if (!api || !api.registerDefaultBrowserAndOpenSettings) return;
      var r = await api.registerDefaultBrowserAndOpenSettings();
      if (m) m.textContent = r.message || '';
      await refresh();
    };
    refresh();
  })();
</script>`
}

const PANEL_HTML: Record<SettingsPanelSlug, () => string> = {
  appearance: panelAppearance,
  languages: panelLanguages,
  'download-preferences': panelDownloadPreferences,
  privacy: panelPrivacy,
  'password-manager': panelPasswordManager,
  'new-tab-page': panelNewTabPage,
  accessibility: panelAccessibility,
  performance: panelPerformance,
  system: panelSystem,
  'default-browser': panelDefaultBrowser
}


export function renderSettingsPage(route: string): string | null {
  const slug = parseSettingsRoute(route)
  if (!slug) return null
  const title = `${PANEL_TITLE[slug]} – Settings`
  const main = PANEL_HTML[slug]()
  const extraStyle =
    slug === 'password-manager'
      ? `
  .vp-main-inner { max-width: min(1120px, 100%) !important; }
`
      : undefined
  return veloFramedPageHtml(title, {
    sidebarHtml: veloSettingsSidebarHtml(slug),
    mainHtml: main,
    extraStyle
  })
}
