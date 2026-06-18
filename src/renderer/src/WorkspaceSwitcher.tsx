import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { OVERFLOW_MENU_SHELL_RESERVE } from '@shared/constants'
import type { WorkspaceSnapshot, WorkspacesStatePayload } from '@shared/ipc'
import { IconChevronDown, IconPlus } from './ChromeIcons'

const ICON_PRESETS = ['💻', '🎮', '📚', '🏠', '⭐'] as const

/** Any positive value → main process expands chrome overlay to full window height. */
const WORKSPACE_MODAL_SHELL_RESERVE = 1

type CreateModalProps = {
  onClose: () => void
  onCreate: (name: string, icon: string | null) => void
}

function CreateWorkspaceModal({ onClose, onCreate }: CreateModalProps): JSX.Element {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string | null>('💻')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="ws-modal-backdrop no-drag" role="presentation" onClick={onClose}>
      <div
        className="ws-modal no-drag"
        role="dialog"
        aria-labelledby="ws-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ws-modal-title" className="ws-modal-title">
          New workspace
        </h2>
        <label className="ws-modal-label">
          Workspace name
          <input
            ref={inputRef}
            className="ws-modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Development"
            maxLength={64}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) onCreate(name.trim(), icon)
              if (e.key === 'Escape') onClose()
            }}
          />
        </label>
        <div className="ws-modal-icons" role="group" aria-label="Workspace icon">
          {ICON_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`ws-icon-pick${icon === preset ? ' picked' : ''}`}
              aria-pressed={icon === preset}
              onClick={() => setIcon(preset)}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            className={`ws-icon-pick ws-icon-pick--text${icon === null ? ' picked' : ''}`}
            aria-pressed={icon === null}
            onClick={() => setIcon(null)}
          >
            Custom
          </button>
        </div>
        <div className="ws-modal-actions">
          <button type="button" className="ws-modal-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ws-modal-btn primary"
            disabled={!name.trim()}
            onClick={() => onCreate(name.trim(), icon)}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

type Anchor = { left: number; bottom: number }

type Props = {
  state: WorkspacesStatePayload
  onSwitch: (workspaceId: string) => void
  onCreate: (name: string, icon: string | null) => void
  onRename: (workspaceId: string, name: string) => void
  onDelete: (workspaceId: string) => void
}

