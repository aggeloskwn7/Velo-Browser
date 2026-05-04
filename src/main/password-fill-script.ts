
export type FillCred = { username: string; password: string }


export type PasswordAnchorField = 'password' | 'username' | 'hotkey'

const PICKER_ROOT_ID = '__veloPwPickerRoot'
const ANCHOR_ATTR = 'data-velo-pw-anchor'


const PASSWORD_FILL_DOM_HELPERS = `
    function setNativeInputValue(el, val) {
      var s = val == null ? '' : String(val);
      if (!el) return;
      var tag = el.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        try { el.value = s; } catch (e) {}
        return;
      }
      var proto = tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      try {
        var desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, s);
        else el.value = s;
      } catch (e2) {
        try { el.value = s; } catch (e3) {}
      }
    }
    function dispatchFilledInput(el) {
      var v = el.value;
      try {
        if (typeof InputEvent === 'function') {
          el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertReplacementText', data: v }));
        }
      } catch (e) {}
      try {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e2) {}
      try {
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e3) {}
    }`.trim()


export function buildPasswordFillScript(creds: FillCred[], mode: 'hotkey' | 'auto' = 'auto'): string {
  if (creds.length === 0) {
    return 'void 0'
  }
  const embedded = JSON.stringify(creds[0])
  return `(function(){
  try {
    ${PASSWORD_FILL_DOM_HELPERS}
    var mode = ${JSON.stringify(mode === 'hotkey' ? 'hotkey' : 'auto')};
    var c = ${embedded};
    if (!c || !c.password) return;
    function isPasskeyAutocompleteField(el) {
      if (!el || el.tagName !== 'INPUT') return false;
      var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
      return ac.indexOf('webauthn') >= 0;
    }
    function isPasswordLikeInput(el) {
      if (!el || el.tagName !== 'INPUT' || el.disabled) return false;
      if (isPasskeyAutocompleteField(el)) return false;
      var ty = (el.type || '').toLowerCase();
      var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
      if (ty === 'password') return true;
      if (ac === 'current-password' && ty !== 'hidden') return true;
      return false;
    }
    var pass = null;
    var ae = document.activeElement;
    if (ae && ae.tagName === 'INPUT') {
      if (isPasswordLikeInput(ae)) pass = ae;
    }
    if (!pass) {
      var fp = document.querySelector('input[type="password"]:focus');
      if (fp && isPasswordLikeInput(fp)) pass = fp;
    }
    if (!pass) {
      var all = document.querySelectorAll('input[type="password"]');
      for (var pi = 0; pi < all.length; pi++) {
        if (isPasswordLikeInput(all[pi])) { pass = all[pi]; break; }
      }
    }
    if (!pass) {
      var cur = document.querySelectorAll('input[autocomplete="current-password"]');
      for (var ci = 0; ci < cur.length; ci++) {
        if (isPasswordLikeInput(cur[ci])) { pass = cur[ci]; break; }
      }
    }
    if (!pass || !isPasswordLikeInput(pass)) return;
    if (mode === 'auto' && (pass.value || '').trim().length > 0) return;
    var form = pass.closest('form');
    function findUser() {
      if (form) {
        var els = form.querySelectorAll('input');
        var before = [];
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (el === pass) break;
          var ty = (el.type || '').toLowerCase();
          if (ty === 'hidden' || ty === 'submit' || ty === 'button' || ty === 'checkbox' || ty === 'radio' || ty === 'file' || el.disabled) continue;
          if (isPasswordLikeInput(el)) continue;
          before.push(el);
        }
        if (before.length) return before[before.length - 1];
      }
      var q = form ? form.querySelector.bind(form) : document.querySelector.bind(document);
      var byName = q('input[autocomplete="username"],input[autocomplete="email"]');
      if (byName && byName !== pass && !isPasswordLikeInput(byName)) return byName;
      var email = q('input[type="email"]');
      if (email && email !== pass) return email;
      var scope = form || document;
      var texts = scope.querySelectorAll('input[type="text"],input[type="tel"],input[type="search"],input:not([type])');
      for (var j = 0; j < texts.length; j++) {
        var t = texts[j];
        if (t === pass || isPasswordLikeInput(t)) continue;
        var nm = (t.name || '').toLowerCase();
        var id = (t.id || '').toLowerCase();
        if (nm.indexOf('user') >= 0 || nm.indexOf('login') >= 0 || nm.indexOf('email') >= 0 || id.indexOf('user') >= 0 || id.indexOf('login') >= 0 || id.indexOf('email') >= 0) return t;
      }
      for (var k = 0; k < texts.length; k++) {
        var t2 = texts[k];
        if (t2 !== pass && !isPasswordLikeInput(t2)) return t2;
      }
      return null;
    }
    var user = findUser();
    if (user && c.username) {
      setNativeInputValue(user, c.username);
      dispatchFilledInput(user);
    }
    setNativeInputValue(pass, c.password);
    dispatchFilledInput(pass);
  } catch (e) {}
})()`
}


