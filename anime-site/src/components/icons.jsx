// Lightweight inline SVG icon set (no external deps)
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const SearchIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

export const PlayIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M8 5v14l11-7z" />
  </svg>
)

export const StarIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="m12 2 2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 6 20.4l1.4-6.8L2.3 9l6.9-.7z" />
  </svg>
)

export const FireIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 2c1 3-1 5-2 6-1-1-1-2-1-3-2 2-4 4-4 8a7 7 0 0 0 14 0c0-3-2-5-3-7-1 2-2 2-3 2 1-3 0-5-1-6z" />
  </svg>
)

export const MenuIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

export const HomeIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
)

export const CloseIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const CalendarIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)

export const GridIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

export const ArrowLeft = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
)

export const EyeIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const BookmarkIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
  </svg>
)

export const BookmarkFill = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
  </svg>
)

export const EditIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
)

export const TrashIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
)

export const LogoutIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
)

export const UserIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
)

export const ChevronDown = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const CheckIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const SunIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </svg>
)

export const MoonIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)

export const ImageIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-4.5-4.5L5 22" />
  </svg>
)

export const UsersIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 21c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M16 5.2A3.2 3.2 0 0 1 16 11.6M21 21c0-2.6-1.4-4.5-3.6-5.2" />
  </svg>
)

export const UserPlusIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M3 21c0-4 4-6 6-6s2.5.4 3.5 1" />
    <path d="M19 8v6M16 11h6" />
  </svg>
)

export const TrophyIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
  </svg>
)

export const ClockIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const BellIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
)

export const CameraIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

export const HeartIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
)

export const MessageIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

export const RoomIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
)

export const SettingsIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.7l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.7-.3 1.7 1.7 0 0 0-1 2.2v.1a2 2 0 0 1-4 .2 2 2 0 0 1 0-.2v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.7.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.8 15a1.7 1.7 0 0 0-2.2-1 2 2 0 0 1-.2-4 2 2 0 0 1 .2 0h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.7l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.8a1.7 1.7 0 0 0 1-2.2V2.4a2 2 0 0 1 4-.2 2 2 0 0 1 0 .2v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.7-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.2 9a1.7 1.7 0 0 0 2.2 1 2 2 0 0 1 .2 4 2 2 0 0 1-.2 0h-.1a1.7 1.7 0 0 0-1.7 1z" />
  </svg>
)
