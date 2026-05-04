
export function buildWebAuthnGuardScript(): string {
  return `(function(){
  if (window.__veloWebAuthnGuard) return;
  window.__veloWebAuthnGuard = true;
  try {
    var PK = window.PublicKeyCredential;
    if (PK && typeof PK.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      PK.isUserVerifyingPlatformAuthenticatorAvailable = function() { return Promise.resolve(false); };
    }
    if (PK && typeof PK.isConditionalMediationAvailable === 'function') {
      PK.isConditionalMediationAvailable = function() { return Promise.resolve(false); };
    }
    var cred = navigator.credentials;
    if (!cred) return;
    var origGet = cred.get && cred.get.bind(cred);
    var origCreate = cred.create && cred.create.bind(cred);
    if (origGet) {
      cred.get = function(opts) {
        try {
          if (opts && opts.publicKey) {
            return Promise.reject(new DOMException('Aborted', 'AbortError'));
          }
        } catch (e) {}
        return origGet(opts);
      };
    }
    if (origCreate) {
      cred.create = function(opts) {
        try {
          if (opts && opts.publicKey) {
            return Promise.reject(new DOMException('Aborted', 'AbortError'));
          }
        } catch (e) {}
        return origCreate(opts);
      };
    }
  } catch (e) {}
})();`
}
