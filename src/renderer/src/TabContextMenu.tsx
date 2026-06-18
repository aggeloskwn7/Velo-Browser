import { useCallback, useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { OVERFLOW_MENU_SHELL_RESERVE } from '@shared/constants'

export type TabContextMenuState = {
  tabId: number
  pinned: boolean
  muted: boolean
  isSplit: boolean
  canSplitWithActive: boolean
  x: number
  y: number
} | null

type TabContextMenuProps = {
  menu: TabContextMenuState
  onClose: () => void
  onPin: (tabId: number) => void | Promise<void>
  onUnpin: (tabId: number) => void | Promise<void>
  onSetMuted: (tabId: number, muted: boolean) => void | Promise<void>
  onSplitWithActive: (tabId: number) => void | Promise<void>
  onExitSplit: (tabId: number, mode: 'both' | 'left' | 'right') => void | Promise<void>
}

export function TabContextMenu({
  menu,
  onClose,
  onPin,
  onUnpin,
  onSetMuted,
  onSplitWithActive,
  onExitSplit
}: TabContextMenuProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)
  const [menuReady, setMenuReady] = useState(false)

  const runPin = useCallback(async (): Promise<void> => {
    if (!menu) return
    await onPin(menu.tabId)
    onClose()
  }, [menu, onPin, onClose])

  const runUnpin = useCallback(async (): Promise<void> => {
    if (!menu) return
    await onUnpin(menu.tabId)
    onClose()
  }, [menu, onUnpin, onClose])

  const runMute = useCallback(async (): Promise<void> => {
    if (!menu) return
    await onSetMuted(menu.tabId, !menu.muted)
    onClose()
  }, [menu, onSetMuted, onClose])

  const runSplit = useCallback(async (): Promise<void> => {
    if (!menu) return
    await onSplitWithActive(menu.tabId)
    onClose()
  }, [menu, onSplitWithActive, onClose])

  const runExitSplit = useCallback(
    async (mode: 'both' | 'left' | 'right'): Promise<void> => {
      if (!menu) return
      await onExitSplit(menu.tabId, mode)
      onClose()
    },
    [menu, onExitSplit, onClose]
  )

  useLayoutEffect(() => {
    if (!menu) {
      setMenuReady(false)
      void window.velo.shellOverflowMenuSetReserve(0)
      return
    }
    let cancelled = false
    void window.velo.shellOverflowMenuSetReserve(OVERFLOW_MENU_SHELL_RESERVE).then(() => {
      if (cancelled) return
      void window.velo.shellEnsureChromeOnTop()
      requestAnimationFrame(() => {
        if (cancelled) return
        void window.velo.shellEnsureChromeOnTop()
        requestAnimationFrame(() => {
          if (!cancelled) setMenuReady(true)
        })
      })
    })
    return () => {
      cancelled = true
      setMenuReady(false)
      void window.velo.shellOverflowMenuSetReserve(0)
    }
  }, [menu])

  useEffect(() => {
    return () => {
      void window.velo.shellOverflowMenuSetReserve(0)
    }
  }, [])

  useLayoutEffect(() => {
    if (!menu || !menuReady || !panelRef.current) return
    const panel = panelRef.current
    const pad = 8
    const rect = panel.getBoundingClientRect()
    let left = menu.x
    let top = menu.y
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    panel.style.left = `${left}px`
    panel.style.top = `${top}px`
  }, [menu, menuReady])

  useEffect(() => {
    if (!menu || !menuReady) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onPointer = (e: MouseEvent): void => {
      const t = e.target as Node | null
      if (panelRef.current?.contains(t ?? null)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('contextmenu', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('contextmenu', onPointer)
    }
  }, [menu, menuReady, onClose])

  if (!menu || !menuReady) return null

  return createPortal(
    <div
      ref={panelRef}
      className="shell-overflow-panel tab-context-menu no-drag"
      role="menu"
      style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 2147482600 }}
    >
      {menu.canSplitWithActive ? (
        <>
          <button type="button" role="menuitem" className="shell-overflow-item" onClick={() => void runSplit()}>
            <span className="shell-overflow-label">Split with current tab</span>
          </button>
          <div className="shell-overflow-sep" role="separator" />
        </>
      ) : null}
      {menu.isSplit ? (
        <>
          <button
            type="button"
            role="menuitem"
            className="shell-overflow-item"
            onClick={() => void runExitSplit('both')}
          >
            <span className="shell-overflow-label">Exit Split View (keep both tabs)</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="shell-overflow-item"
            onClick={() => void runExitSplit('left')}
          >
            <span className="shell-overflow-label">Exit Split View (keep left tab)</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="shell-overflow-item"
            onClick={() => void runExitSplit('right')}
          >
            <span className="shell-overflow-label">Exit Split View (keep right tab)</span>
          </button>
          <div className="shell-overflow-sep" role="separator" />
        </>
      ) : null}
      {!menu.isSplit ? (
        menu.pinned ? (
          <button type="button" role="menuitem" className="shell-overflow-item" onClick={() => void runUnpin()}>
            <span className="shell-overflow-label">Unpin tab</span>
          </button>
        ) : (
          <button type="button" role="menuitem" className="shell-overflow-item" onClick={() => void runPin()}>
            <span className="shell-overflow-label">Pin tab</span>
          </button>
        )
      ) : null}
      {!menu.isSplit ? <div className="shell-overflow-sep" role="separator" /> : null}
      <button type="button" role="menuitem" className="shell-overflow-item" onClick={() => void runMute()}>
        <span className="shell-overflow-label">{menu.muted ? 'Unmute tab' : 'Mute tab'}</span>
      </button>
    </div>,
    document.body
  )
}
