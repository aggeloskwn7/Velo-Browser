import { veloPageHtml } from './layout.js'

export type WelcomePageOptions = {
  firstLaunch: boolean
}

export function renderWelcomePage(options: WelcomePageOptions): string {
  const { firstLaunch } = options
  const rootClass = firstLaunch ? 'welcome-root welcome--intro' : 'welcome-root welcome--standard'

  const WELCOME_STYLE = `
  body:has(.welcome-root) {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    scroll-behavior: smooth;
  }
  .welcome-root {
    --welcome-type-size: clamp(1.65rem, 5vw, 2.75rem);
    position: relative;
    min-height: 100dvh;
    background: var(--bg);
    color: var(--fg);
  }.welcome-root::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background: radial-gradient(
      ellipse 85% 55% at 50% -10%,
      color-mix(in srgb, var(--accent) 9%, transparent),
      transparent 58%
    );
    opacity: 0.85;
  }

  .welcome-hero {
    position: relative;
    z-index: 1;
    min-height: 100dvh;
    box-sizing: border-box;
  }
  .welcome-root.welcome--intro.welcome--phase2 .welcome-hero {
    min-height: 0;
    padding-top: clamp(5rem, 12.5vh, 6.5rem);
    padding-bottom: 0.35rem;
  }.welcome-lockup {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    left: 50%;
    top: 44%;
    transform: translate(-50%, -50%);
    transition:
      left 1.1s cubic-bezier(0.22, 1, 0.36, 1),
      top 1.1s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.1s cubic-bezier(0.22, 1, 0.36, 1),
      flex-direction 0s linear 0s;
  }

  .welcome-root.welcome--phase2 .welcome-lockup {
    left: clamp(1.25rem, 5vw, 3rem);
    top: clamp(1.1rem, 3.5vh, 2.25rem);
    transform: translate(0, 0);
    flex-direction: row;
    align-items: center;
    gap: clamp(0.65rem, 2.2vw, 1.35rem);
  }

  .welcome-logo {
    display: block;
    width: min(260px, 48vmin);
    height: auto;
    object-fit: contain;
    flex-shrink: 0;
    transition: width 1.1s cubic-bezier(0.22, 1, 0.36, 1);
    filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.22));
  }
  html[data-chrome-theme='white'] .welcome-logo {
    filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.12));
  }

  .welcome-root.welcome--phase2 .welcome-logo {
    width: clamp(76px, 11vmin, 108px);
  }

  .welcome-title-wrap {
    display: flex;
    align-items: baseline;
    min-height: 0;
    opacity: 0;
    max-width: 0;
    overflow: hidden;
    transition:
      opacity 0.5s ease 0.15s,
      max-width 0.01s linear 0s;
    pointer-events: none;
  }

  .welcome-root.welcome--phase2 .welcome-title-wrap {
    opacity: 1;
    max-width: 24rem;
    pointer-events: auto;
    transition:
      opacity 0.55s ease 0.2s,
      max-width 0.6s ease 0.1s;
  }

  .welcome-typed {
    font-family: ui-sans-serif, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: var(--welcome-type-size);
    font-weight: 750;
    letter-spacing: 0.04em;
    line-height: 1.1;
    color: var(--fg);
    white-space: nowrap;
  }

  .welcome-caret {
    display: inline-block;
    width: 0.08em;
    height: 0.92em;
    margin-left: 0.06em;
    background: var(--accent);
    vertical-align: -0.06em;
    animation: welcomeCaretBlink 0.95s step-end infinite;
  }
  .welcome-root.welcome--standard .welcome-caret,
  .welcome-caret.welcome-caret--off {
    animation: none;
    opacity: 0;
  }

  @keyframes welcomeCaretBlink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }.welcome-scroll {
    position: relative;
    z-index: 1;
    padding: clamp(0.5rem, 3vh, 1.5rem) clamp(1.25rem, 5vw, 3rem) clamp(3rem, 8vh, 5rem);
    max-width: 42rem;
    margin: 0 auto;
  }

  .welcome-rule {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--border) 92%, var(--accent)),
      transparent
    );
    margin: 0 0 clamp(1.5rem, 4vh, 2.25rem);
    border: none;
    opacity: 0;
    transform: scaleX(0.3);
    transition: opacity 0.8s ease, transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .welcome-root.welcome--intro:not(.welcome--rest-revealed) .welcome-rule {
    opacity: 0;
    transform: scaleX(0.3);
    pointer-events: none;
  }
  .welcome-rule.welcome--in-view {
    opacity: 1;
    transform: scaleX(1);
  }

  .welcome-manifesto {
    font-size: clamp(1.05rem, 2.1vw, 1.2rem);
    line-height: 1.68;
    color: var(--muted);
    margin: 0 0 1.75rem;
    opacity: 0;
    transform: translateY(1.1rem);
    transition: opacity 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.08s,
      transform 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.08s;
  }
  .welcome-root.welcome--intro.welcome--manifesto-live .welcome-manifesto {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .welcome-manifesto.welcome--in-view {
    opacity: 1;
    transform: translateY(0);
  }
  .welcome-manifesto p {
    margin: 0 0 0.9rem;
  }
  .welcome-manifesto p:last-child {
    margin-bottom: 0;
  }
  .welcome-manifesto__lead {
    font-size: clamp(1.2rem, 2.5vw, 1.45rem);
    font-weight: 650;
    letter-spacing: -0.02em;
    line-height: 1.3;
    color: var(--fg);
    margin-bottom: 1rem;
  }
  .welcome-manifesto__tagline {
    font-weight: 600;
    color: color-mix(in srgb, var(--fg) 82%, var(--muted));
    margin-top: 0.15rem;
  }

  .welcome-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    align-items: stretch;
    width: 100%;
    max-width: 36rem;
    opacity: 0;
    transform: translateY(0.75rem);
    transition: opacity 0.65s ease 0.28s, transform 0.65s ease 0.28s;
  }
  .welcome-root.welcome--intro:not(.welcome--rest-revealed) .welcome-actions {
    opacity: 0;
    transform: translateY(0.75rem);
    pointer-events: none;
  }
  @media (max-width: 560px) {
    .welcome-actions {
      grid-template-columns: 1fr;
    }
  }
  .welcome-actions.welcome--in-view {
    opacity: 1;
    transform: translateY(0);
  }

  .welcome-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
    min-height: 48px;
    padding: 0 1.1rem;
    font: inherit;
    font-weight: 600;
    font-size: 0.9rem;
    line-height: 1.2;
    letter-spacing: 0.02em;
    text-decoration: none;
    border-radius: 10px;
    cursor: pointer;
    margin: 0;
    -webkit-appearance: none;
    appearance: none;border: 1px solid transparent;
    transition: background 0.15s ease, color 0.15s ease, transform 0.12s ease, border-color 0.15s ease;
  }
  .welcome-btn:active {
    transform: scale(0.98);
  }
  .welcome-btn--primary {
    background: var(--accent);
    color: #0c0c14;
    border-color: transparent;
  }
  html[data-chrome-theme='white'] .welcome-btn--primary {
    color: #fff;
  }
  .welcome-btn--primary:hover {
    filter: brightness(1.08);
  }
  .welcome-btn--ghost {
    background: var(--vel-input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
  }
  .welcome-btn--ghost:hover {
    background: var(--vel-input-hover);
  }.welcome-actions > .welcome-btn {
    height: 48px;
    min-height: 48px;
    box-sizing: border-box;
  }

  .welcome-foot {
    margin-top: 2rem;
    font-size: 0.82rem;
    color: var(--muted);
    opacity: 0;
    transition: opacity 0.6s ease 0.4s;
  }
  .welcome-root.welcome--intro:not(.welcome--rest-revealed) .welcome-foot {
    opacity: 0;
    pointer-events: none;
  }
  .welcome-foot.welcome--in-view {
    opacity: 0.85;
  }
  .welcome-foot a {
    color: var(--accent);
  }.welcome-root.welcome--standard {
    padding-top: 0;
  }
  .welcome-root.welcome--standard .welcome-lockup {
    left: clamp(1.25rem, 5vw, 3rem);
    top: clamp(1.1rem, 3.5vh, 2.25rem);
    transform: translate(0, 0);
    flex-direction: row;
    gap: clamp(0.65rem, 2.2vw, 1.35rem);
  }
  .welcome-root.welcome--standard .welcome-logo {
    width: clamp(76px, 11vmin, 108px);
  }
  .welcome-root.welcome--standard .welcome-title-wrap {
    opacity: 1;
    max-width: 24rem;
    pointer-events: auto;
  }
  .welcome-root.welcome--standard .welcome-hero {
    min-height: clamp(108px, 16vh, 148px);
    padding-bottom: 0.35rem;
  }
  .welcome-root.welcome--standard .welcome-scroll {
    padding-top: clamp(0.5rem, 2vh, 1rem);
  }

  @media (prefers-reduced-motion: reduce) {
    .welcome-lockup,
    .welcome-logo,
    .welcome-title-wrap {
      transition: none !important;
    }
    .welcome-caret {
      animation: none !important;
      opacity: 0.5;
    }
    .welcome-manifesto,
    .welcome-actions,
    .welcome-rule,
    .welcome-foot {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
  }
`

  const body = `<div class="${rootClass}">
  <header class="welcome-hero" aria-label="Welcome">
    <div class="welcome-lockup">
      <img
        class="welcome-logo"
        src="velo:///Velo.png"
        alt="Velo"
        width="260"
        height="260"
        decoding="async"
      />
      <div class="welcome-title-wrap">
        <span class="welcome-typed" id="welcome-typed"></span><span class="welcome-caret" id="welcome-caret" aria-hidden="true"></span>
      </div>
    </div>
  </header>

  <div class="welcome-scroll">
    <div class="welcome-manifesto" id="welcome-manifesto">
      <p class="welcome-manifesto__lead"><span id="welcome-type-lead"></span></p>
      <p><span id="welcome-type-body"></span></p>
      <p class="welcome-manifesto__tagline"><span id="welcome-type-tag"></span></p>
    </div>
    <hr class="welcome-rule" id="welcome-rule" />
    <div class="welcome-actions" id="welcome-actions">
      <button type="button" class="welcome-btn welcome-btn--primary" id="welcome-get-started">Get started</button>
      <button type="button" class="welcome-btn welcome-btn--ghost" id="welcome-set-default">Set default</button>
      <a class="welcome-btn welcome-btn--ghost" href="velo://settings/appearance">Appearance</a>
    </div>
    <p class="welcome-foot" id="welcome-foot">
      Tip: type <a href="velo://settings">velo://settings</a> in the address bar anytime.
    </p>
  </div>
</div>
<script>
(function () {
  var root = document.querySelector('.welcome-root');
  var typedEl = document.getElementById('welcome-typed');
  var caretEl = document.getElementById('welcome-caret');
  var leadEl = document.getElementById('welcome-type-lead');
  var bodyEl = document.getElementById('welcome-type-body');
  var tagEl = document.getElementById('welcome-type-tag');
  var isIntro = root && root.classList.contains('welcome--intro');
  var toType = 'VELO BROWSER';
  var reduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var LEAD = 'Welcome to Velo.';
  var BODY =
    'A modern browser built for speed, simplicity, and control. With a clean interface, powerful features, and a customizable experience, Velo puts you in charge of how you browse.';
  var TAG = 'Start fast. Stay focused. Browse your way.';

  function fillManifesto() {
    if (leadEl) leadEl.textContent = LEAD;
    if (bodyEl) bodyEl.textContent = BODY;
    if (tagEl) tagEl.textContent = TAG;
  }

  function revealRest() {
    if (!root) return;
    root.classList.add('welcome--rest-revealed');
    var restIds = ['welcome-rule', 'welcome-actions', 'welcome-foot'];
    restIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('welcome--in-view');
    });
  }

  function typeInto(el, text, msPerChar, done) {
    if (!el) {
      if (done) done();
      return;
    }
    if (reduced) {
      el.textContent = text;
      if (done) done();
      return;
    }
    var i = 0;
    function step() {
      el.textContent = text.slice(0, i);
      if (i >= text.length) {
        if (done) done();
        return;
      }
      i += 1;
      var pause = msPerChar + (i % 3) * 2;
      var ch = text.charAt(i - 1);
      if (ch === '.' || ch === ',') pause += 55;
      setTimeout(step, pause);
    }
    step();
  }

  function typeTitleThen(done) {
    if (!typedEl) {
      if (done) done();
      return;
    }
    if (reduced) {
      typedEl.textContent = toType;
      if (caretEl) caretEl.classList.add('welcome-caret--off');
      if (done) done();
      return;
    }
    var i = 0;
    function step() {
      typedEl.textContent = toType.slice(0, i);
      if (i >= toType.length) {
        if (caretEl) caretEl.classList.add('welcome-caret--off');
        if (done) done();
        return;
      }
      i += 1;
      var delay = i <= 1 ? 100 : 48 + (i % 4) * 10;
      setTimeout(step, delay);
    }
    step();
  }

  function runIntroManifesto() {
    if (!root) return;
    window.scrollTo(0, 0);
    root.classList.add('welcome--manifesto-live');
    typeInto(leadEl, LEAD, 22, function () {
      typeInto(bodyEl, BODY, 13, function () {
        typeInto(tagEl, TAG, 20, function () {
          setTimeout(revealRest, 200);
        });
      });
    });
  }

  if (isIntro && !reduced) {
    setTimeout(function () {
      root.classList.add('welcome--phase2');
      setTimeout(function () {
        typeTitleThen(function () {
          setTimeout(runIntroManifesto, 100);
        });
      }, 340);
    }, 1700);
  } else if (isIntro && reduced) {
    root.classList.add('welcome--phase2');
    root.classList.add('welcome--manifesto-live');
    root.classList.add('welcome--rest-revealed');
    if (typedEl) typedEl.textContent = toType;
    if (caretEl) caretEl.classList.add('welcome-caret--off');
    fillManifesto();
    revealRest();
    var m0 = document.getElementById('welcome-manifesto');
    if (m0) m0.classList.add('welcome--in-view');
  } else {
    root.classList.add('welcome--phase2');
    if (typedEl) typedEl.textContent = toType;
    if (caretEl) caretEl.classList.add('welcome-caret--off');
    fillManifesto();
    var manifesto = document.getElementById('welcome-manifesto');
    if (manifesto) manifesto.classList.add('welcome--in-view');
    if ('IntersectionObserver' in window && manifesto) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              revealRest();
              io.disconnect();
            }
          });
        },
        { root: null, threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
      );
      io.observe(manifesto);
    } else {
      revealRest();
    }
  }

  var btn = document.getElementById('welcome-get-started');
  if (btn) {
    btn.addEventListener('click', function () {
      var api = window.veloPage;
      var go = async function () {
        try {
          if (api && api.completeWelcomeOnboarding) await api.completeWelcomeOnboarding();
          if (api && api.navigateUrl) await api.navigateUrl('velo://newtab');
          else window.location.href = 'velo://newtab';
        } catch (err) {
          window.location.href = 'velo://newtab';
        }
      };
      void go();
    });
  }

  var btnDef = document.getElementById('welcome-set-default');
  if (btnDef) {
    btnDef.addEventListener('click', function () {
      var api = window.veloPage;
      var run = async function () {
        try {
          if (!api || !api.registerDefaultBrowserAndOpenSettings) return;
          var st = await api.getDefaultBrowserStatus();
          if (!st.isPackaged) {
            window.alert('Install Velo from an installer to set it as the system default (dev builds cannot register).');
            return;
          }
          await api.registerDefaultBrowserAndOpenSettings();
        } catch (err) {
          try {
            if (api && api.openDefaultBrowserSystemSettings) {
              await api.openDefaultBrowserSystemSettings();
            }
          } catch (e2) {}
        }
      };
      void run();
    });
  }
})();
</script>`

  return veloPageHtml('Welcome — Velo', body, WELCOME_STYLE)
}