export function buildPasswordPickerScript(
  creds: FillCred[],
  mode: 'hotkey' | 'auto' = 'auto',
  anchorField: PasswordAnchorField = 'hotkey'
): string {
  if (creds.length === 0) {
    return 'void 0'
  }
  const embedded = JSON.stringify(creds)
  const modeLit = JSON.stringify(mode === 'hotkey' ? 'hotkey' : 'auto')
  const anchorLit = JSON.stringify(anchorField)
  return `(function(){
  try {
    ${PASSWORD_FILL_DOM_HELPERS}
    var mode = ${modeLit};
    var anchorField = ${anchorLit};
    var creds = ${embedded};
    var ANCHOR = ${JSON.stringify(ANCHOR_ATTR)};
    var PW_SRC = 'velo-password-bridge';
    function post(o){ try { window.postMessage(Object.assign({ source: PW_SRC }, o), '*'); } catch(e){} }
    function isPasskeyAutocompleteField(el) {
      if (!el || el.tagName !== 'INPUT') return false;
      var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
      return ac.indexOf('webauthn') >= 0;
    }
    function isVisible(el) {
      if (!el) return false;
      var st = window.getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity || '1') === 0) return false;
      var r = el.getBoundingClientRect();
      return r.width >= 1 && r.height >= 1;
    }
    function isPasswordLikeInput(el) {
      if (!el || el.tagName !== 'INPUT' || el.disabled) return false;
      if (isPasskeyAutocompleteField(el)) return false;
      var ty = (el.type || '').toLowerCase();
      var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
      if (ty === 'password') return true;
      if (ac === 'current-password' && ty !== 'hidden') return true;
      return false;
    }
    function focusedPasswordLike() {
      var ae = document.activeElement;
      if (!ae || ae.tagName !== 'INPUT' || ae.disabled) return null;
      if (!isVisible(ae) || ae.readOnly) return null;
      return isPasswordLikeInput(ae) ? ae : null;
    }
    function forEachElementDeep(root, visitFn) {
      function visit(node) {
        if (!node) return;
        if (node.nodeType === 1) {
          visitFn(node);
          if (node.shadowRoot) visit(node.shadowRoot);
          for (var c = node.firstElementChild; c; c = c.nextElementSibling) visit(c);
        } else if (node.nodeType === 11) {
          for (var c2 = node.firstElementChild; c2; c2 = c2.nextElementSibling) visit(c2);
        }
      }
      visit(root);
    }
    function findMarkedAnchorEl(attr) {
      var found = null;
      forEachElementDeep(document.documentElement, function(el) {
        if (found) return;
        if (el.hasAttribute && el.hasAttribute(attr)) found = el;
      });
      return found;
    }
    function scoreUserCandidate(inp) {
      if (!inp || inp.tagName !== 'INPUT') return 0;
      if (isPasskeyAutocompleteField(inp)) return 0;
      if (inp.disabled || inp.readOnly) return 0;
      var ty = (inp.type || '').toLowerCase();
      if (ty === 'password' || ty === 'hidden' || ty === 'submit' || ty === 'button' || ty === 'checkbox' || ty === 'radio' || ty === 'file') return 0;
      if (!isVisible(inp)) return 0;
      if (ty === 'search') return 0;
      var s = 0;
      if (ty === 'email') s += 40;
      var ac = (inp.getAttribute('autocomplete') || '').toLowerCase();
      if (ac === 'username' || ac === 'email') s += 35;
      else if (ac.indexOf('username') >= 0 || ac.indexOf('email') >= 0) s += 32;
      if (ac === 'tel' || ac.indexOf('tel') >= 0) s += 20;
      var nm = (inp.name || '').toLowerCase();
      var id = (inp.id || '').toLowerCase();
      if (nm.indexOf('email') >= 0 || id.indexOf('email') >= 0) s += 28;
      if (nm.indexOf('user') >= 0 || nm.indexOf('login') >= 0 || id.indexOf('user') >= 0 || id.indexOf('login') >= 0 || id === 'identifierid' || nm === 'identifier') s += 25;
      var im = (inp.getAttribute('inputmode') || '').toLowerCase();
      if (im === 'email') s += 22;
      if (ty === 'text' || ty === 'tel' || !ty) s += 8;
      return s;
    }
    function findVisiblePassword() {
      var fp = focusedPasswordLike();
      if (fp) return fp;
      var hit = null;
      forEachElementDeep(document.documentElement, function(el) {
        if (hit) return;
        if (!isPasswordLikeInput(el)) return;
        if (isVisible(el) && !el.readOnly) hit = el;
      });
      return hit;
    }
    function findUserForPass(pass) {
      if (!pass) return null;
      var form = pass.closest('form');
      if (form) {
        var els = form.querySelectorAll('input');
        var before = [];
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (el === pass) break;
          var ty = (el.type || '').toLowerCase();
          if (ty === 'hidden' || ty === 'submit' || ty === 'button' || ty === 'checkbox' || ty === 'radio' || ty === 'file' || el.disabled) continue;
          if (isPasswordLikeInput(el)) continue;
          before.push(el);
        }
        if (before.length) {
          var cand = before[before.length - 1];
          if (isVisible(cand) && !cand.readOnly && scoreUserCandidate(cand) > 0) return cand;
          if (isVisible(cand) && !cand.readOnly) return cand;
        }
      }
      var q = form ? form.querySelector.bind(form) : document.querySelector.bind(document);
      var byName = q('input[autocomplete="username"],input[autocomplete="email"]');
      if (byName && byName !== pass && !isPasswordLikeInput(byName) && isVisible(byName) && !byName.readOnly) return byName;
      var email = q('input[type="email"]');
      if (email && email !== pass && isVisible(email) && !email.readOnly) return email;
      var scope = form || document;
      var texts = scope.querySelectorAll('input[type="text"],input[type="tel"],input:not([type])');
      for (var j = 0; j < texts.length; j++) {
        var t = texts[j];
        if (t === pass || isPasswordLikeInput(t)) continue;
        if (!isVisible(t) || t.readOnly) continue;
        var nm = (t.name || '').toLowerCase();
        var id = (t.id || '').toLowerCase();
        if (nm.indexOf('user') >= 0 || nm.indexOf('login') >= 0 || nm.indexOf('email') >= 0 || id.indexOf('user') >= 0 || id.indexOf('login') >= 0 || id.indexOf('email') >= 0) return t;
      }
      for (var k = 0; k < texts.length; k++) {
        var t2 = texts[k];
        if (t2 !== pass && !isPasswordLikeInput(t2) && isVisible(t2) && !t2.readOnly) return t2;
      }
      return null;
    }
    function findBestUserInPassRoot(pass) {
      if (!pass) return null;
      var root = pass.getRootNode();
      var rootEl = root.nodeType === 11 ? root : document.documentElement;
      var best = null;
      var bestScore = 0;
      forEachElementDeep(rootEl, function(inp) {
        if (inp.tagName !== 'INPUT') return;
        if (inp === pass || isPasswordLikeInput(inp)) return;
        var sc = scoreUserCandidate(inp);
        if (sc > bestScore) {
          bestScore = sc;
          best = inp;
        }
      });
      return bestScore >= 8 ? best : null;
    }
    function findBestUserGlobal() {
      var best = null;
      var bestScore = 0;
      forEachElementDeep(document.documentElement, function(inp) {
        if (inp.tagName !== 'INPUT') return;
        var sc = scoreUserCandidate(inp);
        if (sc > bestScore) { bestScore = sc; best = inp; }
      });
      return bestScore >= 8 ? best : null;
    }
    var anchorEl = findMarkedAnchorEl(ANCHOR);
    if (anchorEl) anchorEl.removeAttribute(ANCHOR);
    var vPass0 = findVisiblePassword();
    var vUser0 = null;
    if (anchorField === 'username' && anchorEl && anchorEl.tagName === 'INPUT' && !isPasswordLikeInput(anchorEl)) {
      vUser0 = anchorEl;
    } else if (
      anchorField === 'password' &&
      anchorEl &&
      anchorEl.tagName === 'INPUT' &&
      isPasswordLikeInput(anchorEl) &&
      isVisible(anchorEl) &&
      !anchorEl.disabled
    ) {
      vPass0 = anchorEl;
    } else if (anchorEl && anchorEl.tagName === 'INPUT' && scoreUserCandidate(anchorEl) > 0) {
      vUser0 = anchorEl;
    }
    if (!vUser0 || !isVisible(vUser0)) vUser0 = findUserForPass(vPass0);
    if (!vUser0) vUser0 = findBestUserGlobal();
    if (mode === 'auto') {
      if (anchorField === 'username' && vUser0 && (vUser0.value || '').trim().length > 0) return;
      if (anchorField === 'password' && vPass0 && (vPass0.value || '').trim().length > 0) return;
    }
    var placeEl = null;
    if (anchorField === 'username' && vUser0 && vUser0.isConnected) placeEl = vUser0;
    else if (anchorField === 'password' && vPass0 && vPass0.isConnected) placeEl = vPass0;
    else if (anchorEl && anchorEl.isConnected) placeEl = anchorEl;
    else placeEl = vPass0 || vUser0;
    if (!placeEl && anchorField === 'hotkey') {
      var ae = document.activeElement;
      if (ae && ae.tagName === 'INPUT' && isVisible(ae)) placeEl = ae;
    }
    if (!placeEl) return;
    var prev = document.getElementById(${JSON.stringify(PICKER_ROOT_ID)});
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    function applyCred(c) {
      if (!c) return;
      var vPass = findVisiblePassword();
      var vUser = findUserForPass(vPass);
      if (!vUser && vPass) vUser = findBestUserInPassRoot(vPass);
      if (!vUser) vUser = findBestUserGlobal();
      if (vUser && c.username && !vUser.readOnly && isVisible(vUser)) {
        setNativeInputValue(vUser, c.username);
        dispatchFilledInput(vUser);
      }
      if (vPass && c.password && isVisible(vPass) && !vPass.readOnly) {
        setNativeInputValue(vPass, c.password);
        dispatchFilledInput(vPass);
      }
    }
    function maskDots(n) {
      var len = typeof n === 'number' ? n : 8;
      var m = Math.min(Math.max(len, 6), 14);
      return new Array(m + 1).join('\\u2022');
    }
    var host = document.createElement('div');
    host.id = ${JSON.stringify(PICKER_ROOT_ID)};
    host.setAttribute('data-velo-password-picker', '');
    var sh = host.attachShadow({ mode: 'closed' });
    var css = ':host{display:block}.pop{font-family:system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;font-size:13px;line-height:1.3;color:#e4e4e7;background:#27272a;border:1px solid #3f3f46;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.45);min-width:260px;max-width:360px;position:relative;padding-top:4px}.pop::before{content:\"\";position:absolute;top:-5px;left:var(--notch-x,24px);width:10px;height:10px;background:#27272a;border-left:1px solid #3f3f46;border-top:1px solid #3f3f46;transform:rotate(45deg);transform-origin:center;z-index:1}.hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 12px 6px;position:relative;z-index:2}.hdr span{color:#a1a1aa;font-weight:500;font-size:12px}.x{border:0;background:transparent;color:#a1a1aa;font-size:18px;line-height:1;padding:2px 6px;cursor:pointer;border-radius:4px}.x:hover{background:#3f3f46;color:#fafafa}.list{max-height:220px;overflow-y:auto;padding:4px 6px 8px}.row{display:block;width:100%;text-align:left;border:0;border-radius:8px;background:transparent;color:#fafafa;padding:10px 10px;cursor:pointer;margin:0 0 2px;font:inherit}.row:hover,.row:focus{background:#3f3f46;outline:none}.row .u{font-weight:500;margin-bottom:4px;word-break:break-all}.row .m{color:#71717a;font-size:12px;letter-spacing:0.02em}.ft{border-top:1px solid #3f3f46;padding:8px 10px 10px}.mg{display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;color:#93c5fd;font:inherit;font-size:12px;cursor:pointer;padding:6px 4px;border-radius:6px;width:100%;justify-content:flex-start}.mg:hover{background:#3f3f46}';
    var style = document.createElement('style');
    style.textContent = css;
    var root = document.createElement('div');
    root.className = 'pop';
    var hdr = document.createElement('div');
    hdr.className = 'hdr';
    var title = document.createElement('span');
    title.textContent = 'Saved passwords';
    var xb = document.createElement('button');
    xb.type = 'button';
    xb.className = 'x';
    xb.setAttribute('aria-label', 'Close');
    xb.textContent = '\\u00d7';
    hdr.appendChild(title);
    hdr.appendChild(xb);
    var list = document.createElement('div');
    list.className = 'list';
    list.setAttribute('role', 'listbox');
    for (var i = 0; i < creds.length; i++) {
      (function(ci) {
        var c = creds[ci];
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'row';
        row.setAttribute('role', 'option');
        var u = document.createElement('div');
        u.className = 'u';
        u.textContent = (c.username && String(c.username).trim()) ? String(c.username) : '(no username)';
        var m = document.createElement('div');
        m.className = 'm';
        m.textContent = maskDots((c.password || '').length);
        row.appendChild(u);
        row.appendChild(m);
        row.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); teardown(); applyCred(c); });
        list.appendChild(row);
      })(i);
    }
    var ft = document.createElement('div');
    ft.className = 'ft';
    var mg = document.createElement('button');
    mg.type = 'button';
    mg.className = 'mg';
    mg.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg><span>Manage passwords</span>';
    ft.appendChild(mg);
    root.appendChild(hdr);
    root.appendChild(list);
    root.appendChild(ft);
    sh.appendChild(style);
    sh.appendChild(root);
    function place() {
      var el = placeEl;
      if (!el || !host.parentNode || !el.isConnected) return;
      var r = el.getBoundingClientRect();
      var margin = 8;
      var w = Math.min(360, Math.max(260, r.width));
      var left = Math.min(Math.max(r.left, margin), window.innerWidth - w - margin);
      var top = r.bottom + margin;
      host.style.position = 'fixed';
      host.style.zIndex = '2147483647';
      host.style.width = w + 'px';
      host.style.left = left + 'px';
      host.style.top = top + 'px';
      var inputCenter = r.left + r.width / 2;
      var notchX = Math.round(inputCenter - left - 5);
      root.style.setProperty('--notch-x', Math.max(14, Math.min(notchX, w - 14)) + 'px');
    }
    function teardown() {
      if (host.parentNode) host.parentNode.removeChild(host);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onDocDown, true);
    }
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); teardown(); }
    }
    function onScroll() { teardown(); }
    function onDocDown(ev) {
      if (!host.isConnected) return;
      var path = ev.composedPath();
      for (var p = 0; p < path.length; p++) { if (path[p] === host) return; }
      teardown();
    }
    xb.addEventListener('click', function(e){ e.preventDefault(); teardown(); });
    mg.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      teardown();
      post({ type: 'openPasswordSettings' });
    });
    document.body.appendChild(host);
    place();
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onDocDown, true);
  } catch (e) {}
})()`
}
