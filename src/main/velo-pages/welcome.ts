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

  .welcome-progress {
    font-size: 0.78rem;
    font-weight: 650;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--muted) 92%, var(--accent));
    margin: 0 0 clamp(0.85rem, 2vh, 1.35rem);
    opacity: 0;
    transform: translateY(0.5rem);
    transition: opacity 0.55s ease 0.1s, transform 0.55s ease 0.1s;
  }
  .welcome-root.welcome--intro:not(.welcome--rest-revealed) .welcome-progress {
    opacity: 0;
    pointer-events: none;
  }
  .welcome-progress.welcome--in-view {
    opacity: 1;
    transform: translateY(0);
  }

  .welcome-steps {
    position: relative;
    display: block;
  }

  .welcome-step {
    opacity: 0;
    visibility: hidden;
    transform: translateX(14px);
    transition:
      opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0s linear 0.4s;
    pointer-events: none;
    z-index: 0;
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
  }
  .welcome-step.is-active {
    opacity: 1;
    visibility: visible;
    transform: translateX(0);
    transition-delay: 0s, 0s, 0s;
    pointer-events: auto;
    z-index: 1;
    position: relative;
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
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
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
  .welcome-actions.welcome--in-view {
    opacity: 1;
    transform: translateY(0);
  }

  /* Steps 2–3: same .welcome-actions class but never get welcome--in-view; show when step is active. */
  .welcome-step.is-active .welcome-actions {
    opacity: 1;
    transform: translateY(0);
  }
  /* Intro step 1: keep actions hidden until manifesto + revealRest (welcome--rest-revealed). */
  .welcome-root.welcome--intro:not(.welcome--rest-revealed) .welcome-step.is-active .welcome-actions {
    opacity: 0;
    transform: translateY(0.75rem);
    pointer-events: none;
  }

  .welcome-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
  .welcome-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }
  .welcome-btn--primary {
    background: var(--accent);
    color: #0c0c14;
    border-color: transparent;
  }
  html[data-chrome-theme='white'] .welcome-btn--primary {
    color: #fff;
  }
  .welcome-btn--primary:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .welcome-btn--ghost {
    background: var(--vel-input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
  }
  .welcome-btn--ghost:hover:not(:disabled) {
    background: var(--vel-input-hover);
  }
  .welcome-btn--grow {
    flex: 1 1 140px;
    min-width: min(100%, 140px);
  }

  .welcome-step-title {
    font-size: clamp(1.15rem, 2.4vw, 1.35rem);
    font-weight: 650;
    letter-spacing: -0.02em;
    margin: 0 0 0.5rem;
    color: var(--fg);
  }
  .welcome-step-lead {
    font-size: 0.95rem;
    line-height: 1.55;
    color: var(--muted);
    margin: 0 0 1rem;
  }

  .welcome-pw-note {
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--muted);
    margin: 1rem 0 0;
    padding: 0.65rem 0.8rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--vel-input-bg) 88%, var(--card));
  }
  .welcome-pw-note a {
    color: var(--accent);
  }

  .welcome-tips {
    margin: 0;
    padding-left: 1.15rem;
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--muted);
  }
  .welcome-tips li {
    margin: 0.35rem 0;
  }
  .welcome-tips a {
    color: var(--accent);
    text-decoration: none;
  }
  .welcome-tips a:hover {
    text-decoration: underline;
  }

  .welcome-card {
    margin-top: 1rem;
    padding: 0.85rem 1rem;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--vel-input-bg);
  }
  .welcome-card__title {
    font-weight: 650;
    font-size: 0.95rem;
    margin: 0 0 0.35rem;
    color: var(--fg);
  }
  .welcome-def-status {
    font-size: 0.88rem;
    line-height: 1.45;
    color: var(--muted);
    margin: 0 0 0.65rem;
  }
  .welcome-def-msg {
    font-size: 0.8rem;
    color: var(--muted);
    margin: 0.5rem 0 0;
    min-height: 1.2em;
  }

  .welcome-imp-cb { display:flex; align-items:center; gap:0.5rem; margin:0.35rem 0; cursor:pointer; font-size:0.95rem; }
  .welcome-imp-cb input { width:1rem; height:1rem; }
  .welcome-imp-browser-row { display:flex; flex-wrap:wrap; gap:0.45rem; margin-top:0.5rem; }
  .welcome-imp-browser-row .welcome-imp-browser-btn { margin-top:0; }
  .welcome-imp-browser-btn {
    font-size:0.86rem;
    padding:0.4rem 0.65rem;
    border-radius:0.35rem;
    border:1px solid var(--border);
    background:var(--vel-input-bg);
    color:var(--fg);
    cursor:pointer;
    font-family: inherit;
  }
  .welcome-imp-browser-btn:hover:not(:disabled) {
    background:var(--vel-input-hover);
  }
  .welcome-imp-browser-btn:disabled {
    opacity:0.45;
    cursor:not-allowed;
  }
  .welcome-imp-browser-btn[data-active="1"] {
    border-color:var(--accent);
    box-shadow:0 0 0 1px color-mix(in srgb, var(--accent) 50%, var(--border));
    font-weight:600;
    background:color-mix(in srgb, var(--accent) 14%, var(--vel-input-bg));
    color:var(--fg);
  }
  .welcome-imp-browser-btn[data-active="1"]:hover:not(:disabled) {
    background:color-mix(in srgb, var(--accent) 20%, var(--vel-input-hover));
  }

  .welcome-imp-field label { display:block; font-weight:600; font-size:0.88rem; margin-bottom:0.35rem; color:var(--fg); }
  .welcome-imp-field select {
    min-width:12rem;
    padding:0.4rem 0.55rem;
    font-size:0.92rem;
    border-radius:8px;
    border:1px solid var(--border);
    background:var(--vel-input-bg);
    color:var(--fg);
    font-family: inherit;
  }

  .welcome-imp-result {
    margin-top: 1rem;
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--muted);
    white-space: pre-line;
    display: none;
  }
  .welcome-imp-result.is-visible { display: block; }

  .welcome-root.welcome--standard {
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
    .welcome-progress {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
    .welcome-step {
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
    <p class="welcome-progress" id="welcome-progress" aria-live="polite">Step 1 of 3</p>
    <div class="welcome-steps" id="welcome-steps">
      <div class="welcome-step is-active" data-step="1" id="welcome-step-1" role="tabpanel" aria-labelledby="welcome-progress" aria-hidden="false">
        <div class="welcome-manifesto" id="welcome-manifesto">
          <p class="welcome-manifesto__lead"><span id="welcome-type-lead"></span></p>
          <p><span id="welcome-type-body"></span></p>
          <p class="welcome-manifesto__tagline"><span id="welcome-type-tag"></span></p>
        </div>
        <hr class="welcome-rule" id="welcome-rule" />
        <div class="welcome-actions" id="welcome-step1-actions">
          <button type="button" class="welcome-btn welcome-btn--primary welcome-btn--grow" id="welcome-btn-next-1">Next</button>
          <button type="button" class="welcome-btn welcome-btn--ghost welcome-btn--grow" id="welcome-btn-skip-setup">Skip setup</button>
        </div>
      </div>

      <div class="welcome-step" data-step="2" id="welcome-step-2" role="tabpanel" aria-hidden="true">
        <h2 class="welcome-step-title">Import browser data</h2>
        <p class="welcome-step-lead">Optional — pull history, bookmarks, and downloads from a Chromium browser you already use on this device.</p>
        <p id="welcome-imp-platform" class="welcome-step-lead" style="display:none;margin-bottom:0.75rem"></p>
        <div id="welcome-imp-empty" style="display:none">
          <p class="welcome-step-lead" style="margin-bottom:1rem">No supported browser profiles were found on this device.</p>
        </div>
        <div id="welcome-imp-main" style="display:none">
          <div class="welcome-step-lead" style="margin:0 0 0.35rem;font-weight:600;color:var(--fg)">Import from</div>
          <div id="welcome-imp-browser-btns" class="welcome-imp-browser-row" role="group" aria-label="Browser source"></div>
          <div id="welcome-imp-profile-row" class="welcome-imp-field" style="margin-top:0.85rem;display:none">
            <label for="welcome-imp-profile">Profile</label>
            <select id="welcome-imp-profile"></select>
          </div>
          <fieldset id="welcome-imp-fieldset" style="border:none;margin:0;padding:0;margin-top:0.85rem" disabled>
            <legend class="welcome-step-lead" style="margin:0 0 0.35rem;font-weight:600;color:var(--fg)">Data to import</legend>
            <label class="welcome-imp-cb"><input type="checkbox" id="welcome-imp-hist" checked /> History</label>
            <label class="welcome-imp-cb"><input type="checkbox" id="welcome-imp-bm" checked /> Bookmarks/Favorites</label>
            <label class="welcome-imp-cb"><input type="checkbox" id="welcome-imp-dl" checked /> Downloads</label>
          </fieldset>
          <p id="welcome-imp-result" class="welcome-imp-result" role="status"></p>
        </div>
        <p class="welcome-pw-note">
          Passwords are not imported directly from browser databases. To import passwords, export a CSV from your current browser’s password manager, then open <a href="velo://settings/password-manager">velo://settings/password-manager</a> in Velo and import the CSV file.
        </p>
        <div class="welcome-actions" style="margin-top:1.25rem">
          <button type="button" class="welcome-btn welcome-btn--primary welcome-btn--grow" id="welcome-imp-btn">Import selected data</button>
          <button type="button" class="welcome-btn welcome-btn--ghost welcome-btn--grow" id="welcome-btn-skip-import">Skip import</button>
          <button type="button" class="welcome-btn welcome-btn--ghost welcome-btn--grow" id="welcome-btn-next-2">Next</button>
        </div>
      </div>

      <div class="welcome-step" data-step="3" id="welcome-step-3" role="tabpanel" aria-hidden="true">
        <h2 class="welcome-step-title">You're ready</h2>
        <p class="welcome-step-lead">A few tips before you go:</p>
        <ul class="welcome-tips" id="welcome-tip-list"></ul>
        <div class="welcome-card">
          <div class="welcome-card__title">Make Velo your default browser?</div>
          <p id="welcome-def-status" class="welcome-def-status"></p>
          <div class="welcome-actions" style="margin:0;opacity:1;transform:none">
            <button type="button" class="welcome-btn welcome-btn--primary welcome-btn--grow" id="welcome-def-set">Make default</button>
            <button type="button" class="welcome-btn welcome-btn--ghost welcome-btn--grow" id="welcome-btn-finish">Finish</button>
          </div>
          <p id="welcome-def-msg" class="welcome-def-msg"></p>
        </div>
      </div>
    </div>
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
  var mac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent || '');

  var LEAD = 'Welcome to Velo.';
  var BODY =
    'A modern browser built for speed, simplicity, and control. With a clean interface, powerful features, and a customizable experience, Velo puts you in charge of how you browse.';
  var TAG = 'Start fast. Stay focused. Browse your way.';

  var api = window.veloPage;
  var currentStep = 1;
  var detectLoaded = false;

  function fillManifesto() {
    if (leadEl) leadEl.textContent = LEAD;
    if (bodyEl) bodyEl.textContent = BODY;
    if (tagEl) tagEl.textContent = TAG;
  }

  function revealRest() {
    if (!root) return;
    root.classList.add('welcome--rest-revealed');
    var restIds = ['welcome-rule', 'welcome-step1-actions', 'welcome-progress'];
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

  function syncStepPanels(n) {
    var steps = document.querySelectorAll('.welcome-step');
    steps.forEach(function (s) {
      var sn = parseInt(s.getAttribute('data-step'), 10);
      var active = sn === n;
      s.classList.toggle('is-active', active);
      s.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }

  function showStep(n) {
    currentStep = n;
    var prog = document.getElementById('welcome-progress');
    if (prog) prog.textContent = 'Step ' + n + ' of 3';
    syncStepPanels(n);
    if (n === 2 && !detectLoaded) {
      detectLoaded = true;
      void loadDetect();
    }
    if (n === 3) void refreshDefaultBrowser();
    if (!reduced) {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        window.scrollTo(0, 0);
      }
    } else window.scrollTo(0, 0);
  }

  async function finishOnboarding() {
    try {
      if (api && api.completeWelcomeOnboarding) await api.completeWelcomeOnboarding();
      if (api && api.navigateUrl) await api.navigateUrl('velo://newtab');
      else window.location.href = 'velo://newtab';
    } catch (err) {
      window.location.href = 'velo://newtab';
    }
  }

  function el(id) { return document.getElementById(id); }

  var BROWSERS = [
    { id: 'edge', label: 'Microsoft Edge' },
    { id: 'chrome', label: 'Google Chrome' },
    { id: 'brave', label: 'Brave' },
    { id: 'opera', label: 'Opera' },
    { id: 'opera-gx', label: 'Opera GX' }
  ];
  var impState = { sourcesById: {}, selectedBrowserId: null };

  function impSetBusy(b) {
    var btn = el('welcome-imp-btn');
    var fs = el('welcome-imp-fieldset');
    if (btn) btn.disabled = b;
    if (fs) fs.disabled = b;
  }

  function impCurrentProfile() {
    var sid = impState.selectedBrowserId;
    var src = sid ? impState.sourcesById[sid] : null;
    if (!src || !src.available || !src.profiles.length) return null;
    var sel = el('welcome-imp-profile');
    var pid = sel && sel.value ? sel.value : src.profiles[0].id;
    for (var i = 0; i < src.profiles.length; i++) {
      if (src.profiles[i].id === pid) return src.profiles[i];
    }
    return src.profiles[0];
  }

  function impSyncCheckboxesFromProfile() {
    var p = impCurrentProfile();
    var fs = el('welcome-imp-fieldset');
    var h = el('welcome-imp-hist');
    var b = el('welcome-imp-bm');
    var dl = el('welcome-imp-dl');
    if (!p) {
      if (fs) fs.disabled = true;
      return;
    }
    if (fs) fs.disabled = false;
    if (h) {
      h.disabled = !p.hasHistory;
      if (h.disabled) h.checked = false;
      else if (!h.hasAttribute('data-touched')) h.checked = true;
    }
    if (b) {
      b.disabled = !p.hasBookmarks;
      if (b.disabled) b.checked = false;
      else if (!b.hasAttribute('data-touched')) b.checked = true;
    }
    if (dl) {
      dl.disabled = !p.hasHistory;
      if (dl.disabled) dl.checked = false;
      else if (!dl.hasAttribute('data-touched')) dl.checked = true;
    }
  }

  function impOnBrowserSelect(id) {
    impState.selectedBrowserId = id;
    var h0 = el('welcome-imp-hist'), b0 = el('welcome-imp-bm'), dl0 = el('welcome-imp-dl');
    if (h0) h0.removeAttribute('data-touched');
    if (b0) b0.removeAttribute('data-touched');
    if (dl0) dl0.removeAttribute('data-touched');
    var row = el('welcome-imp-browser-btns');
    if (row) {
      var btns = row.querySelectorAll('.welcome-imp-browser-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].setAttribute('data-active', btns[i].getAttribute('data-bid') === id ? '1' : '0');
      }
    }
    var src = impState.sourcesById[id];
    var prow = el('welcome-imp-profile-row');
    var sel = el('welcome-imp-profile');
    if (!src || !src.available || !src.profiles.length) {
      if (prow) prow.style.display = 'none';
      impSyncCheckboxesFromProfile();
      return;
    }
    if (prow) prow.style.display = src.profiles.length > 1 ? 'block' : 'none';
    if (sel) {
      sel.innerHTML = '';
      for (var j = 0; j < src.profiles.length; j++) {
        var pr = src.profiles[j];
        var opt = document.createElement('option');
        opt.value = pr.id;
        opt.textContent = pr.name;
        sel.appendChild(opt);
      }
    }
    impSyncCheckboxesFromProfile();
  }

  ['welcome-imp-hist', 'welcome-imp-bm', 'welcome-imp-dl'].forEach(function (cid) {
    var n = el(cid);
    if (n) n.addEventListener('change', function () { n.setAttribute('data-touched', '1'); });
  });

  async function loadDetect() {
    var plat = el('welcome-imp-platform');
    var main = el('welcome-imp-main');
    var empty = el('welcome-imp-empty');
    var row = el('welcome-imp-browser-btns');
    var impBtn = el('welcome-imp-btn');
    if (!api || !api.browserDataDetectSources) {
      if (plat) {
        plat.style.display = 'block';
        plat.textContent = 'Import is unavailable (internal API missing). You can continue setup.';
      }
      if (main) main.style.display = 'none';
      if (empty) empty.style.display = 'none';
      if (impBtn) impBtn.disabled = true;
      return;
    }
    var d = await api.browserDataDetectSources();
    impState.sourcesById = {};
    var any = false;
    for (var i = 0; i < d.sources.length; i++) {
      impState.sourcesById[d.sources[i].id] = d.sources[i];
      if (d.sources[i].available) any = true;
    }
    if (!any) {
      if (plat) plat.style.display = 'none';
      if (main) main.style.display = 'none';
      if (empty) empty.style.display = 'block';
      if (impBtn) impBtn.disabled = true;
      return;
    }
    if (plat) plat.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (main) main.style.display = 'block';
    if (row) {
      row.innerHTML = '';
      for (var b = 0; b < BROWSERS.length; b++) {
        var def = BROWSERS[b];
        var src = impState.sourcesById[def.id];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'welcome-imp-browser-btn';
        btn.setAttribute('data-bid', def.id);
        btn.textContent = src && src.available ? def.label : def.label + ' — unavailable';
        btn.disabled = !src || !src.available;
        btn.onclick = function () {
          var bid = this.getAttribute('data-bid');
          if (!bid || !impState.sourcesById[bid] || !impState.sourcesById[bid].available) return;
          impOnBrowserSelect(bid);
        };
        row.appendChild(btn);
      }
    }
    var prSel = el('welcome-imp-profile');
    if (prSel) prSel.onchange = function () { impSyncCheckboxesFromProfile(); };
    var first = null;
    for (var k = 0; k < BROWSERS.length; k++) {
      var s = impState.sourcesById[BROWSERS[k].id];
      if (s && s.available) {
        first = BROWSERS[k].id;
        break;
      }
    }
    if (first) impOnBrowserSelect(first);
    if (impBtn) impBtn.disabled = false;
  }

  function buildTips() {
    var ul = el('welcome-tip-list');
    if (!ul) return;
    var omnibarKey = mac ? '⌘L' : 'Ctrl+L';
    var tips = [
      'Type <a href="velo://settings">velo://settings</a> anytime to customize Velo.',
      'Press <kbd style="font:inherit;font-size:0.92em;padding:0.1em 0.35em;border-radius:4px;border:1px solid var(--border);background:var(--vel-input-bg)">' +
        omnibarKey +
        '</kbd> to jump to the omnibar.',
      'Press <kbd style="font:inherit;font-size:0.92em;padding:0.1em 0.35em;border-radius:4px;border:1px solid var(--border);background:var(--vel-input-bg)">F12</kbd> to open DevTools for the active tab.',
      'Open <a href="velo://downloads">velo://downloads</a>, <a href="velo://history">velo://history</a>, and <a href="velo://bookmarks">velo://bookmarks</a> for your library.'
    ];
    ul.innerHTML = '';
    tips.forEach(function (html) {
      var li = document.createElement('li');
      li.innerHTML = html;
      ul.appendChild(li);
    });
  }

  async function refreshDefaultBrowser() {
    var stEl = el('welcome-def-status');
    var btn = el('welcome-def-set');
    if (!api || !api.getDefaultBrowserStatus) {
      if (stEl) stEl.textContent = 'Default browser status unavailable.';
      if (btn) btn.disabled = true;
      return;
    }
    var st = await api.getDefaultBrowserStatus();
    if (stEl) {
      if (!st.isPackaged) {
        stEl.textContent = 'Install Velo from an installer to set it as the system default (dev builds cannot register).';
      } else if (st.isDefault) {
        stEl.textContent = 'Velo is already registered as the default browser for web links on this system.';
      } else if (st.http || st.https) {
        stEl.textContent =
          'Velo is only partly registered (HTTP: ' +
          (st.http ? 'yes' : 'no') +
          ', HTTPS: ' +
          (st.https ? 'yes' : 'no') +
          '). Use Make default below to finish in system settings.';
      } else {
        stEl.textContent = 'Velo is not the default browser yet. Use Make default to register Velo and open the right settings page.';
      }
    }
    if (btn) btn.disabled = !st.isPackaged;
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
    var m0 = document.getElementById('welcome-manifesto');
    if (m0) m0.classList.add('welcome--in-view');
    revealRest();
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

  buildTips();
  syncStepPanels(1);

  var n1 = el('welcome-btn-next-1');
  if (n1) n1.onclick = function () { showStep(2); };
  var skipSetup = el('welcome-btn-skip-setup');
  if (skipSetup) skipSetup.onclick = function () { void finishOnboarding(); };

  var n2 = el('welcome-btn-next-2');
  if (n2) n2.onclick = function () { showStep(3); };
  var skipImp = el('welcome-btn-skip-import');
  if (skipImp) skipImp.onclick = function () { showStep(3); };

  var impBtn = el('welcome-imp-btn');
  if (impBtn) {
    impBtn.disabled = true;
    impBtn.onclick = async function () {
      var resEl = el('welcome-imp-result');
      if (!api || !api.browserDataImportChromium) return;
      if (resEl) {
        resEl.textContent = '';
        resEl.classList.remove('is-visible');
      }
      var sid = impState.selectedBrowserId;
      var src = sid ? impState.sourcesById[sid] : null;
      if (!src || !src.available) {
        if (resEl) {
          resEl.textContent = 'Select an available browser.';
          resEl.classList.add('is-visible');
        }
        return;
      }
      var pr = impCurrentProfile();
      if (!pr) {
        if (resEl) {
          resEl.textContent = 'No profile selected.';
          resEl.classList.add('is-visible');
        }
        return;
      }
      var hist = el('welcome-imp-hist').checked;
      var bm = el('welcome-imp-bm').checked;
      var dl = el('welcome-imp-dl').checked;
      if (!hist && !bm && !dl) {
        if (resEl) {
          resEl.textContent = 'Select at least one type of data to import.';
          resEl.classList.add('is-visible');
        }
        return;
      }
      impSetBusy(true);
      try {
        var r = await api.browserDataImportChromium({
          browserId: sid,
          profileId: pr.id,
          history: hist,
          bookmarks: bm,
          downloads: dl
        });
        if (resEl) {
          resEl.classList.add('is-visible');
          var lines = [];
          var bits = [];
          if (r.imported.history > 0) bits.push(r.imported.history + ' history entries');
          if (r.imported.bookmarks > 0) bits.push(r.imported.bookmarks + ' bookmarks');
          if (r.imported.downloads > 0) bits.push(r.imported.downloads + ' downloads');
          if (bits.length > 0) lines.push('Imported ' + bits.join(', ') + '.');
          else if (!r.errors || r.errors.length === 0) {
            lines.push('No new items were imported. You may have already imported this data, or the selected source was empty.');
          }
          if (r.errors && r.errors.length) {
            for (var i = 0; i < r.errors.length; i++) {
              lines.push(r.errors[i]);
            }
          }
          resEl.textContent = lines.join('\\n');
        }
      } catch (e) {
        if (resEl) {
          resEl.classList.add('is-visible');
          resEl.textContent = e && e.message ? String(e.message) : 'Import failed.';
        }
      } finally {
        impSetBusy(false);
      }
    };
  }

  var btnFinish = el('welcome-btn-finish');
  if (btnFinish) btnFinish.onclick = function () { void finishOnboarding(); };

  var btnDef = el('welcome-def-set');
  if (btnDef) {
    btnDef.onclick = function () {
      var run = async function () {
        try {
          if (!api || !api.registerDefaultBrowserAndOpenSettings) return;
          var st = await api.getDefaultBrowserStatus();
          if (!st.isPackaged) {
            window.alert('Install Velo from an installer to set it as the system default (dev builds cannot register).');
            return;
          }
          var r = await api.registerDefaultBrowserAndOpenSettings();
          var m = el('welcome-def-msg');
          if (m) m.textContent = r && r.message ? r.message : '';
          await refreshDefaultBrowser();
        } catch (err) {
          try {
            if (api && api.openDefaultBrowserSystemSettings) {
              await api.openDefaultBrowserSystemSettings();
            }
          } catch (e2) {}
        }
      };
      void run();
    };
  }
})();
</script>`

  return veloPageHtml('Welcome — Velo', body, WELCOME_STYLE)
}