export function WorkspaceSwitcher({
  state,
  onSwitch,
  onCreate,
  onRename,
  onDelete
}: Props): JSX.Element {
  const [createOpen, setCreateOpen] = useState(false)
  const [modalReady, setModalReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuReady, setMenuReady] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [contextWs, setContextWs] = useState<WorkspaceSnapshot | null>(null)
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const active = state.workspaces.find((ws) => ws.active) ?? state.workspaces[0]

  const closeMenu = useCallback((): void => {
    setMenuOpen(false)
    setMenuReady(false)
    setAnchor(null)
  }, [])

  const closeContext = useCallback((): void => setContextWs(null), [])

  const measureAnchor = useCallback((): void => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setAnchor({ left: r.left, bottom: r.bottom })
  }, [])

  const toggleMenu = useCallback((): void => {
    if (menuOpen) {
      closeMenu()
      return
    }
    measureAnchor()
    setMenuOpen(true)
  }, [menuOpen, closeMenu, measureAnchor])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen, closeMenu])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent): void => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (btnRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      closeMenu()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen, closeMenu])

  useEffect(() => {
    if (!contextWs) return
    const onDoc = (e: MouseEvent): void => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (panelRef.current?.contains(t)) return
      closeContext()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [contextWs, closeContext])

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuReady(false)
      void window.velo.shellOverflowMenuSetReserve(0)
      return
    }
    let cancelled = false
    const apply = (): void => {
      if (cancelled) return
      void window.velo.shellOverflowMenuSetReserve(OVERFLOW_MENU_SHELL_RESERVE).then(() => {
        if (cancelled) return
        void window.velo.shellEnsureChromeOnTop()
        measureAnchor()
        requestAnimationFrame(() => {
          if (cancelled) return
          void window.velo.shellEnsureChromeOnTop()
          measureAnchor()
          requestAnimationFrame(() => {
            if (!cancelled) setMenuReady(true)
          })
        })
      })
    }
    apply()
    const onResize = (): void => {
      measureAnchor()
      apply()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      setMenuReady(false)
      window.removeEventListener('resize', onResize)
      void window.velo.shellOverflowMenuSetReserve(0)
    }
  }, [menuOpen, measureAnchor])

  useEffect(() => {
    return () => {
      void window.velo.shellOverflowMenuSetReserve(0)
    }
  }, [])

  useLayoutEffect(() => {
    if (!createOpen) {
      setModalReady(false)
      void window.velo.shellBookmarkModalSetReserve(0)
      return
    }
    let cancelled = false
    const apply = (): void => {
      if (cancelled) return
      void window.velo.shellBookmarkModalSetReserve(WORKSPACE_MODAL_SHELL_RESERVE).then(() => {
        if (cancelled) return
        void window.velo.shellEnsureChromeOnTop()
        requestAnimationFrame(() => {
          if (cancelled) return
          void window.velo.shellEnsureChromeOnTop()
          requestAnimationFrame(() => {
            if (!cancelled) setModalReady(true)
          })
        })
      })
    }
    apply()
    window.addEventListener('resize', apply)
    return () => {
      cancelled = true
      setModalReady(false)
      window.removeEventListener('resize', apply)
      void window.velo.shellBookmarkModalSetReserve(0)
    }
  }, [createOpen])

  const panelStyle: CSSProperties | undefined = anchor
    ? { left: anchor.left, top: anchor.bottom + 4 }
    : undefined

  const menuPanel =
    menuOpen && menuReady && anchor ? (
      <div
        ref={panelRef}
        className="shell-overflow-panel ws-picker-menu no-drag"
        style={panelStyle}
        role="menu"
        aria-label="Workspaces"
      >
        {state.workspaces.map((ws) => (
          <button
            key={ws.id}
            type="button"
            role="menuitemradio"
            aria-checked={ws.active}
            className={`shell-overflow-item ws-picker-item${ws.active ? ' ws-picker-item--active' : ''}`}
            onClick={() => {
              if (!ws.active) onSwitch(ws.id)
              closeMenu()
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setContextWs(ws)
              setContextPos({ x: e.clientX, y: e.clientY })
            }}
          >
            <span className="shell-overflow-ic ws-picker-item-icon" aria-hidden="true">
              {ws.icon ?? ws.name.charAt(0).toUpperCase()}
            </span>
            <span className="shell-overflow-label">{ws.name}</span>
            {ws.tabCount > 0 ? <span className="ws-picker-count">{ws.tabCount}</span> : null}
            {ws.active ? (
              <span className="ws-picker-check" aria-hidden="true">
                ✓
              </span>
            ) : null}
          </button>
        ))}
        <div className="shell-overflow-sep" role="separator" />
        <button
          type="button"
          role="menuitem"
          className="shell-overflow-item"
          onClick={() => {
            closeMenu()
            setCreateOpen(true)
          }}
        >
          <span className="shell-overflow-ic" aria-hidden="true">
            <IconPlus size={18} />
          </span>
          <span className="shell-overflow-label">New workspace</span>
        </button>
      </div>
    ) : null

  return (
    <>
      <div className="ws-picker">
        <button
          ref={btnRef}
          type="button"
          className={`ws-picker-btn${menuOpen ? ' open' : ''}`}
          aria-label={`Workspace: ${active?.name ?? 'Workspaces'}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={active?.name ?? 'Workspaces'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleMenu}
        >
          <IconChevronDown size={18} />
        </button>
      </div>

      {menuPanel ? createPortal(menuPanel, document.body) : null}

      {contextWs ? (
        <div
          className="ws-context-menu no-drag"
          style={{ left: contextPos.x, top: contextPos.y }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const next = window.prompt('Rename workspace', contextWs.name)
              if (next?.trim()) onRename(contextWs.id, next.trim())
              closeContext()
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            disabled={state.workspaces.length <= 1}
            onClick={() => {
              if (
                state.workspaces.length <= 1 ||
                !window.confirm(`Delete workspace "${contextWs.name}"? This cannot be undone.`)
              ) {
                closeContext()
                return
              }
              onDelete(contextWs.id)
              closeContext()
            }}
          >
            Delete
          </button>
        </div>
      ) : null}

      {createOpen && modalReady
        ? createPortal(
            <CreateWorkspaceModal
              onClose={() => setCreateOpen(false)}
              onCreate={(name, icon) => {
                onCreate(name, icon)
                setCreateOpen(false)
              }}
            />,
            document.body
          )
        : null}
    </>
  )
}
