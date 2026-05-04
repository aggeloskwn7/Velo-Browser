import type { SVGProps, JSX } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const base = (size: number): Pick<SVGProps<SVGSVGElement>, 'width' | 'height' | 'viewBox' | 'fill'> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none'
})

export function IconBack({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconForward({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconReload({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M23 4v6h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconStop({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" />
    </svg>
  )
}

export function IconPlus({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M12 6v12M6 12h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconStarOutline({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M12 4l2.35 4.76 5.26.77-3.8 3.7.9 5.24L12 15.9 7.29 18.47l.9-5.24-3.8-3.7 5.26-.77L12 4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconStarFilled({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M12 4l2.35 4.76 5.26.77-3.8 3.7.9 5.24L12 15.9 7.29 18.47l.9-5.24-3.8-3.7 5.26-.77L12 4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconDownload({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M12 4v11.5M8 11.5l4 4 4-4M4 19.5h16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}


export function IconShortcuts({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function IconSearch({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconGlobe({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3 12h18M12 3a16 16 0 0 0 5 9 16 16 0 0 0-5 9 16 16 0 0 0-5-9 16 16 0 0 0 5-9z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}


export function IconShieldPrivacy({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M12 2.5L4.5 5.4v5.35c0 4.35 2.85 8.38 7.5 9.35 4.65-.97 7.5-5 7.5-9.35V5.4L12 2.5z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M9 11.8l2.2 2.2L15.2 9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconLock({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconInfo({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 10v6M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconMore({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <circle cx="12" cy="5" r="1.75" fill="currentColor" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <circle cx="12" cy="19" r="1.75" fill="currentColor" />
    </svg>
  )
}

export function IconGear({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconWrench({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2 2 0 0 1-2.83-2.83l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76a1 1 0 0 1-.14.09Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconHistory({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M12 8v4l3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M3.6 5.5v3.5H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconListMenu({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path d="M8 7h11M8 12h11M8 17h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}


export function IconAppWindow({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 9h10M8 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconTabClose({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden {...p}>
      <path
        d="M3 3l6 6M9 3l-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconWinMinimize({ size = 10, ...p }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden {...p}>
      <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconWinMaximize({ size = 10, ...p }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden {...p}>
      <rect x="2" y="2.5" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function IconWinClose({ size = 10, ...p }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden {...p}>
      <path
        d="M2.5 2.5l7 7M9.5 2.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
