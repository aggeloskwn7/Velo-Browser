
export function buildPasswordInjectScript(): string {
  return `(function(){
  if (window.__veloPwInjected) return;
  window.__veloPwInjected = true;
  var SRC = 'velo-password-bridge';
  function post(msg){ try { window.postMessage(Object.assign({ source: SRC }, msg), '*'); } catch(e) {} }
  function hostname(){ try { return (location.hostname || '').replace(/^www\\./i,'').toLowerCase(); } catch(e){ return ''; } }function resolveInputFromEvent(ev) {
    try {
      if (ev && typeof ev.composedPath === 'function') {
        var path = ev.composedPath();
        for (var i = 0; i < path.length; i++) {
          var n = path[i];
          if (n && n.nodeType === 1 && n.tagName === 'INPUT') return n;
        }
      }
    } catch (e) {}
    var t = ev && ev.target;
    if (t && t.tagName === 'INPUT') return t;
    return shadowDrillToInput(document.activeElement);
  }
  function shadowDrillToInput(root) {
    var el = root;
    for (var d = 0; el && d < 12; d++) {
      if (el.tagName === 'INPUT') return el;
      var sr = el.shadowRoot;
      if (sr && sr.activeElement) {
        el = sr.activeElement;
        continue;
      }
      break;
    }
    return null;
  }
  function findUser(el){
    var f = el && el.form;
    if (!f) return '';
    var cand = f.querySelector('input[type="email"],input[type="text"],input[name*="user" i],input[name*="login" i],input[name*="email" i],input[id*="user" i],input[id*="login" i],input[id*="email" i]');
    return cand && cand.value ? String(cand.value) : '';
  }
  var lastOffer = '';
  function maybeOffer(passEl){
    if (!passEl || passEl.type !== 'password') return;
    var user = findUser(passEl);
    var pass = passEl.value || '';
    if (!pass || pass.length < 1) return;
    var key = hostname() + '\\n' + user + '\\n' + pass;
    if (key === lastOffer) return;
    lastOffer = key;
    post({ type: 'offer', domain: hostname(), username: user, password: pass });
  }
  var t = null;
  function debounceOffer(passEl){
    if (t) clearTimeout(t);
    t = setTimeout(function(){ maybeOffer(passEl); }, 400);
  }
  var fillTimer = null;
  function isPasskeyAutocompleteField(el){
    if (!el || el.tagName !== 'INPUT') return false;
    var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    return ac.indexOf('webauthn') >= 0;
  }
  function formHasPasskeyField(form){
    if (!form || typeof form.querySelectorAll !== 'function') return false;
    var ins = form.querySelectorAll('input,textarea');
    for (var i = 0; i < ins.length; i++) {
      var ac = (ins[i].getAttribute('autocomplete') || '').toLowerCase();
      if (ac.indexOf('webauthn') >= 0) return true;
    }
    return false;
  }function skipUsernameAutofillForPasskeys(el){
    if (!isPasskeyAutocompleteField(el)) return false;
    var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (ac.indexOf('username') >= 0 || ac.indexOf('email') >= 0) return false;
    if ((el.type || '').toLowerCase() === 'email') return false;
    return true;
  }
  function isUserField(el){
    if (!el || el.tagName !== 'INPUT' || el.disabled || el.readOnly) return false;
    var ty = (el.type || '').toLowerCase();
    if (ty === 'password' || ty === 'hidden' || ty === 'submit' || ty === 'button' || ty === 'checkbox' || ty === 'radio' || ty === 'file') return false;
    if (ty === 'search') return false;
    if (ty === 'email') return true;
    var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (ac.indexOf('webauthn') >= 0 && ac.indexOf('username') < 0 && ac.indexOf('email') < 0 && ty !== 'email') return false;
    if (ac.indexOf('username') >= 0 || ac.indexOf('email') >= 0) return true;
    if (ac.indexOf('tel') >= 0) return true;
    var im = (el.getAttribute('inputmode') || '').toLowerCase();
    if (im === 'email' || im === 'tel') return true;
    var nm = (el.name || '').toLowerCase();
    var id = (el.id || '').toLowerCase();
    if (nm.indexOf('email') >= 0 || id.indexOf('email') >= 0) return true;
    if (nm.indexOf('user') >= 0 || nm.indexOf('login') >= 0 || id.indexOf('user') >= 0 || id.indexOf('login') >= 0) return true;
    if (nm === 'identifier' || id === 'identifierid') return true;
    return false;
  }
  function debounceAutoFill(anchorEl, anchorField){
    if (fillTimer) clearTimeout(fillTimer);
    fillTimer = setTimeout(function(){
      if (anchorEl && anchorEl.isConnected) anchorEl.setAttribute('data-velo-pw-anchor', '');
      post({ type: 'requestFill', hostname: hostname(), mode: 'auto', anchorField: anchorField });
    }, 250);
  }
  document.addEventListener('focusin', function(ev){
    var el = resolveInputFromEvent(ev);
    if (!el) return;
    if (el.type === 'password') {
      debounceOffer(el);
      if (!isPasskeyAutocompleteField(el) && !formHasPasskeyField(el.form)) debounceAutoFill(el, 'password');
    } else if (isUserField(el)) {
      if (!skipUsernameAutofillForPasskeys(el)) debounceAutoFill(el, 'username');
    }
  }, true);
  document.addEventListener('change', function(ev){
    var el = resolveInputFromEvent(ev);
    if (!el || el.tagName !== 'INPUT') return;
    if (el.type === 'password') debounceOffer(el);
  }, true);
  document.addEventListener('submit', function(ev){
    var f = ev.target;
    if (!f || f.tagName !== 'FORM') return;
    var pe = f.querySelector('input[type="password"]');
    if (pe) maybeOffer(pe);
  }, true);
  document.addEventListener('keydown', function(ev){
    if (!ev.ctrlKey && !ev.metaKey) return;
    if (!ev.shiftKey) return;
    if (ev.key !== 'L' && ev.key !== 'l') return;
    ev.preventDefault();
    post({ type: 'requestFill', hostname: hostname(), mode: 'hotkey', anchorField: 'hotkey' });
  }, true);
  post({ type: 'ping' });
})();`
}
