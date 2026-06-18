import { veloPageHtml } from './layout.js'
import { getSettings } from '../settings-store.js'
import { listBrowserBackgroundBasenames } from './browser-backgrounds.js'
import { buildNewTabBackgroundHtml, NEW_TAB_PRESET_HEX } from './newtab-background.js'
import {
  NEW_TAB_BACKGROUND_PRESETS,
  type NewTabBackgroundPreset
} from '../../shared/ipc.js'

const NT_PRESET_LABELS: Record<NewTabBackgroundPreset, string> = {
  default: 'Default · theme',
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

const NEW_TAB_EXTRA = `
  html { background: var(--bg); }
  body {
    padding: 0 !important;
    min-height: 100dvh;
    background: var(--bg);
    background-color: var(--bg);
  }
  .nt-wrap {
    max-width: min(820px, 100%); margin: 0 auto;
    padding: calc(max(2.5vh, env(safe-area-inset-top)) + clamp(1.5rem, 5vh, 3rem)) clamp(0.75rem, 4vw, 1.5rem) max(1.5rem, env(safe-area-inset-bottom));
    text-align: center;
    isolation: isolate;
    position: relative;
  }
  .nt-brand-row {
    display: flex; align-items: center; justify-content: center; gap: 0.7rem;
    margin: 0 0 clamp(1rem, 3vh, 1.5rem);
    flex-wrap: nowrap;
  }
  .nt-brand-logo {
    width: clamp(44px, 11vw, 56px); height: clamp(44px, 11vw, 56px);
    object-fit: contain; flex-shrink: 0; display: block;
  }
  .nt-brand { font-size: clamp(1.65rem, 7vw, 2.5rem); font-weight: 700; letter-spacing: -0.03em; color: var(--fg); margin: 0; }
  .nt-brand span { color: var(--accent); }
  .nt-search-bar {
    display: flex;
    align-items: stretch;
    flex-wrap: nowrap;
    max-width: min(700px, 100%); margin: 0 auto clamp(1.75rem, 4vh, 2.75rem);
    background: var(--nt-search-bg);
    border: 1px solid var(--nt-search-border);
    border-radius: 999px; overflow: hidden;
    box-shadow: var(--nt-search-shadow);
    transition: border-color 0.22s ease, box-shadow 0.22s ease;
  }
  .nt-search-bar:focus-within {
    border-color: var(--nt-search-focus-border);
    box-shadow: var(--nt-search-focus-ring);
  }
  .nt-search-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 3.35rem;
    min-width: 3.35rem;
    color: var(--nt-icon-muted);
    background: transparent;
    pointer-events: none;
    user-select: none;
  }
  .nt-search-icon svg {
    display: block;
    width: 22px;
    height: 22px;
  }
  .nt-q {
    flex: 1; border: none; background: transparent; color: var(--fg);
    padding: 0.85rem 1rem 0.85rem 0.35rem; font-size: clamp(0.95rem, 3vw, 1rem); outline: none; min-width: 0;
    min-height: var(--tap);
    border-radius: 0 999px 999px 0;
  }
  .nt-q:focus-visible {
    outline: none;
    box-shadow: none;
  }
  .nt-dial-wrap {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(118px, 100%), 1fr));
    gap: 0.6rem clamp(0.35rem, 1.5vw, 0.75rem);
    max-width: min(700px, 100%);
    margin: 0.35rem auto 0;
    padding: 0.5rem 0.125rem 1rem;
    position: relative;
    z-index: 0;
    justify-items: stretch;
  }
  .nt-dial {
    display: contents;
  }
  .nt-add-fab {
    align-self: center;
    justify-self: center;
    width: min(64px, 18vw);
    height: min(64px, 18vw);
    min-height: 0;
    margin: 0;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 50%;
    background: transparent;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    box-shadow: none;
    color: var(--nt-fab-fg);
    cursor: pointer;
    display: grid;
    place-items: center;
    touch-action: manipulation;
    transition: border-color 0.18s ease, color 0.18s ease;
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
  }
  .nt-add-fab:hover,
  .nt-add-fab:focus-visible {
    background: transparent;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    box-shadow: none;
    border: 1px solid var(--nt-fab-hover-border);
    color: var(--nt-fab-hover-fg);
  }
  .nt-add-fab:focus-visible {
    outline: none;
  }
  .nt-add-fab-icon {
    display: block;
    font-size: clamp(1.45rem, 5vw, 1.8rem);
    font-weight: 300;
    line-height: 0;
    user-select: none;
    margin: 0;
    padding: 0;
    transform: translateY(-0.04em);
  }
  .nt-text-btn {
    background: transparent; border: none; color: var(--accent); cursor: pointer;
    font-size: clamp(0.85rem, 2.8vw, 0.88rem); margin: 0; padding: 0.5rem 0.85rem; border-radius: 8px;
    min-height: var(--tap); touch-action: manipulation;
  }
  .nt-text-btn:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .nt-modal-backdrop {
    display: none; pointer-events: none; position: fixed; inset: 0; z-index: 99999; align-items: center; justify-content: center;
    padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
    box-sizing: border-box; background: rgba(0,0,0,0.52);
  }
  .nt-modal-backdrop.nt-open { display: flex; pointer-events: auto; }
  .nt-modal {
    background: var(--card); border: 1px solid var(--nt-modal-border); border-radius: 16px; padding: clamp(1.1rem, 3vw, 1.35rem) clamp(1rem, 3vw, 1.5rem);
    max-width: 420px; width: 100%; max-height: min(90dvh, 100%); overflow: auto;
    box-shadow: var(--nt-modal-shadow); text-align: left;
    -webkit-overflow-scrolling: touch;
  }
  .nt-modal-title { margin: 0 0 1rem; font-size: clamp(1rem, 3.5vw, 1.05rem); font-weight: 600; letter-spacing: -0.02em; }
  .nt-modal-field { margin-bottom: 0.9rem; }
  .nt-modal-field span { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.32rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .nt-modal-field input {
    width: 100%; box-sizing: border-box; background: var(--vel-input-bg); border: 1px solid var(--border); border-radius: 10px;
    padding: 0.65rem 0.75rem; color: var(--fg); font: inherit; min-height: var(--tap); font-size: 16px;
  }
  .nt-modal-field input:focus { outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent); outline-offset: 1px; border-color: var(--accent); }
  .nt-modal-actions { display: flex; gap: 0.6rem; justify-content: flex-end; margin-top: 1rem; flex-wrap: wrap; }
  .nt-modal-actions button { margin: 0; border-radius: 10px; padding: 0.55rem 1.1rem; font: inherit; cursor: pointer; min-height: var(--tap); }
  .nt-modal .nt-cancel { background: var(--vel-input-bg); color: var(--fg); border: 1px solid var(--border); }
  .nt-modal .nt-cancel:hover { background: var(--vel-input-hover); }
  .nt-modal .nt-save { background: var(--accent); color: #0c1020; border: none; font-weight: 600; }
  .nt-modal .nt-save:hover { filter: brightness(1.06); }
  .nt-fav-err { font-size: 0.82rem; color: var(--danger); margin: 0.25rem 0 0; min-height: 1.2em; }
  .nt-settings-anchor {
    position: fixed;
    top: max(0.35rem, env(safe-area-inset-top));
    right: calc(6px + env(safe-area-inset-right, 0px));
    left: auto;
    z-index: 60;
    text-align: right;
  }
  .nt-settings-bar {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.15rem;
  }
  .nt-about-link {
    flex: 0 0 auto;
    font-size: clamp(0.82rem, 2.4vw, 0.88rem);
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--nt-sub);
    text-decoration: none;
    padding: 0.4rem 0.55rem;
    border-radius: 8px;
    background: transparent;
    line-height: 1.2;
    transition: color 0.2s ease, transform 0.34s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .nt-about-link:hover {
    color: var(--accent);
    text-decoration: underline;
  }
  .nt-about-link:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
    outline-offset: 2px;
  }
  .nt-settings-hint {
    flex: 0 1 auto;
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    margin: 0;
    padding: 0;
    font-size: clamp(0.72rem, 2.2vw, 0.82rem);
    font-weight: 500;
    letter-spacing: 0.03em;
    color: var(--nt-label);
    white-space: nowrap;
    pointer-events: none;
    text-shadow: 0 1px 10px rgba(0, 0, 0, 0.45);
    transform: translateX(10px);
    transition:
      max-width 0.34s cubic-bezier(0.32, 0.72, 0, 1),
      opacity 0.28s ease,
      transform 0.34s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .nt-settings-bar:has(.nt-settings-btn:hover) .nt-settings-hint,
  .nt-settings-bar:has(.nt-settings-btn:focus-visible) .nt-settings-hint,
  .nt-settings-anchor.nt-menu-open .nt-settings-hint {
    max-width: 12rem;
    opacity: 1;
    transform: translateX(0);
  }
  .nt-settings-btn {
    display: flex; align-items: center; justify-content: center;
    width: var(--tap); height: var(--tap); min-width: var(--tap);
    padding: 0; margin: 0; margin-top: 0; border: none; border-radius: 10px;
    background: transparent;
    color: var(--nt-sub);
    cursor: pointer; touch-action: manipulation;
    transition: color 0.22s ease, transform 0.2s ease;
    -webkit-appearance: none;
    appearance: none;
  }
  .nt-settings-btn:hover {
    background: transparent;
    color: var(--fg);
  }
  .nt-settings-btn:focus-visible {
    outline: none;
  }
  .nt-settings-btn svg { display: block; width: 22px; height: 22px; }
  .nt-settings-menu {
    display: none;
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    left: auto;
    min-width: 11.5rem;
    max-width: min(92vw, 16rem);
    max-height: min(70dvh, 420px);
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0.35rem 0;
    background: var(--card);
    border: 1px solid var(--nt-popover-border);
    border-radius: 12px;
    box-shadow: var(--nt-modal-shadow);
    z-index: 70;
    scrollbar-width: thin;
  }
  .nt-settings-menu::-webkit-scrollbar {
    width: 5px;
  }
  .nt-bg-presets {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    padding: 0 0.55rem 0.65rem;
  }
  .nt-bg-swatch {
    margin: 0;
    padding: 0;
    width: 100%;
    aspect-ratio: 1;
    min-height: 0;
    border: 2px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    touch-action: manipulation;
    box-sizing: border-box;
    transition: border-color 0.15s ease, transform 0.12s ease;
    -webkit-appearance: none;
    appearance: none;
  }
  .nt-bg-swatch:hover {
    transform: scale(1.04);
  }
  .nt-bg-swatch:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .nt-bg-swatch.nt-picked {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .nt-bg-swatch--default {
    background: conic-gradient(from 180deg, #6c9eff, #1a1a22, #eaeaf0, #6c9eff);
  }
  .nt-bg-photos-h { border-top: 1px solid var(--nt-popover-border); margin-top: 0.15rem; padding-top: 0.5rem; }
  .nt-bg-photos {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    padding: 0 0.55rem 0.65rem;
  }
  .nt-bg-photos.nt-bg-photos--empty { display: none; }
  .nt-bg-photos-h.nt-bg-photos-h--empty { display: none; }
  .nt-bg-photo {
    margin: 0;
    padding: 0;
    width: 100%;
    aspect-ratio: 1;
    min-height: 0;
    border: 2px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    background-size: cover;
    background-position: center;
    touch-action: manipulation;
    -webkit-appearance: none;
    appearance: none;
    transition: border-color 0.15s ease, transform 0.12s ease;
  }
  .nt-bg-photo:hover { transform: scale(1.04); }
  .nt-bg-photo:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .nt-bg-photo.nt-picked {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .nt-settings-anchor.nt-menu-open .nt-settings-menu { display: block; }
  .nt-settings-menu-h {
    padding: 0.45rem 0.85rem 0.35rem;
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
    border-bottom: 1px solid var(--nt-popover-border);
    margin-bottom: 0.2rem;
  }
  .nt-settings-opt {
    display: block; width: 100%; box-sizing: border-box;
    margin: 0; padding: 0.55rem 0.85rem;
    border: none; background: transparent; color: var(--fg);
    font: inherit; font-size: 0.88rem; text-align: left;
    cursor: pointer; touch-action: manipulation;
  }
  .nt-settings-opt:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .nt-settings-opt.nt-picked { color: var(--accent); font-weight: 600; }
  .nt-settings-opt:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 38%, transparent);
  }
  .nt-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 20px;
    transition: opacity 0.15s ease;
  }
  .nt-tile.nt-dragging {
    opacity: 0.55;
    z-index: 5;
  }
  .nt-tile.nt-drag-target .nt-tile-hit {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 55%, transparent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .nt-tile-hit {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    margin: 0;
    padding: 1.15rem 1.08rem 0.95rem;
    border: none;
    border-radius: 20px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    touch-action: manipulation;
    transition: background 0.14s ease, box-shadow 0.14s ease;
    box-sizing: border-box;
    min-height: min(8.35rem, 32vw);
  }
  .nt-tile-hit:hover { background: color-mix(in srgb, var(--fg) 7%, transparent); }
  .nt-tile-hit.nt-tile-hit--draggable {
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  }
  .nt-tile-hit.nt-tile-hit--draggable:active {
    cursor: grabbing;
  }
  .nt-tile.nt-dragging .nt-tile-hit.nt-tile-hit--draggable {
    cursor: grabbing;
  }
  .nt-tile-hit:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 38%, transparent);
  }
  .nt-av {
    position: relative;
    width: min(64px, 18vw); height: min(64px, 18vw); margin: 0 auto; border-radius: 50%;
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    font-size: clamp(1.1rem, 4vw, 1.35rem); font-weight: 600; color: var(--nt-tile-label);
    background: linear-gradient(145deg, #4a6fa5, #2d4a73);
    box-shadow: 0 4px 16px rgba(0,0,0,0.35);
  }.nt-av.nt-has-icon {
    background: transparent;
    box-shadow: none;
  }
  .nt-av .nt-favico {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 10%;
    box-sizing: border-box;
    object-fit: contain;
    object-position: center;
    border-radius: 0;
  }
  .nt-av-fallback { position: relative; z-index: 0; pointer-events: none; }
  .nt-av.nt-has-icon .nt-av-fallback { display: none; }
  .nt-dial > .nt-tile:nth-child(5n+1) .nt-av:not(.nt-has-icon) { background: linear-gradient(145deg, #5c6bc0, #3949ab); }
  .nt-dial > .nt-tile:nth-child(5n+2) .nt-av:not(.nt-has-icon) { background: linear-gradient(145deg, #43a047, #2e7d32); }
  .nt-dial > .nt-tile:nth-child(5n+3) .nt-av:not(.nt-has-icon) { background: linear-gradient(145deg, #8e24aa, #6a1b9a); }
  .nt-dial > .nt-tile:nth-child(5n+4) .nt-av:not(.nt-has-icon) { background: linear-gradient(145deg, #ff7043, #e64a19); }
  .nt-dial > .nt-tile:nth-child(5n) .nt-av:not(.nt-has-icon) { background: linear-gradient(145deg, #78909c, #546e7a); }
  .nt-tile-menu-anchor {
    position: absolute;
    top: 0.26rem;
    right: 0.26rem;
    left: auto;
    z-index: 8;
  }
  .nt-tile-more {
    display: flex;
    align-items: center;
    justify-content: center;
    width: min(30px, 7.5vw);
    height: min(30px, 7.5vw);
    min-height: 0;
    margin: 0;
    margin-top: 0;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: color-mix(in srgb, var(--fg) 58%, transparent);
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    touch-action: manipulation;
    transition: opacity 0.15s ease, background 0.12s ease, color 0.12s ease;
    box-sizing: border-box;
  }
  .nt-tile-more-icon {
    display: block;
    pointer-events: none;
  }
  .nt-tile:hover .nt-tile-more,
  .nt-tile:focus-within .nt-tile-more,
  .nt-tile-menu-anchor.nt-open .nt-tile-more,
  .nt-tile-more:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }
  @media (hover: none) {
    .nt-tile-more {
      opacity: 0.82;
      pointer-events: auto;
    }
  }
  .nt-tile-more:hover,
  .nt-tile-menu-anchor.nt-open .nt-tile-more {
    background: color-mix(in srgb, var(--fg) 12%, transparent);
    color: var(--fg);
  }
  .nt-tile-more:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .nt-tile-menu {
    display: none;
    position: absolute;
    top: calc(100% + 5px);
    right: 0;
    min-width: 10rem;
    padding: 0.32rem 0;
    margin: 0;
    background: var(--card);
    border: 1px solid var(--nt-popover-border);
    border-radius: 11px;
    box-shadow: var(--nt-popover-shadow);
    z-index: 90;
    text-align: left;
  }
  .nt-tile-menu-anchor.nt-open .nt-tile-menu {
    display: block;
  }
  .nt-tile-menu-item {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin: 0;
    margin-top: 0;
    padding: 0.52rem 0.9rem;
    border: none;
    border-radius: 0;
    background: transparent;
    color: var(--fg);
    font: inherit;
    font-size: 0.88rem;
    text-align: left;
    cursor: pointer;
    min-height: 0;
    touch-action: manipulation;
  }
  .nt-tile-menu-item:hover {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .nt-tile-menu-item:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 38%, transparent);
  }
  .nt-tile-menu-item--danger {
    color: var(--danger);
  }
  .nt-tile-menu-item--danger:hover {
    background: color-mix(in srgb, var(--danger) 18%, transparent);
    color: var(--danger);
  }
  .nt-lbl { display: block; margin-top: 0.4rem; font-size: clamp(0.72rem, 2.5vw, 0.8rem); color: var(--fg); opacity: 0.92; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  @media (max-width: 560px) {
    .nt-search-icon {
      width: 3rem;
      min-width: 3rem;
    }
    .nt-q {
      padding: 0.75rem 0.9rem 0.75rem 0.3rem;
    }
    .nt-dial-wrap {
      grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
      gap: 0.45rem clamp(0.3rem, 1.2vw, 0.55rem);
    }
    .nt-av { width: 52px; height: 52px; }
    .nt-tile-hit { padding: 1.05rem 0.82rem 0.85rem; min-height: min(7.2rem, 40vw); }
    .nt-tile-menu-anchor {
      top: 0.2rem;
      right: 0.2rem;
    }
    .nt-tile-more {
      width: min(28px, 7vw);
      height: min(28px, 7vw);
    }
  }

  @media (min-width: 561px) and (max-width: 900px) {
    .nt-wrap { padding-left: 1.25rem; padding-right: 1.25rem; }
  }
`

const NEW_TAB_BODY = `<div class="nt-wrap">
  <div class="nt-settings-anchor" id="ntSettingsAnchor">
    <div class="nt-settings-bar">
      <a class="nt-about-link" href="velo://about">About</a>
      <span class="nt-settings-hint" aria-hidden="true">Page's Settings</span>
      <button type="button" class="nt-settings-btn" id="ntSettingsBtn" aria-label="New tab page options" aria-haspopup="true" aria-expanded="false">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
      </button>
    </div>
    <div class="nt-settings-menu" id="ntSettingsMenu" role="menu" aria-label="Shortcuts">
      <div class="nt-settings-menu-h" role="presentation">Shortcuts</div>
      <button type="button" class="nt-settings-opt" id="ntShortOn" role="menuitemradio" data-shorts="on" aria-checked="true">On</button>
      <button type="button" class="nt-settings-opt" id="ntShortOff" role="menuitemradio" data-shorts="off" aria-checked="false">Off</button>
      <div class="nt-settings-menu-h" role="presentation">Page background</div>
      <div class="nt-bg-presets" id="ntBgPresets" role="group" aria-label="Solid colors"></div>
      <div class="nt-settings-menu-h nt-bg-photos-h" id="ntBgPhotosHeading" role="presentation">Photos</div>
      <div class="nt-bg-photos" id="ntBgPhotos" role="group" aria-label="Photos from browser-backgrounds"></div>
    </div>
  </div>
  <div class="nt-brand-row">
    <img class="nt-brand-logo" src="velo:///Velo.png" alt="" width="52" height="52" decoding="async" />
    <div class="nt-brand">Vel<span>o</span></div>
  </div>
  <form id="nf" action="#">
    <div class="nt-search-bar">
      <span class="nt-search-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      </span>
      <input type="text" id="q" class="nt-q" placeholder="Search the web or enter a URL" autocomplete="off" enterkeyhint="search" />
    </div>
  </form>
  <p class="nt-diag" id="ntDiag"></p>
  <div class="nt-dial-wrap" id="dialWrap">
    <div class="nt-dial" id="dial"></div>
    <button type="button" class="nt-add-fab" id="addToggle" aria-label="Add shortcut">
      <span class="nt-add-fab-icon" aria-hidden="true">+</span>
    </button>
  </div>
</div>
<div class="nt-modal-backdrop" id="favModal" aria-hidden="true">
  <div class="nt-modal" role="dialog" aria-modal="true" aria-labelledby="favModalTitle">
    <h2 class="nt-modal-title" id="favModalTitle">Add shortcut</h2>
    <form id="addForm" action="#" autocomplete="off">
      <div class="nt-modal-field">
        <span>Name</span>
        <input type="text" id="nl" name="label" placeholder="e.g. YouTube" maxlength="64" />
      </div>
      <div class="nt-modal-field">
        <span>URL</span>
        <input type="text" id="nu" name="url" placeholder="e.g. youtube.com or https://…" />
      </div>
      <p class="nt-fav-err" id="favErr" aria-live="polite"></p>
      <div class="nt-modal-actions">
        <button type="button" class="nt-cancel" id="favCancel">Cancel</button>
        <button type="submit" class="nt-save" id="nSave">Save</button>
      </div>
    </form>
  </div>
</div>
<script>
(function(){
  try {
  var diag = document.getElementById('ntDiag');
  var api = window.veloPage;
  var q = document.getElementById('q');
  var form = document.getElementById('nf');
  var dial = document.getElementById('dial');
  var dialWrap = document.getElementById('dialWrap');
  var dialDragId = null;
  function clearDialDragTargets() {
    if (!dial) return;
    dial.querySelectorAll('.nt-tile.nt-drag-target').forEach(function (el) {
      el.classList.remove('nt-drag-target');
    });
  }
  var ntSettingsAnchor = document.getElementById('ntSettingsAnchor');
  var ntSettingsBtn = document.getElementById('ntSettingsBtn');
  var ntSettingsMenu = document.getElementById('ntSettingsMenu');
  var ntShortOn = document.getElementById('ntShortOn');
  var ntShortOff = document.getElementById('ntShortOff');
  var favModal = document.getElementById('favModal');
  var addForm = document.getElementById('addForm');
  var addToggle = document.getElementById('addToggle');
  var nl = document.getElementById('nl');
  var nu = document.getElementById('nu');
  var favErr = document.getElementById('favErr');
  var favCancel = document.getElementById('favCancel');
  var favModalTitleEl = document.getElementById('favModalTitle');
  var favEditId = null;
  function closeAllTileMenus() {
    document.querySelectorAll('.nt-tile-menu-anchor.nt-open').forEach(function (a) {
      a.classList.remove('nt-open');
      var ob = a.querySelector('.nt-tile-more');
      if (ob) ob.setAttribute('aria-expanded', 'false');
    });
  }
  function shortcutIconParts(url) {
    var raw = String(url).trim();
    if (raw.toLowerCase().startsWith('velo://')) return { primary: '', fallback: '' };
    try {
      var u = new URL(raw.indexOf('://') === -1 ? 'https://' + raw : raw);
      if (!u.hostname) return { primary: '', fallback: '' };
      var host = u.hostname;
      var origin =
        u.protocol === 'https:' || u.protocol === 'http:'
          ? u.origin
          : 'https://' + host;
      return {
        primary: origin + '/favicon.ico',
        fallback: 'https://www.google.com/s2/favicons?sz=128&domain=' + encodeURIComponent(host)
      };
    } catch (e) {
      return { primary: '', fallback: '' };
    }
  }
  function openFavModalForAdd() {
    if (!favModal || !addForm) {
      if (diag) diag.textContent = 'Could not open dialog.';
      return;
    }
    favEditId = null;
    if (favModalTitleEl) favModalTitleEl.textContent = 'Add shortcut';
    if (favErr) favErr.textContent = '';
    favModal.classList.add('nt-open');
    favModal.setAttribute('aria-hidden', 'false');
    if (!window.veloPage) {
      var t = 'Shortcuts need the tab preload (window.veloPage). Try restarting the app.';
      if (favErr) favErr.textContent = t;
      if (diag) diag.textContent = t;
    } else if (diag) diag.textContent = '';
    if (nl) nl.value = '';
    if (nu) nu.value = '';
    setTimeout(function () { if (nl) nl.focus(); }, 0);
  }
  function openFavModalForEdit(row) {
    if (!favModal || !addForm) {
      if (diag) diag.textContent = 'Could not open dialog.';
      return;
    }
    closeAllTileMenus();
    favEditId = row.id;
    if (favModalTitleEl) favModalTitleEl.textContent = 'Edit shortcut';
    if (favErr) favErr.textContent = '';
    favModal.classList.add('nt-open');
    favModal.setAttribute('aria-hidden', 'false');
    if (!window.veloPage) {
      var msg = 'Shortcuts need the tab preload (window.veloPage). Try restarting the app.';
      if (favErr) favErr.textContent = msg;
      if (diag) diag.textContent = msg;
    } else if (diag) diag.textContent = '';
    if (nl) nl.value = row.label || '';
    if (nu) nu.value = row.url || '';
    setTimeout(function () { if (nl) nl.focus(); }, 0);
  }
  window.__veloOpenModal = openFavModalForAdd;
  function closeFavModal() {
    if (!favModal) return;
    favEditId = null;
    favModal.classList.remove('nt-open');
    favModal.setAttribute('aria-hidden', 'true');
  }
  if (!addToggle && diag) diag.textContent = 'Add shortcut control missing.';
  if (!api) {
    if (diag && !diag.textContent) diag.textContent = 'Internal page API not loaded. Try restarting the app.';
    if (ntSettingsAnchor) ntSettingsAnchor.style.display = 'none';
    if (addForm) {
      addForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (favErr) favErr.textContent = 'Cannot save shortcuts until the page API is available.';
      });
    }
    return;
  }
  function setShortcutsMenuPicked(on) {
    if (ntShortOn) {
      ntShortOn.classList.toggle('nt-picked', on);
      ntShortOn.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    if (ntShortOff) {
      ntShortOff.classList.toggle('nt-picked', !on);
      ntShortOff.setAttribute('aria-checked', on ? 'false' : 'true');
    }
  }
  function setShortcutsChromeEnabled(on) {
    if (!dialWrap) return;
    if (on) {
      dialWrap.removeAttribute('hidden');
      dialWrap.style.display = '';
      if (addToggle) {
        addToggle.removeAttribute('hidden');
        addToggle.style.display = '';
      }
    } else {
      dialWrap.setAttribute('hidden', '');
      dialWrap.style.display = 'none';
      if (dial) dial.textContent = '';
    }
  }
  function closeNtSettingsMenu() {
    if (!ntSettingsAnchor || !ntSettingsBtn) return;
    ntSettingsAnchor.classList.remove('nt-menu-open');
    ntSettingsBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleNtSettingsMenu() {
    if (!ntSettingsAnchor || !ntSettingsBtn) return;
    var open = ntSettingsAnchor.classList.toggle('nt-menu-open');
    ntSettingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (ntSettingsBtn) {
    ntSettingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleNtSettingsMenu();
    });
  }
  if (ntShortOn) {
    ntShortOn.addEventListener('click', function () {
      api.setSettings({ newTabShortcutsEnabled: true }).then(function () {
        setShortcutsChromeEnabled(true);
        setShortcutsMenuPicked(true);
        renderDial();
        closeNtSettingsMenu();
      }).catch(function () {});
    });
  }
  if (ntShortOff) {
    ntShortOff.addEventListener('click', function () {
      api.setSettings({ newTabShortcutsEnabled: false }).then(function () {
        setShortcutsChromeEnabled(false);
        setShortcutsMenuPicked(false);
        closeNtSettingsMenu();
      }).catch(function () {});
    });
  }
  document.addEventListener('click', function (e) {
    if (!ntSettingsAnchor || !ntSettingsAnchor.classList.contains('nt-menu-open')) return;
    var t = e.target;
    if (t && ntSettingsAnchor.contains(t)) return;
    closeNtSettingsMenu();
  });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('.nt-tile-menu-anchor')) return;
    closeAllTileMenus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeNtSettingsMenu();
      closeAllTileMenus();
      if (favModal && favModal.classList.contains('nt-open')) closeFavModal();
    }
  });
  document.addEventListener('dragend', function () {
    dialDragId = null;
    if (dial) {
      dial.querySelectorAll('.nt-tile.nt-dragging').forEach(function (el) {
        el.classList.remove('nt-dragging');
      });
    }
    clearDialDragTargets();
  });
  var ntBgMeta = window.__NT_BG_META || { presets: [], labels: {}, hex: {}, files: [] };
  function syncNtBgPicked(bg) {
    document.querySelectorAll('.nt-bg-swatch').forEach(function (el) {
      el.classList.remove('nt-picked');
      el.setAttribute('aria-checked', 'false');
    });
    document.querySelectorAll('.nt-bg-photo').forEach(function (el) {
      el.classList.remove('nt-picked');
      el.setAttribute('aria-checked', 'false');
    });
    if (!bg) return;
    if (bg.kind === 'preset') {
      var sw = document.querySelector('.nt-bg-swatch[data-preset="' + bg.preset + '"]');
      if (sw) {
        sw.classList.add('nt-picked');
        sw.setAttribute('aria-checked', 'true');
      }
    } else if (bg.kind === 'image') {
      var ph = document.querySelector('.nt-bg-photo[data-file="' + bg.filename + '"]');
      if (ph) {
        ph.classList.add('nt-picked');
        ph.setAttribute('aria-checked', 'true');
      }
    }
  }
  var ntBgPickersReady = false;
  function initNtBackgroundPickers(s) {
    var presetsEl = document.getElementById('ntBgPresets');
    var photosEl = document.getElementById('ntBgPhotos');
    var photosHead = document.getElementById('ntBgPhotosHeading');
    if (!presetsEl) return;
    if (!ntBgPickersReady) {
      ntBgPickersReady = true;
      (ntBgMeta.presets || []).forEach(function (preset) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nt-bg-swatch' + (preset === 'default' ? ' nt-bg-swatch--default' : '');
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', 'false');
        btn.dataset.preset = preset;
        var lab = (ntBgMeta.labels && ntBgMeta.labels[preset]) || preset;
        btn.setAttribute('aria-label', 'Background: ' + lab);
        if (preset !== 'default' && ntBgMeta.hex && ntBgMeta.hex[preset]) {
          btn.style.background = ntBgMeta.hex[preset];
        }
        presetsEl.appendChild(btn);
      });
      if (photosEl && photosHead) {
        var files = ntBgMeta.files || [];
        if (files.length === 0) {
          photosEl.classList.add('nt-bg-photos--empty');
          photosHead.classList.add('nt-bg-photos-h--empty');
        } else {
          files.forEach(function (fn) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'nt-bg-photo';
            b.setAttribute('role', 'radio');
            b.setAttribute('aria-checked', 'false');
            b.dataset.file = fn;
            b.setAttribute('aria-label', 'Background photo: ' + fn);
            b.style.backgroundImage = 'url(\"velo:///browser-backgrounds/' + encodeURIComponent(fn) + '\")';
            photosEl.appendChild(b);
          });
        }
      }
      presetsEl.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var btn = t.closest('.nt-bg-swatch');
        if (!btn || !btn.dataset.preset) return;
        e.stopPropagation();
        api.setSettings({ newTabBackground: { kind: 'preset', preset: btn.dataset.preset } }).catch(function () {});
      });
      if (photosEl) {
        photosEl.addEventListener('click', function (e) {
          var t = e.target;
          if (!t || !t.closest) return;
          var btn = t.closest('.nt-bg-photo');
          if (!btn || !btn.dataset.file) return;
          e.stopPropagation();
          api.setSettings({ newTabBackground: { kind: 'image', filename: btn.dataset.file } }).catch(function () {});
        });
      }
    }
    syncNtBgPicked(s && s.newTabBackground ? s.newTabBackground : null);
  }
  function loadPageSettings() {
    api
      .getSettings()
      .then(function (s) {
        var on = s.newTabShortcutsEnabled !== false;
        setShortcutsMenuPicked(on);
        setShortcutsChromeEnabled(on);
        if (on) renderDial();
        initNtBackgroundPickers(s);
      })
      .catch(function () {
        setShortcutsMenuPicked(true);
        setShortcutsChromeEnabled(true);
        renderDial();
        initNtBackgroundPickers({ newTabBackground: { kind: 'preset', preset: 'default' } });
      });
  }
  if (form && q) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = q.value.trim();
      if (!v) return;
      api.navigateSearch(v).catch(function () {});
    });
  }
  if (favCancel) favCancel.addEventListener('click', closeFavModal);
  if (favModal) {
    favModal.addEventListener('click', function (e) {
      if (e.target === favModal) closeFavModal();
    });
    var modalCard = favModal.querySelector('.nt-modal');
    if (modalCard) modalCard.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  if (addForm && nl && nu) {
    addForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (favErr) favErr.textContent = '';
      var label = nl.value.trim();
      var url = nu.value.trim();
      if (!label || !url) {
        if (favErr) favErr.textContent = 'Enter a name and a URL.';
        return;
      }
      var saveFn = favEditId
        ? function () { return api.updateNewTabShortcut(favEditId, label, url); }
        : function () { return api.addNewTabShortcut(label, url); };
      saveFn()
        .then(function () {
          closeFavModal();
          renderDial();
        })
        .catch(function (err) {
          var m = err && err.message ? String(err.message) : 'Could not save.';
          if (favErr) favErr.textContent = m;
        });
    });
  }
  if (addToggle) {
    addToggle.addEventListener(
      'click',
      function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openFavModalForAdd();
      },
      true
    );
  }
  function renderDial() {
    if (!dial || !dialWrap || dialWrap.hasAttribute('hidden')) return;
    api.getNewTabShortcuts().then(function (rows) {
      dial.textContent = '';
      rows.forEach(function (row) {
        var ch = (row.label && row.label.charAt(0)) ? row.label.charAt(0).toUpperCase() : '?';
        var wrap = document.createElement('div');
        wrap.className = 'nt-tile';
        wrap.dataset.shortcutId = row.id;
        var hit = document.createElement('button');
        hit.type = 'button';
        hit.className = 'nt-tile-hit nt-tile-hit--draggable';
        hit.setAttribute('draggable', 'true');
        hit.setAttribute('aria-label', 'Open ' + row.label);
        var suppressNavClickUntil = 0;
        hit.addEventListener('dragstart', function (e) {
          if (!e.dataTransfer) return;
          closeAllTileMenus();
          closeNtSettingsMenu();
          dialDragId = row.id;
          e.dataTransfer.setData('text/plain', row.id);
          e.dataTransfer.effectAllowed = 'move';
          wrap.classList.add('nt-dragging');
        });
        hit.addEventListener('dragend', function () {
          dialDragId = null;
          wrap.classList.remove('nt-dragging');
          clearDialDragTargets();
          suppressNavClickUntil = Date.now() + 150;
        });
        hit.addEventListener('click', function (ev) {
          if (Date.now() < suppressNavClickUntil) {
            ev.preventDefault();
            ev.stopPropagation();
            return;
          }
          api.navigateUrl(row.url).catch(function () {});
        });
        var av = document.createElement('div');
        av.className = 'nt-av';
        var fallback = document.createElement('span');
        fallback.className = 'nt-av-fallback';
        fallback.textContent = ch;
        fallback.setAttribute('aria-hidden', 'true');
        var parts = shortcutIconParts(row.url);
        if (parts.primary) {
          var img = document.createElement('img');
          img.className = 'nt-favico';
          img.src = parts.primary;
          img.alt = '';
          img.decoding = 'async';
          img.referrerPolicy = 'no-referrer';
          var fb = parts.fallback;
          img.addEventListener('load', function () {
            var w = img.naturalWidth;
            var h = img.naturalHeight;if (fb && img.src !== fb && w > 0 && h > 0 && w <= 36 && h <= 36) {
              img.src = fb;
              return;
            }
            av.classList.add('nt-has-icon');
          });
          img.addEventListener('error', function () {
            if (fb && img.src !== fb) {
              img.src = fb;
              return;
            }
            img.remove();
          });
          av.appendChild(img);
        }
        av.appendChild(fallback);
        hit.appendChild(av);
        var lbl = document.createElement('span');
        lbl.className = 'nt-lbl';
        lbl.textContent = row.label;
        hit.appendChild(lbl);
        wrap.appendChild(hit);
        var menuAnchor = document.createElement('div');
        menuAnchor.className = 'nt-tile-menu-anchor';
        var moreBtn = document.createElement('button');
        moreBtn.type = 'button';
        moreBtn.className = 'nt-tile-more';
        moreBtn.setAttribute('aria-label', 'Options for ' + row.label);
        moreBtn.setAttribute('aria-haspopup', 'true');
        moreBtn.setAttribute('aria-expanded', 'false');
        moreBtn.innerHTML =
          '<svg class="nt-tile-more-icon" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><circle cx="5" cy="12" r="1.85" fill="currentColor"/><circle cx="12" cy="12" r="1.85" fill="currentColor"/><circle cx="19" cy="12" r="1.85" fill="currentColor"/></svg>';
        var tileMenu = document.createElement('div');
        tileMenu.className = 'nt-tile-menu';
        tileMenu.setAttribute('role', 'menu');
        var editOpt = document.createElement('button');
        editOpt.type = 'button';
        editOpt.className = 'nt-tile-menu-item';
        editOpt.setAttribute('role', 'menuitem');
        editOpt.textContent = 'Edit shortcut';
        var remOpt = document.createElement('button');
        remOpt.type = 'button';
        remOpt.className = 'nt-tile-menu-item nt-tile-menu-item--danger';
        remOpt.setAttribute('role', 'menuitem');
        remOpt.textContent = 'Remove';
        tileMenu.appendChild(editOpt);
        tileMenu.appendChild(remOpt);
        menuAnchor.appendChild(moreBtn);
        menuAnchor.appendChild(tileMenu);
        moreBtn.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          closeNtSettingsMenu();
          var wasOpen = menuAnchor.classList.contains('nt-open');
          document.querySelectorAll('.nt-tile-menu-anchor.nt-open').forEach(function (a) {
            if (a === menuAnchor) return;
            a.classList.remove('nt-open');
            var ob = a.querySelector('.nt-tile-more');
            if (ob) ob.setAttribute('aria-expanded', 'false');
          });
          if (wasOpen) {
            menuAnchor.classList.remove('nt-open');
            moreBtn.setAttribute('aria-expanded', 'false');
          } else {
            menuAnchor.classList.add('nt-open');
            moreBtn.setAttribute('aria-expanded', 'true');
          }
        });
        editOpt.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          closeAllTileMenus();
          openFavModalForEdit(row);
        });
        remOpt.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          closeAllTileMenus();
          api.removeNewTabShortcut(row.id).then(function () { renderDial(); }).catch(function () {});
        });
        wrap.addEventListener('dragover', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var fromId = dialDragId;
          if (!fromId || fromId === row.id) return;
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          wrap.classList.add('nt-drag-target');
        });
        wrap.addEventListener('dragleave', function (e) {
          e.stopPropagation();
          var rel = e.relatedTarget;
          if (!rel || !wrap.contains(rel)) wrap.classList.remove('nt-drag-target');
        });
        wrap.addEventListener('drop', function (e) {
          e.preventDefault();
          e.stopPropagation();
          wrap.classList.remove('nt-drag-target');
          var fromId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
          var toId = row.id;
          if (!fromId || fromId === toId || !dial) return;
          var tiles = Array.prototype.slice.call(dial.querySelectorAll('.nt-tile'));
          var order = tiles
            .map(function (t) {
              return t.dataset.shortcutId;
            })
            .filter(Boolean);
          var fromIdx = order.indexOf(fromId);
          var toIdx = order.indexOf(toId);
          if (fromIdx < 0 || toIdx < 0) return;
          var next = order.slice();
          next.splice(fromIdx, 1);
          next.splice(toIdx, 0, fromId);
          api
            .reorderNewTabShortcuts(next)
            .then(function () {
              renderDial();
            })
            .catch(function () {});
        });
        wrap.appendChild(menuAnchor);
        dial.appendChild(wrap);
      });
    }).catch(function () {});
  }
  loadPageSettings();
  setTimeout(function () { if (q) q.focus(); }, 0);
  } catch (err) {
    console.error('[velo newtab] fatal script error', err);
    var d = document.getElementById('ntDiag');
    if (d) d.textContent = err && err.message ? err.message : 'New tab script failed.';
  }
})();
</script>`


export function renderNewTabPage(): string {
  const s = getSettings()
  const bgInject = buildNewTabBackgroundHtml(s.newTabBackground)
  const boot = `<script>window.__NT_BG_META=${JSON.stringify({
    presets: [...NEW_TAB_BACKGROUND_PRESETS],
    labels: NT_PRESET_LABELS,
    hex: NEW_TAB_PRESET_HEX,
    files: listBrowserBackgroundBasenames()
  })};<\/script>`
  return veloPageHtml(
    'New tab',
    boot + NEW_TAB_BODY,
    NEW_TAB_EXTRA + bgInject.styleBlock,
    s.browserChromeTheme,
    bgInject.htmlAttrs
  )
}
