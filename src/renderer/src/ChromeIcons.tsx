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
      <path d="m12 19-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconChevronDown({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function IconForward({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m12 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconReload({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconStarPlus({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path
        d="M11.013 18.582 6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16l2.309-4.679a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904L20 11.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 15v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconStarMinus({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path d="M15 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M17.688 14a2.1 2.1 0 0 1 .416-.568l3.736-3.638a.53.53 0 0 0-.294-.905l-5.166-.755a2.1 2.1 0 0 1-1.595-1.16l-2.31-4.68a.53.53 0 0 0-.95.001L9.216 6.974a2.1 2.1 0 0 1-1.597 1.16l-5.165.755a.53.53 0 0 0-.294.906l3.736 3.637a2.1 2.1 0 0 1 .611 1.879l-.88 5.139a.53.53 0 0 0 .769.56l4.617-2.428.027-.014"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
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
      <path d="M12 17V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m6 11 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 21H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      <rect
        width="18"
        height="11"
        x="3"
        y="11"
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
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

export function IconSplitSwap({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path d="M8 3 4 7l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m16 21 4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 17H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconTabClose({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} aria-hidden {...p}>
      <path d="M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m6 6 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
