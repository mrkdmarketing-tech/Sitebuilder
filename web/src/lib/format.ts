/** Display formatting. Keep all number formatting here so screens stay consistent. */

const money0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const money2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const DASH = '—'

/** $1,234 for large values, $12.34 for small ones. */
export function money(v: number | null | undefined, opts: { cents?: boolean } = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH
  return opts.cents || Math.abs(v) < 1000 ? money2.format(v) : money0.format(v)
}

export function count(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH
  return int.format(v)
}

export function percent(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH
  return `${v.toFixed(digits)}%`
}

export function signedPercent(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return ''
  const r = Math.round(v)
  return `${r > 0 ? '+' : ''}${r}%`
}

/** "Nov 1 – Nov 7, 2026" */
export function rangeLabel(from: string, to: string): string {
  const f = new Date(from + 'T12:00:00Z')
  const t = new Date(to + 'T12:00:00Z')
  const md = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  if (from === to) return `${md(f)}, ${f.getUTCFullYear()}`
  return `${md(f)} – ${md(t)}, ${t.getUTCFullYear()}`
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto',
  })
}
