import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown, Users } from 'lucide-react'
import { PRESETS, presetRange, type PresetKey } from '@shared/domain/dates.ts'
import type { DateRange, Employee } from '@shared/domain/types.ts'
import { rangeLabel } from '../../lib/format'

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close()
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, close])
  return ref
}

/** Preset buttons (Today … Last month) plus a custom from/to picker. */
export function DateRangeFilter({
  range, preset, onChange,
}: { range: DateRange; preset: PresetKey | 'custom'; onChange: (r: DateRange, p: PresetKey | 'custom') => void }) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, () => setOpen(false))
  const label = preset === 'custom' ? 'Custom' : PRESETS.find((p) => p.key === preset)?.label
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium"
      >
        <Calendar size={16} className="text-muted" />
        <span>{label}</span>
        <span className="hidden text-muted sm:inline">· {rangeLabel(range.from, range.to)}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1 w-72 rounded-xl border border-line bg-surface p-2 shadow-lg sm:left-auto sm:right-0">
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  onChange(presetRange(p.key), p.key)
                  setOpen(false)
                }}
                className={`rounded-md px-2 py-1.5 text-left text-sm ${preset === p.key ? 'bg-brand text-on-primary' : 'hover:bg-subtle'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-line pt-2 text-xs font-semibold text-muted">Custom range</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="date" value={range.from} max={range.to} aria-label="From"
              onChange={(e) => e.target.value && onChange({ ...range, from: e.target.value }, 'custom')}
              className="h-8 flex-1 rounded-md border border-line px-2 text-sm"
            />
            <span className="text-muted">–</span>
            <input
              type="date" value={range.to} min={range.from} aria-label="To"
              onChange={(e) => e.target.value && onChange({ ...range, to: e.target.value }, 'custom')}
              className="h-8 flex-1 rounded-md border border-line px-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** Ads manager multi-select ("Adam Schmidt ×" in Retool). Empty = everyone. */
export function ManagerFilter({
  managers, selected, onChange,
}: { managers: Employee[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, () => setOpen(false))
  const names = managers.filter((m) => selected.includes(m.id)).map((m) => m.firstName + ' ' + m.lastName)
  const label = names.length === 0 ? 'All ads managers' : names.length === 1 ? names[0] : `${names.length} managers`
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium"
      >
        <Users size={16} className="text-muted" />
        {label}
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1 w-60 rounded-xl border border-line bg-surface p-1 shadow-lg">
          <button onClick={() => onChange([])} className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-subtle">
            All ads managers
          </button>
          {managers.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-subtle">
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
              {m.firstName} {m.lastName}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
