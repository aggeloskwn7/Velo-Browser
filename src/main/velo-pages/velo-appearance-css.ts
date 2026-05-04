import type { BrowserChromeTheme } from '../../shared/ipc.js'


export const VEL_APPEARANCE_THEME_CSS = `
html[data-chrome-theme='default'] {
  color-scheme: dark;
  --bg: #1a1a1f;
  --bg-elevated: #1a1a22;
  --fg: #eaeaf0;
  --muted: #8b8b9e;
  --accent: #6c9eff;
  --border: #2a2a38;
  --card: #1a1a22;
  --vel-input-bg: #252530;
  --vel-input-hover: #2e2e40;
  --vp-side-border: rgba(255, 255, 255, 0.06);
  --vp-side-bg: linear-gradient(165deg, rgba(24, 24, 30, 0.98) 0%, rgba(16, 16, 22, 0.96) 48%, rgba(14, 14, 20, 0.99) 100%);
  --vp-side-item-fg: rgba(235, 235, 242, 0.58);
  --vp-side-item-hover-fg: rgba(245, 245, 250, 0.92);
  --vp-side-item-hover-bg: rgba(255, 255, 255, 0.055);
  --vp-side-item-hover-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);
  --vp-side-ic-bg: rgba(255, 255, 255, 0.05);
  --vp-side-ic-fg: rgba(235, 235, 242, 0.42);
  --vp-side-ic-hover-bg: rgba(255, 255, 255, 0.08);
  --vp-side-ic-hover-fg: rgba(235, 235, 242, 0.7);
  --vp-side-active-bg: rgba(108, 158, 255, 0.13);
  --vp-side-active-shadow: 0 0 0 1px rgba(108, 158, 255, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --vp-side-active-ic-bg: rgba(108, 158, 255, 0.2);
  --nt-search-bg: #27272f;
  --nt-search-border: rgba(255, 255, 255, 0.07);
  --nt-search-shadow: 0 6px 24px rgba(0, 0, 0, 0.32);
  --nt-search-focus-border: rgba(255, 255, 255, 0.14);
  --nt-search-focus-ring: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 28px rgba(0, 0, 0, 0.38), 0 0 0 3px rgba(255, 255, 255, 0.05);
  --nt-icon-muted: rgba(255, 255, 255, 0.48);
  --nt-fab-fg: rgba(255, 255, 255, 0.6);
  --nt-fab-hover-border: rgba(255, 255, 255, 0.45);
  --nt-fab-hover-fg: rgba(255, 255, 255, 0.96);
  --nt-label: rgba(235, 235, 242, 0.78);
  --nt-sub: rgba(200, 200, 212, 0.85);
  --nt-modal-border: #2a2a36;
  --nt-modal-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  --nt-popover-border: #2a2a36;
  --nt-popover-shadow: 0 14px 44px rgba(0, 0, 0, 0.42);
  --nt-tile-label: #fff;
  --danger: #ff8a80;
}

html[data-chrome-theme='white'] {
  color-scheme: light;--bg: #f4f4f8;
  --bg-elevated: #ffffff;
  --fg: #12121a;
  --muted: #5c5c6e;
  --accent: #2f6fed;
  --border: #d0d0dc;
  --card: #ffffff;
  --vel-input-bg: #ececf2;
  --vel-input-hover: #e0e0ea;
  --vp-side-border: rgba(0, 0, 0, 0.06);
  --vp-side-bg: linear-gradient(165deg, #f6f6fa 0%, #efeff5 48%, #eaeaf0 100%);
  --vp-side-item-fg: rgba(30, 30, 42, 0.62);
  --vp-side-item-hover-fg: rgba(18, 18, 26, 0.92);
  --vp-side-item-hover-bg: rgba(0, 0, 0, 0.04);
  --vp-side-item-hover-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
  --vp-side-ic-bg: rgba(0, 0, 0, 0.05);
  --vp-side-ic-fg: rgba(30, 30, 42, 0.45);
  --vp-side-ic-hover-bg: rgba(0, 0, 0, 0.07);
  --vp-side-ic-hover-fg: rgba(30, 30, 42, 0.68);
  --vp-side-active-bg: rgba(47, 111, 237, 0.12);
  --vp-side-active-shadow: 0 0 0 1px rgba(47, 111, 237, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  --vp-side-active-ic-bg: rgba(47, 111, 237, 0.18);
  --nt-search-bg: #ffffff;
  --nt-search-border: rgba(0, 0, 0, 0.1);
  --nt-search-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
  --nt-search-focus-border: rgba(47, 111, 237, 0.35);
  --nt-search-focus-ring: 0 0 0 1px rgba(47, 111, 237, 0.2), 0 4px 28px rgba(0, 0, 0, 0.12), 0 0 0 3px rgba(47, 111, 237, 0.12);
  --nt-icon-muted: rgba(0, 0, 0, 0.48);
  --nt-fab-fg: rgba(0, 0, 0, 0.56);
  --nt-fab-hover-border: rgba(0, 0, 0, 0.38);
  --nt-fab-hover-fg: rgba(0, 0, 0, 0.9);
  --nt-label: rgba(40, 40, 52, 0.85);
  --nt-sub: rgba(60, 60, 78, 0.72);
  --nt-modal-border: #d0d0dc;
  --nt-modal-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  --nt-popover-border: #d0d0dc;
  --nt-popover-shadow: 0 14px 44px rgba(0, 0, 0, 0.16);
  --nt-tile-label: #fff;
  --danger: #c62828;
}

html[data-chrome-theme='black'] {
  color-scheme: dark;
  --bg: #0a0a0a;
  --bg-elevated: #111111;
  --fg: #f0f0f5;
  --muted: #8e8e9e;
  --accent: #82b1ff;
  --border: #2a2a2e;
  --card: #141414;
  --vel-input-bg: #1a1a1a;
  --vel-input-hover: #242424;
  --vp-side-border: rgba(255, 255, 255, 0.08);
  --vp-side-bg: linear-gradient(165deg, #0e0e0e 0%, #080808 48%, #040404 100%);
  --vp-side-item-fg: rgba(235, 235, 242, 0.55);
  --vp-side-item-hover-fg: rgba(250, 250, 252, 0.95);
  --vp-side-item-hover-bg: rgba(255, 255, 255, 0.06);
  --vp-side-item-hover-shadow: 0 1px 0 rgba(255, 255, 255, 0.05);
  --vp-side-ic-bg: rgba(255, 255, 255, 0.06);
  --vp-side-ic-fg: rgba(235, 235, 242, 0.4);
  --vp-side-ic-hover-bg: rgba(255, 255, 255, 0.1);
  --vp-side-ic-hover-fg: rgba(235, 235, 242, 0.72);
  --vp-side-active-bg: rgba(130, 177, 255, 0.14);
  --vp-side-active-shadow: 0 0 0 1px rgba(130, 177, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --vp-side-active-ic-bg: rgba(130, 177, 255, 0.22);
  --nt-search-bg: #161616;
  --nt-search-border: rgba(255, 255, 255, 0.1);
  --nt-search-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  --nt-search-focus-border: rgba(255, 255, 255, 0.18);
  --nt-search-focus-ring: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 4px 28px rgba(0, 0, 0, 0.5), 0 0 0 3px rgba(130, 177, 255, 0.08);
  --nt-icon-muted: rgba(255, 255, 255, 0.48);
  --nt-fab-fg: rgba(255, 255, 255, 0.62);
  --nt-fab-hover-border: rgba(255, 255, 255, 0.5);
  --nt-fab-hover-fg: rgba(255, 255, 255, 0.98);
  --nt-label: rgba(235, 235, 242, 0.76);
  --nt-sub: rgba(200, 200, 212, 0.8);
  --nt-modal-border: #2c2c30;
  --nt-modal-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  --nt-popover-border: #2c2c30;
  --nt-popover-shadow: 0 14px 44px rgba(0, 0, 0, 0.5);
  --nt-tile-label: #fff;
  --danger: #ff8a80;
}

html[data-chrome-theme='grey'] {
  color-scheme: dark;
  --bg: #35353d;
  --bg-elevated: #3d3d48;
  --fg: #f2f2f8;
  --muted: #a8a8b8;
  --accent: #9ec5ff;
  --border: #52525e;
  --card: #3a3a44;
  --vel-input-bg: #42424c;
  --vel-input-hover: #4a4a56;
  --vp-side-border: rgba(255, 255, 255, 0.09);
  --vp-side-bg: linear-gradient(165deg, rgba(56, 56, 64, 0.98) 0%, rgba(44, 44, 52, 0.96) 48%, rgba(40, 40, 48, 0.99) 100%);
  --vp-side-item-fg: rgba(235, 235, 242, 0.58);
  --vp-side-item-hover-fg: rgba(250, 250, 252, 0.95);
  --vp-side-item-hover-bg: rgba(255, 255, 255, 0.07);
  --vp-side-item-hover-shadow: 0 1px 0 rgba(255, 255, 255, 0.05);
  --vp-side-ic-bg: rgba(255, 255, 255, 0.06);
  --vp-side-ic-fg: rgba(235, 235, 242, 0.42);
  --vp-side-ic-hover-bg: rgba(255, 255, 255, 0.1);
  --vp-side-ic-hover-fg: rgba(235, 235, 242, 0.72);
  --vp-side-active-bg: rgba(158, 197, 255, 0.15);
  --vp-side-active-shadow: 0 0 0 1px rgba(158, 197, 255, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --vp-side-active-ic-bg: rgba(158, 197, 255, 0.22);
  --nt-search-bg: #3e3e48;
  --nt-search-border: rgba(255, 255, 255, 0.1);
  --nt-search-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
  --nt-search-focus-border: rgba(255, 255, 255, 0.16);
  --nt-search-focus-ring: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 28px rgba(0, 0, 0, 0.32), 0 0 0 3px rgba(158, 197, 255, 0.1);
  --nt-icon-muted: rgba(255, 255, 255, 0.5);
  --nt-fab-fg: rgba(255, 255, 255, 0.64);
  --nt-fab-hover-border: rgba(255, 255, 255, 0.52);
  --nt-fab-hover-fg: rgba(255, 255, 255, 0.98);
  --nt-label: rgba(235, 235, 242, 0.8);
  --nt-sub: rgba(210, 210, 222, 0.82);
  --nt-modal-border: #4a4a56;
  --nt-modal-shadow: 0 24px 64px rgba(0, 0, 0, 0.38);
  --nt-popover-border: #4a4a56;
  --nt-popover-shadow: 0 14px 44px rgba(0, 0, 0, 0.35);
  --nt-tile-label: #fff;
  --danger: #ffb4ab;
}
`

export function metaThemeColorForBrowserTheme(t: BrowserChromeTheme): string {
  switch (t) {
    case 'white':
      return '#f4f4f8'
    case 'black':
      return '#000000'
    case 'grey':
      return '#4a4a54'
    default:
      return '#1a1a1f'
  }
}
