/**
 * Abstract geometric SVG icons for source folders.
 * Each source gets a deterministic icon based on its ID hash.
 */

interface IconProps {
  className?: string
}

const icons: React.FC<IconProps>[] = [
  // 1 — concentric rings
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="12" stroke="#C8B8FF" strokeWidth="1.5" opacity="0.6" />
      <circle cx="16" cy="16" r="8" stroke="#C8B8FF" strokeWidth="1.5" opacity="0.4" />
      <circle cx="16" cy="16" r="4" fill="#C8B8FF" opacity="0.8" />
    </svg>
  ),
  // 2 — layered arcs
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M8 24C8 15.16 15.16 8 24 8" stroke="#D6E4FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <path d="M8 24C8 18.48 12.48 14 18 14" stroke="#D6E4FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M8 24C8 21.79 9.79 20 12 20" stroke="#D6E4FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <circle cx="8" cy="24" r="2" fill="#D6E4FF" opacity="0.8" />
    </svg>
  ),
  // 3 — stacked diamonds
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="16" y="4" width="12" height="12" rx="2" transform="rotate(45 16 4)" fill="#CDEFD8" opacity="0.3" />
      <rect x="16" y="8" width="9" height="9" rx="1.5" transform="rotate(45 16 8)" fill="#CDEFD8" opacity="0.5" />
      <rect x="16" y="12" width="6" height="6" rx="1" transform="rotate(45 16 12)" fill="#CDEFD8" opacity="0.8" />
    </svg>
  ),
  // 4 — soft grid
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="6" y="6" width="8" height="8" rx="3" fill="#FFD6A5" opacity="0.5" />
      <rect x="18" y="6" width="8" height="8" rx="3" fill="#FFD6A5" opacity="0.3" />
      <rect x="6" y="18" width="8" height="8" rx="3" fill="#FFD6A5" opacity="0.3" />
      <rect x="18" y="18" width="8" height="8" rx="3" fill="#FFD6A5" opacity="0.6" />
    </svg>
  ),
  // 5 — rising bars
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="5" y="18" width="4" height="8" rx="2" fill="#B8D4FF" opacity="0.4" />
      <rect x="11" y="14" width="4" height="12" rx="2" fill="#B8D4FF" opacity="0.55" />
      <rect x="17" y="10" width="4" height="16" rx="2" fill="#B8D4FF" opacity="0.7" />
      <rect x="23" y="6" width="4" height="20" rx="2" fill="#B8D4FF" opacity="0.85" />
    </svg>
  ),
  // 6 — orbital dots
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="10" stroke="#E8D5FF" strokeWidth="1" opacity="0.25" />
      <circle cx="16" cy="6" r="2.5" fill="#E8D5FF" opacity="0.7" />
      <circle cx="24.7" cy="21" r="2.5" fill="#E8D5FF" opacity="0.5" />
      <circle cx="7.3" cy="21" r="2.5" fill="#E8D5FF" opacity="0.6" />
    </svg>
  ),
  // 7 — wave lines
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M4 12C8 8 12 16 16 12C20 8 24 16 28 12" stroke="#FBBF96" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M4 17C8 13 12 21 16 17C20 13 24 21 28 17" stroke="#FBBF96" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M4 22C8 18 12 26 16 22C20 18 24 26 28 22" stroke="#FBBF96" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
    </svg>
  ),
  // 8 — nested squares
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="4" y="4" width="24" height="24" rx="4" stroke="#A5D8FF" strokeWidth="1.2" opacity="0.3" />
      <rect x="8" y="8" width="16" height="16" rx="3" stroke="#A5D8FF" strokeWidth="1.2" opacity="0.5" />
      <rect x="12" y="12" width="8" height="8" rx="2" fill="#A5D8FF" opacity="0.6" />
    </svg>
  ),
  // 9 — radial burst
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <line x1="16" y1="4" x2="16" y2="12" stroke="#FFB8C6" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="24.5" y1="7.5" x2="19.5" y2="12.5" stroke="#FFB8C6" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <line x1="28" y1="16" x2="20" y2="16" stroke="#FFB8C6" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="24.5" y1="24.5" x2="19.5" y2="19.5" stroke="#FFB8C6" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <circle cx="16" cy="16" r="3" fill="#FFB8C6" opacity="0.7" />
    </svg>
  ),
  // 10 — half moon
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M20 6A10 10 0 1020 26 8 8 0 0020 6z" fill="#CDEFD8" opacity="0.5" />
    </svg>
  ),
  // 11 — cross hatch
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <line x1="8" y1="8" x2="24" y2="24" stroke="#D6E4FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="24" y1="8" x2="8" y2="24" stroke="#D6E4FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="16" y1="4" x2="16" y2="28" stroke="#D6E4FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <line x1="4" y1="16" x2="28" y2="16" stroke="#D6E4FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <circle cx="16" cy="16" r="2" fill="#D6E4FF" opacity="0.7" />
    </svg>
  ),
  // 12 — stacked ovals
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <ellipse cx="16" cy="20" rx="10" ry="5" fill="#E8D5FF" opacity="0.25" />
      <ellipse cx="16" cy="16" rx="10" ry="5" fill="#E8D5FF" opacity="0.4" />
      <ellipse cx="16" cy="12" rx="10" ry="5" fill="#E8D5FF" opacity="0.6" />
    </svg>
  ),
  // 13 — flowing curves
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M6 26Q16 6 26 16" stroke="#FBBF96" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M6 26Q16 14 26 24" stroke="#FBBF96" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
    </svg>
  ),
  // 14 — hex cluster
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 6L21.2 9V15L16 18L10.8 15V9Z" fill="#A5D8FF" opacity="0.5" />
      <path d="M10.8 15L16 18V24L10.8 27L5.6 24V18Z" fill="#A5D8FF" opacity="0.35" />
      <path d="M21.2 15L26.4 18V24L21.2 27L16 24V18Z" fill="#A5D8FF" opacity="0.25" />
    </svg>
  ),
  // 15 — spiral dot
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="8" r="2" fill="#FFB8C6" opacity="0.7" />
      <circle cx="22" cy="12" r="2" fill="#FFB8C6" opacity="0.6" />
      <circle cx="24" cy="19" r="2" fill="#FFB8C6" opacity="0.5" />
      <circle cx="20" cy="24" r="2" fill="#FFB8C6" opacity="0.4" />
      <circle cx="13" cy="25" r="2" fill="#FFB8C6" opacity="0.3" />
      <circle cx="9" cy="20" r="2" fill="#FFB8C6" opacity="0.5" />
      <circle cx="10" cy="13" r="2" fill="#FFB8C6" opacity="0.6" />
    </svg>
  ),
  // 16 — overlapping circles
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="12" cy="14" r="7" fill="#C8B8FF" opacity="0.35" />
      <circle cx="20" cy="14" r="7" fill="#C8B8FF" opacity="0.35" />
      <circle cx="16" cy="20" r="7" fill="#C8B8FF" opacity="0.35" />
    </svg>
  ),
  // 17 — ascending steps
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="4" y="22" width="6" height="4" rx="1.5" fill="#CDEFD8" opacity="0.45" />
      <rect x="13" y="16" width="6" height="10" rx="1.5" fill="#CDEFD8" opacity="0.6" />
      <rect x="22" y="10" width="6" height="16" rx="1.5" fill="#CDEFD8" opacity="0.75" />
    </svg>
  ),
  // 18 — atom
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <ellipse cx="16" cy="16" rx="12" ry="5" stroke="#FFD6A5" strokeWidth="1" opacity="0.4" transform="rotate(0 16 16)" />
      <ellipse cx="16" cy="16" rx="12" ry="5" stroke="#FFD6A5" strokeWidth="1" opacity="0.4" transform="rotate(60 16 16)" />
      <ellipse cx="16" cy="16" rx="12" ry="5" stroke="#FFD6A5" strokeWidth="1" opacity="0.4" transform="rotate(120 16 16)" />
      <circle cx="16" cy="16" r="2.5" fill="#FFD6A5" opacity="0.7" />
    </svg>
  ),
  // 19 — mountain silhouette
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M4 24L12 10L18 18L22 12L28 24Z" fill="#B8D4FF" opacity="0.45" />
      <path d="M4 24L10 16L14 20L20 12L28 24Z" fill="#B8D4FF" opacity="0.25" />
    </svg>
  ),
  // 20 — leaf
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4C16 4 6 12 6 20C6 25.5 10.5 28 16 28C21.5 28 26 25.5 26 20C26 12 16 4 16 4Z" fill="#CDEFD8" opacity="0.4" />
      <path d="M16 10V24" stroke="#CDEFD8" strokeWidth="1" opacity="0.6" />
      <path d="M16 16C12 14 10 18 10 18" stroke="#CDEFD8" strokeWidth="1" strokeLinecap="round" opacity="0.45" />
      <path d="M16 20C20 18 22 22 22 22" stroke="#CDEFD8" strokeWidth="1" strokeLinecap="round" opacity="0.45" />
    </svg>
  ),
  // 21 — prism
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4L28 26H4Z" fill="#E8D5FF" opacity="0.3" />
      <path d="M16 10L24 26H8Z" fill="#E8D5FF" opacity="0.5" />
    </svg>
  ),
  // 22 — dna helix
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M10 4C10 4 22 10 22 16C22 22 10 28 10 28" stroke="#A5D8FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M22 4C22 4 10 10 10 16C10 22 22 28 22 28" stroke="#A5D8FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="11" y1="10" x2="21" y2="10" stroke="#A5D8FF" strokeWidth="1" opacity="0.3" />
      <line x1="10" y1="16" x2="22" y2="16" stroke="#A5D8FF" strokeWidth="1" opacity="0.3" />
      <line x1="11" y1="22" x2="21" y2="22" stroke="#A5D8FF" strokeWidth="1" opacity="0.3" />
    </svg>
  ),
  // 23 — zen stones
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <ellipse cx="16" cy="24" rx="10" ry="3" fill="#FFD6A5" opacity="0.3" />
      <ellipse cx="16" cy="19" rx="7" ry="3" fill="#FFD6A5" opacity="0.45" />
      <ellipse cx="16" cy="14" rx="5" ry="3" fill="#FFD6A5" opacity="0.6" />
      <ellipse cx="16" cy="10" rx="3" ry="2" fill="#FFD6A5" opacity="0.75" />
    </svg>
  ),
  // 24 — aurora
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M4 28Q8 8 16 16Q24 24 28 4" stroke="#CDEFD8" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M6 28Q10 12 16 18Q22 24 26 8" stroke="#B8D4FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
    </svg>
  ),
  // 25 — scatter
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="8" cy="10" r="3" fill="#FFB8C6" opacity="0.5" />
      <circle cx="20" cy="7" r="2" fill="#FFB8C6" opacity="0.4" />
      <circle cx="14" cy="18" r="3.5" fill="#FFB8C6" opacity="0.6" />
      <circle cx="24" cy="16" r="2.5" fill="#FFB8C6" opacity="0.35" />
      <circle cx="10" cy="25" r="2" fill="#FFB8C6" opacity="0.45" />
      <circle cx="22" cy="24" r="3" fill="#FFB8C6" opacity="0.5" />
    </svg>
  ),
  // 26 — ribbon
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M6 8C10 8 14 16 16 16C18 16 22 8 26 8" stroke="#C8B8FF" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M6 24C10 24 14 16 16 16C18 16 22 24 26 24" stroke="#C8B8FF" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </svg>
  ),
  // 27 — pixel cluster
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="12" y="8" width="4" height="4" rx="1" fill="#D6E4FF" opacity="0.5" />
      <rect x="16" y="8" width="4" height="4" rx="1" fill="#D6E4FF" opacity="0.35" />
      <rect x="8" y="12" width="4" height="4" rx="1" fill="#D6E4FF" opacity="0.35" />
      <rect x="12" y="12" width="4" height="4" rx="1" fill="#D6E4FF" opacity="0.7" />
      <rect x="16" y="12" width="4" height="4" rx="1" fill="#D6E4FF" opacity="0.55" />
      <rect x="20" y="12" width="4" height="4" rx="1" fill="#D6E4FF" opacity="0.3" />
      <rect x="12" y="16" width="4" height="4" rx="1" fill="#D6E4FF" opacity="0.55" />
      <rect x="16" y="16" width="4" height="4" rx="1" fill="#D6E4FF" opacity="0.45" />
      <rect x="12" y="20" width="4" height="4" rx="1" fill="#D6E4FF" opacity="0.3" />
    </svg>
  ),
  // 28 — topography
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M4 20Q10 14 16 18Q22 22 28 16" stroke="#FBBF96" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <path d="M4 16Q10 10 16 14Q22 18 28 12" stroke="#FBBF96" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <path d="M4 12Q10 6 16 10Q22 14 28 8" stroke="#FBBF96" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
    </svg>
  ),
  // 29 — target
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="12" stroke="#A5D8FF" strokeWidth="1" opacity="0.25" />
      <circle cx="16" cy="16" r="8" stroke="#A5D8FF" strokeWidth="1" opacity="0.4" />
      <circle cx="16" cy="16" r="4" stroke="#A5D8FF" strokeWidth="1" opacity="0.55" />
      <circle cx="16" cy="16" r="1.5" fill="#A5D8FF" opacity="0.75" />
    </svg>
  ),
  // 30 — paper fold
  ({ className }) => (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M6 6H26L20 16L26 26H6L12 16Z" fill="#E8D5FF" opacity="0.35" />
      <path d="M12 16L6 6V26Z" fill="#E8D5FF" opacity="0.2" />
    </svg>
  ),
]

// Manual source gets a special link icon
const manualIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <path d="M13 19L19 13" stroke="#D4D4D8" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <path d="M11 17L9.5 18.5C7.5 20.5 7.5 23.8 9.5 25.8C11.5 27.8 14.8 27.8 16.8 25.8L18.5 24" stroke="#D4D4D8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    <path d="M21 15L22.5 13.5C24.5 11.5 24.5 8.2 22.5 6.2C20.5 4.2 17.2 4.2 15.2 6.2L13.5 8" stroke="#D4D4D8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
)

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function SourceFolderIcon({
  sourceId,
  className
}: {
  sourceId: string
  className?: string
}) {
  if (sourceId === "manual") {
    const Icon = manualIcon
    return <Icon className={className} />
  }
  const index = hashCode(sourceId) % icons.length
  const Icon = icons[index]
  return <Icon className={className} />
}
