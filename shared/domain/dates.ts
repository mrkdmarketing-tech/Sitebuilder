/**
 * Date-range presets for reporting. All dates are calendar days in the
 * reporting time zone (America/Toronto), as YYYY-MM-DD strings, inclusive.
 *
 * Retool approximated Toronto time with a fixed "UTC − 4 hours", which is
 * wrong for half the year (daylight saving). We use the real time zone.
 */
import type { DateRange } from './types.ts'

export const REPORTING_TIME_ZONE = 'America/Toronto'

export type PresetKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'last_7_days', label: 'Last 7 days' },
  { key: 'last_14_days', label: 'Last 14 days' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
]

/** Today's date in the reporting time zone, as YYYY-MM-DD. */
export function todayInZone(now: Date = new Date(), timeZone = REPORTING_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: string, n: number): string {
  const date = parse(d)
  date.setUTCDate(date.getUTCDate() + n)
  return fmt(date)
}

/** Number of days in an inclusive range. */
export function rangeLength(r: DateRange): number {
  return Math.round((parse(r.to).getTime() - parse(r.from).getTime()) / 86_400_000) + 1
}

/** Every date in an inclusive range. */
export function eachDay(r: DateRange): string[] {
  const out: string[] = []
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) out.push(d)
  return out
}

/** Monday-based week start, matching Retool's "this week". */
function startOfWeek(d: string): string {
  const dow = parse(d).getUTCDay() // 0 = Sunday
  return addDays(d, dow === 0 ? -6 : 1 - dow)
}

export function presetRange(key: PresetKey, today: string = todayInZone()): DateRange {
  switch (key) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { from: y, to: y }
    }
    case 'this_week':
      return { from: startOfWeek(today), to: today }
    case 'last_week': {
      const start = addDays(startOfWeek(today), -7)
      return { from: start, to: addDays(start, 6) }
    }
    // "Last N days" excludes today, matching Retool and Meta Ads Manager.
    case 'last_7_days':
      return { from: addDays(today, -7), to: addDays(today, -1) }
    case 'last_14_days':
      return { from: addDays(today, -14), to: addDays(today, -1) }
    case 'last_30_days':
      return { from: addDays(today, -30), to: addDays(today, -1) }
    case 'this_month':
      return { from: today.slice(0, 8) + '01', to: today }
    case 'last_month': {
      const firstThis = today.slice(0, 8) + '01'
      const lastPrev = addDays(firstThis, -1)
      return { from: lastPrev.slice(0, 8) + '01', to: lastPrev }
    }
  }
}

/**
 * The comparison window: same number of days, ending the day before the
 * current range starts. Matches Retool's "previous period".
 */
export function previousRange(r: DateRange): DateRange {
  const len = rangeLength(r)
  const to = addDays(r.from, -1)
  return { from: addDays(to, -(len - 1)), to }
}
