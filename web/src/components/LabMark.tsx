/**
 * The Lab logo (option B, chosen 11 Nov 2026; docs/design-options.md#logo).
 * Teal atom on a navy tile with one white electron. The tile is slightly
 * lighter in dark mode (--logo-tile in index.css) so it doesn't vanish.
 * Static copies for the browser tab and home screen: web/public/brand/.
 */
export function LabMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="The Lab">
      <rect width="64" height="64" rx="16" style={{ fill: 'var(--logo-tile)' }} />
      <g fill="none" stroke="#14b8a6" strokeWidth="3">
        <ellipse cx="32" cy="32" rx="23" ry="8.5" />
        <ellipse cx="32" cy="32" rx="23" ry="8.5" transform="rotate(60 32 32)" />
        <ellipse cx="32" cy="32" rx="23" ry="8.5" transform="rotate(120 32 32)" />
      </g>
      <circle cx="32" cy="32" r="5" fill="#fff" />
      <circle cx="55" cy="32" r="3.6" fill="#fff" />
    </svg>
  )
}

/** Logo plus "The Lab" with a smaller "by MRKD" underneath. */
export function LabLockup({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LabMark size={size} />
      <span className="leading-none">
        <span className="block text-lg font-extrabold tracking-tight">The Lab</span>
        <span className="mt-1 block text-[11px] font-semibold text-muted">by MRKD</span>
      </span>
    </span>
  )
}
