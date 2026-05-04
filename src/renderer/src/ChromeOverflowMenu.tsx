import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX
} from 'react'
import { createPortal } from 'react-dom'
import { OVERFLOW_MENU_SHELL_RESERVE } from '@shared/constants'
import {
  IconAppWindow,
  IconDownload,
  IconGear,
  IconGlobe,
  IconHistory,
  IconListMenu,
  IconLock,
  IconMore,
  IconPlus,
  IconStarOutline,
  IconTabClose,
  IconWrench
} from './ChromeIcons'

function isMac(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')
}

type Anchor = { left: number; right: number; bottom: number }

type ChromeOverflowMenuProps = {
  showMakeDefaultBrowser?: boolean
  onMakeDefaultBrowser?: () => void | Promise<void>
}

export function ChromeOverflowMenu({
  showMakeDefaultBrowser = false,
  onMakeDefaultBrowser
}: ChromeOverflowMenuProps): JSX.Element {
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [canBookmark, setCanBookmark] = useState(false)
  const mod = isMac() ? 'Cmd' : 'Ctrl'

  const close = useCallback(() => {
    setOpen(false)
    setAnchor(null)
  }, [])

  const refreshBookmarkState = useCallback(async (): Promise<void> => {
    const { tabs, activeId } = await window.velo.tabsGetState()
    const active = tabs.find((t) => t.id === activeId)
    setCanBookmark(Boolean(active?.url))
  }, [])

  const navigateInternal = useCallback(async (path: string): Promise<void> => {
    const url = `velo://${path.replace(/^\/+/, '')}`
    const { tabs, activeId } = await window.velo.tabsGetState()
    if (activeId != null) await window.velo.navSubmit(activeId, url)
    else await window.velo.tabsCreate(url)
  }, [])

  const measureAndOpen = useCallback(async (): Promise<void> => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setAnchor({
      left: r.left,
      right: r.right,
      bottom: r.bottom
    })
    await refreshBookmarkState()
    setOpen(true)
  }, [refreshBookmarkState])

  const toggle = useCallback((): void => {
    if (open) close()
    else void measureAndOpen()
  }, [open, close, measureAndOpen])

  useLayoutEffect(() => {
    const reserve = open ? OVERFLOW_MENU_SHELL_RESERVE : 0
    let cancelled = false
    void window.velo.shellOverflowMenuSetReserve(reserve).then(() => {
      if (cancelled) return
      void window.velo.shellEnsureChromeOnTop()
      if (open && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect()
        setAnchor({ left: r.left, right: r.right, bottom: r.bottom })
        requestAnimationFrame(() => {
          if (cancelled) return
          const b = btnRef.current?.getBoundingClientRect()
          if (b) setAnchor({ left: b.left, right: b.right, bottom: b.bottom })
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    return () => {
      void window.velo.shellOverflowMenuSetReserve(0)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const reposition = (): void => {
      const el = btnRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setAnchor({ left: r.left, right: r.right, bottom: r.bottom })
    }
    window.addEventListener('resize', reposition)
    return () => window.removeEventListener('resize', reposition)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent): void => {
      const node = e.target as Node
      if (btnRef.current?.contains(node)) return
      if (panelRef.current?.contains(node)) return
      close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const runAction = useCallback(
    async (fn: () => void | Promise<void>): Promise<void> => {
      await fn()
      close()
    },
    [close]
  )

  const panelStyle: CSSProperties | null =
    anchor && open
      ? {
          top: Math.round(anchor.bottom + 4),
          right: Math.round(window.innerWidth - anchor.right),
          visibility: 'visible' as const
        }
      : { top: 0, right: 0, visibility: 'hidden' as const }

  const panel =
    open && anchor ? (
      <div
        ref={panelRef}
        className="shell-overflow-panel no-drag"
        role="menu"
        aria-label="Browser menu"
        style={panelStyle}
      >
        {showMakeDefaultBrowser ? (
          <>
            <button
              type="button"
              role="menuitem"
              className="shell-overflow-item"
              onClick={() =>
                void runAction(async () => {
                  if (onMakeDefaultBrowser) await onMakeDefaultBrowser()
                })
              }
            >
              <span className="shell-overflow-ic" aria-hidden>
                <IconGlobe size={18} />
              </span>
              <span className="shell-overflow-label">Make Velo your default browser</span>
            </button>
            <div className="shell-overflow-sep" role="separator" />
          </>
        ) : null}
        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item"
          onClick={() => void runAction(() => void window.velo.tabsCreate('velo://newtab'))}
        >
          <span className="shell-overflow-ic" aria-hidden>
            <IconPlus size={18} />
          </span>
          <span className="shell-overflow-label">New tab</span>
          <span className="shell-overflow-kbd">
            {mod}+T
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item"
          disabled={!canBookmark}
          onClick={() =>
            void runAction(async () => {
              const { tabs, activeId } = await window.velo.tabsGetState()
              const cur = tabs.find((t) => t.id === activeId)
              if (!cur?.url) return
              const list = await window.velo.bookmarksList()
              const hit = list.find((b) => b.url === cur.url)
              if (hit) {
                await window.velo.bookmarksRemove(hit.id)
                window.dispatchEvent(new CustomEvent('velo-bookmarks-mutated'))
              } else {
                window.dispatchEvent(
                  new CustomEvent('velo-open-bookmark-save', {
                    detail: { url: cur.url, title: cur.title, favicon: cur.favicon }
                  })
                )
              }
            })
          }
        >
          <span className="shell-overflow-ic" aria-hidden>
            <IconStarOutline size={18} />
          </span>
          <span className="shell-overflow-label">Bookmark this tab</span>
          <span className="shell-overflow-kbd">{mod}+D</span>
        </button>

        <div className="shell-overflow-sep" role="separator" />

        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item"
          onClick={() => void runAction(() => navigateInternal('settings/history'))}
        >
          <span className="shell-overflow-ic" aria-hidden>
            <IconHistory size={18} />
          </span>
          <span className="shell-overflow-label">History</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item"
          onClick={() => void runAction(() => navigateInternal('settings/downloads'))}
        >
          <span className="shell-overflow-ic" aria-hidden>
            <IconDownload size={18} />
          </span>
          <span className="shell-overflow-label">Downloads</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item"
          onClick={() => void runAction(() => navigateInternal('settings/bookmarks'))}
        >
          <span className="shell-overflow-ic" aria-hidden>
            <IconListMenu size={18} />
          </span>
          <span className="shell-overflow-label">Bookmarks</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item"
          onClick={() => void runAction(() => navigateInternal('settings/password-manager'))}
        >
          <span className="shell-overflow-ic" aria-hidden>
            <IconLock size={18} />
          </span>
          <span className="shell-overflow-label">Passwords &amp; autofill</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item"
          onClick={() => void runAction(() => navigateInternal('settings/appearance'))}
        >
          <span className="shell-overflow-ic" aria-hidden>
            <IconGear size={18} />
          </span>
          <span className="shell-overflow-label">Settings</span>
        </button>

        <div className="shell-overflow-sep" role="separator" />

        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item"
          onClick={() => void runAction(() => void window.velo.devtoolsOpenPage())}
        >
          <span className="shell-overflow-ic" aria-hidden>
            <IconWrench size={18} />
          </span>
          <span className="shell-overflow-label">Developer tools</span>
          <span className="shell-overflow-kbd">
            {mod}+Shift+I
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item"
          onClick={() => void runAction(() => void window.velo.devtoolsOpenShell())}
        >
          <span className="shell-overflow-ic" aria-hidden>
            <IconAppWindow size={18} />
          </span>
          <span className="shell-overflow-label">Developer tools (Velo UI)</span>
        </button>

        <div className="shell-overflow-sep" role="separator" />

        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item shell-overflow-item--danger"
          onClick={() => void runAction(() => window.velo.windowClose())}
        >
          <span className="shell-overflow-ic" aria-hidden>
            <IconTabClose size={18} />
          </span>
          <span className="shell-overflow-label">Exit</span>
        </button>
      </div>
    ) : null

  return (
    <>
      <div className="chrome-overflow-wrap">
        <button
          ref={btnRef}
          type="button"
          className="chrome-overflow-trigger"
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={open}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggle()}
        >
          <IconMore size={18} />
        </button>
      </div>
      {panel ? createPortal(panel, document.body) : null}
    </>
  )
}
