/**
 * Jev tags on Insights (docs/creative-tags.md): labels on each ad, a one-line
 * summary on campaigns and ad sets, and filters by offer, audience, hook and
 * yes/no tags.
 */
import { FLAG_QUESTIONS, TAG_QUESTIONS, filterIsEmpty, shortTag, tagChips, type AdTags, type TagFilter } from '@shared/domain/creativeTags.ts'

export function TagChips({ tags }: { tags: AdTags | null | undefined }) {
  const chips = tagChips(tags)
  if (!chips.length) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {chips.map((c) => <span key={c} className="whitespace-nowrap rounded bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-soft">{c}</span>)}
    </div>
  )
}

export function TagSummary({ text }: { text: string | null }) {
  return text ? <div className="mt-0.5 truncate text-[11px] text-soft" title={text}>{text}</div> : null
}

const selectClass = 'h-8 rounded-lg border border-line bg-surface px-2 text-sm'

export function TagFilters({ value, onChange }: { value: TagFilter; onChange: (f: TagFilter) => void }) {
  const flags = value.flags ?? []
  const toggle = (k: (typeof FLAG_QUESTIONS)[number]['key']) =>
    onChange({ ...value, flags: flags.includes(k) ? flags.filter((x) => x !== k) : [...flags, k] })
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-2 py-2 text-sm">
      <span className="text-xs font-semibold text-muted">What the ad says</span>
      {TAG_QUESTIONS.map((q) => (
        <select key={q.key} aria-label={q.label} value={value[q.key] ?? ''} className={selectClass}
          onChange={(e) => onChange({ ...value, [q.key]: e.target.value || undefined })}>
          <option value="">{q.label}: any</option>
          {q.options.map((o) => <option key={o.key} value={o.key}>{shortTag(o.key)}</option>)}
        </select>
      ))}
      {FLAG_QUESTIONS.map((q) => (
        <label key={q.key} className="flex items-center gap-1 whitespace-nowrap text-xs" title={q.label}>
          <input type="checkbox" checked={flags.includes(q.key)} onChange={() => toggle(q.key)} />
          {{ price: 'Price', deadline: 'Deadline', place: 'City', uniform: 'Uniform' }[q.key]}
        </label>
      ))}
      {!filterIsEmpty(value) && <button onClick={() => onChange({})} className="text-xs font-semibold text-brand">Clear</button>}
    </div>
  )
}
