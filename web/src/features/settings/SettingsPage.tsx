/**
 * Settings (docs/sop/changing-thresholds.md).
 *  - Suggestion thresholds: owners/admins edit, everyone else sees them read-only.
 *    Saved through save_rule_settings (migration 2000), which checks the values
 *    and logs the change.
 *  - Staff: everyone listed; owners/admins change roles (StaffSection.tsx).
 *  - Light or dark mode for this browser.
 *  - Links to Sync status and the SOPs.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_RULE_SETTINGS, type RuleSettings } from '@shared/domain/rules.ts'
import { Card, PageTitle } from '../../components/ui'
import { useData } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { useSession, type Mode } from '../../app/session'
import { StaffSection } from './StaffSection'

type Key = keyof RuleSettings

/** How each threshold is shown. `scale` converts stored → shown (0.6 → 60 %). */
const FIELDS: { key: Key; label: string; help: string; unit: '$' | '%' | 'days' | ''; scale?: number; step: number }[] = [
  { key: 'expensiveCpl', label: 'Expensive leads: cost per lead above', help: 'Ad with at least 1 lead costing more than this.', unit: '$', step: 1 },
  { key: 'noLeadSpend', label: 'Spending with no leads: spend above', help: 'Ad spent more than this with 0 leads.', unit: '$', step: 1 },
  { key: 'budgetHogShare', label: 'Budget hog: share of its ad set\'s spend', help: 'One ad takes at least this much of its ad set\'s spend...', unit: '%', scale: 100, step: 1 },
  { key: 'budgetHogCpl', label: 'Budget hog: cost per lead above', help: '...and has no leads or a cost per lead above this.', unit: '$', step: 1 },
  { key: 'lowCtr', label: 'Low CTR: below', help: 'After the minimum impressions below.', unit: '%', step: 0.05 },
  { key: 'lowLinkCtr', label: 'Low link CTR: below', help: 'After the minimum impressions below.', unit: '%', step: 0.05 },
  { key: 'minImpressions', label: 'Minimum impressions for CTR rules', help: 'CTR rules ignore ads with fewer impressions.', unit: '', step: 100 },
  { key: 'noRecentLeadsDays', label: 'No recent leads: days', help: 'Active account with 0 leads for this many days.', unit: 'days', step: 1 },
]

const show = (f: (typeof FIELDS)[number], v: number) => String(Math.round(v * (f.scale ?? 1) * 1000) / 1000)

export function SettingsPage() {
  const ds = useData()
  const { isAdmin, mode, setMode } = useSession()
  const [version, setVersion] = useState(0)
  const info = useAsync(() => ds.ruleSettingsInfo(), [ds, version])
  const current = useMemo(() => ({ ...DEFAULT_RULE_SETTINGS, ...(info.data?.params ?? {}) }), [info.data])

  const [draft, setDraft] = useState<Record<string, string>>({})
  useEffect(() => {
    setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, show(f, current[f.key])])))
  }, [current])

  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const changed = FIELDS.filter((f) => draft[f.key] !== undefined && draft[f.key] !== show(f, current[f.key]))
  const invalid = FIELDS.filter((f) => draft[f.key] === '' || !Number.isFinite(Number(draft[f.key])) || Number(draft[f.key]) < 0)

  const save = async () => {
    setSaving(true)
    setNotice(null)
    try {
      const params = Object.fromEntries(changed.map((f) => [f.key, Number(draft[f.key]) / (f.scale ?? 1)])) as Partial<RuleSettings>
      await ds.saveRuleSettings(params)
      setNotice({ ok: true, text: `Saved ${changed.length} change${changed.length === 1 ? '' : 's'}. Suggestions use the new values from the next run (within 30 minutes).` })
      setVersion((v) => v + 1)
    } catch (e) {
      setNotice({ ok: false, text: `Not saved: ${(e as Error).message}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <PageTitle title="Settings" />

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Suggestion thresholds</h2>
          <span className="text-xs text-muted">
            {info.data?.updatedBy
              ? `Last changed by ${info.data.updatedBy}, ${new Date(info.data.updatedAt!).toLocaleString()}`
              : 'Agreed starting values'}
          </span>
        </div>
        {!isAdmin && <p className="mb-3 rounded-lg bg-subtle px-3 py-2 text-sm text-soft">Only owners and admins can change these. Ask Jordan if one looks wrong.</p>}
        {info.error && <p className="text-sm text-bad">Couldn't load settings: {info.error.message}</p>}

        <div className="divide-y divide-line">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{f.label}</span>
                <span className="block text-xs text-muted">{f.help}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                {f.unit === '$' && <span className="text-muted">$</span>}
                <input
                  type="number" inputMode="decimal" step={f.step} min={0}
                  disabled={!isAdmin || saving}
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="tabular h-9 w-28 rounded-lg border border-line bg-surface px-2 text-right disabled:bg-subtle disabled:text-soft"
                />
                <span className="w-8 text-muted">{f.unit === '$' ? '' : f.unit}</span>
              </span>
            </label>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted">All rules look at the last 7 days. Rule details: docs/suggestions.md. How to decide: docs/sop/changing-thresholds.md.</p>

        {isAdmin && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={saving || changed.length === 0 || invalid.length > 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-40"
            >
              {saving ? 'Saving...' : changed.length ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}` : 'No changes'}
            </button>
            {changed.length > 0 && !saving && (
              <button onClick={() => setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, show(f, current[f.key])])))} className="text-sm font-medium text-muted">
                Undo changes
              </button>
            )}
            {invalid.length > 0 && <span className="text-sm text-bad">Every value must be a number of 0 or more.</span>}
          </div>
        )}
        {notice && <p className={`mt-3 text-sm ${notice.ok ? 'text-good' : 'text-bad'}`}>{notice.text}</p>}
      </Card>

      <StaffSection />

      <Card className="mt-4 p-4">
        <h2 className="mb-1 text-base font-semibold">Light or dark</h2>
        <p className="mb-3 text-sm text-muted">Only changes this browser. Also the sun / moon button next to your name. "Match device" follows your phone or computer's setting.</p>
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {([['light', 'Light'], ['dark', 'Dark'], ['system', 'Match device']] as [Mode, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setMode(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === k ? 'bg-primary text-on-primary' : 'text-muted hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-4 p-4 text-sm">
        <h2 className="mb-2 text-base font-semibold">More</h2>
        <ul className="space-y-1.5">
          <li><Link to="/clients" className="font-medium text-brand">Clients</Link> <span className="text-muted">: status, ads manager and ad accounts for every client</span></li>
          <li><Link to="/status" className="font-medium text-brand">Sync status</Link> <span className="text-muted">: when data was last copied from Meta and Retool</span></li>
          <li><span className="font-medium">How-to guides (SOPs)</span> <span className="text-muted">: docs/sop in the GitHub repository</span></li>
        </ul>
      </Card>
    </div>
  )
}
