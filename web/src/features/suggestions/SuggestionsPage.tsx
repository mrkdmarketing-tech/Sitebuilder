/**
 * Suggestions (Phase 1b preview). One overview card per ad account, in the app
 * only (no Slack), e.g. "Renzo Gracie Boca: an ad has 1 lead at $120. Turn it off?"
 * Rules: shared/domain/rules.ts · docs/suggestions.md.
 *
 * In this preview the rules run in the browser on the last 7 days. Once live,
 * the run-rules job stores them and "Turn off" calls the meta-action function.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { DEFAULT_RULE_SETTINGS, evaluateRules, groupByAccount, type RuleSettings, type Suggestion } from '@shared/domain/rules.ts'
import { presetRange } from '@shared/domain/dates.ts'
import { useData } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { Card, Empty, ManagerChip, Modal, PageTitle } from '../../components/ui'
import { ManagerFilter } from '../insights/Filters'
import { count, money } from '../../lib/format'
import { SAMPLE_MODE } from '../../lib/config'

type LocalState = 'done' | 'snoozed' | 'dismissed'

export function SuggestionsPage() {
  const ds = useData()
  const [managers, setManagers] = useState<string[]>([])
  const [handled, setHandled] = useState<Record<string, LocalState>>({})
  const [confirm, setConfirm] = useState<Suggestion | null>(null)
  const range = useMemo(() => presetRange('last_7_days'), [])

  const { data: employees } = useAsync(() => ds.employees(), [ds])
  const { data, loading } = useAsync(async () => {
    const [ads, accounts, recent, settings] = await Promise.all([
      ds.report('ad', range), ds.report('account', range), ds.recentLeadsByAccount(3), ds.ruleSettings(),
    ])
    return { suggestions: evaluateRules({ ads, accounts, recentLeadsByAccount: recent, settings }), settings }
  }, [ds])

  const managerName = useMemo(() => new Map((employees ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`])), [employees])
  const groups = useMemo(() => {
    const live = (data?.suggestions ?? []).filter((s) => !handled[s.key] && (!managers.length || (s.managerId && managers.includes(s.managerId))))
    return groupByAccount(live)
  }, [data, handled, managers])
  const settings: RuleSettings = { ...DEFAULT_RULE_SETTINGS, ...data?.settings }
  const total = groups.reduce((n, g) => n + g.suggestions.length, 0)

  const act = (s: Suggestion, state: LocalState) => setHandled((h) => ({ ...h, [s.key]: state }))

  return (
    <div>
      <PageTitle
        title="Suggestions"
        subtitle={loading ? 'Checking every ad account…' : `${total} suggestion${total === 1 ? '' : 's'} across ${groups.length} ad account${groups.length === 1 ? '' : 's'} · last 7 days`}
        right={<ManagerFilter managers={(employees ?? []).filter((e) => e.isAdManager)} selected={managers} onChange={setManagers} />}
      />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-white p-3 text-xs text-muted">
        <Info size={16} className="mt-px shrink-0" />
        <span>
          Flags ads with cost per lead over <b>{money(settings.expensiveCpl)}</b>, over <b>{money(settings.noLeadSpend)}</b> spent with no leads,
          ads taking <b>{Math.round(settings.budgetHogShare * 100)}%+</b> of their ad set's budget at over <b>{money(settings.budgetHogCpl)}</b> per lead,
          CTR under <b>{settings.lowCtr}%</b> or link CTR under <b>{settings.lowLinkCtr}%</b> (after {count(settings.minImpressions)} impressions),
          account problems, and no leads in {settings.noRecentLeadsDays} days. Thresholds will be editable in settings.
        </span>
      </div>

      {!loading && groups.length === 0 && <Card><Empty>Nothing needs attention right now. 🎉</Empty></Card>}

      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.accountId} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{g.clientName ?? g.accountName}</h2>
                <p className="text-xs text-muted">
                  {g.clientName && g.clientName !== g.accountName ? `${g.accountName} · ` : 'Ad account · '}
                  {g.suggestions.length} suggestion{g.suggestions.length > 1 ? 's' : ''}
                </p>
              </div>
              <ManagerChip name={g.managerId ? managerName.get(g.managerId) ?? null : null} />
            </div>
            <ul className="mt-3 space-y-2">
              {g.suggestions.map((s) => (
                <li key={s.key} className={`rounded-lg border p-3 ${s.severity === 'high' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                  <div className="flex gap-2">
                    <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${s.severity === 'high' ? 'text-bad' : 'text-warn'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{s.message} <span className="font-semibold">{s.question}</span></p>
                      {s.siblings && s.siblings.length > 0 && (
                        <div className="mt-1.5 text-xs text-muted">
                          Other ads in this ad set:{' '}
                          {s.siblings.map((x) => `${x.name} (${money(x.spend)}, ${x.leads} lead${x.leads === 1 ? '' : 's'}${x.cpl !== null ? `, ${money(x.cpl)} CPL` : ''})`).join(' · ')}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {s.action.type === 'pause_ad' ? (
                          <button onClick={() => setConfirm(s)} className="rounded-md bg-ink px-3 py-1 text-xs font-semibold text-white">Turn off</button>
                        ) : (
                          <a
                            href={`https://adsmanager.facebook.com/adsmanager/manage/${s.level === 'ad' ? `ads?act=${s.accountId}&selected_ad_ids=${s.entityId}` : `campaigns?act=${s.accountId}`}`}
                            target="_blank" rel="noreferrer" className="rounded-md bg-ink px-3 py-1 text-xs font-semibold text-white"
                          >
                            Open in Ads Manager
                          </a>
                        )}
                        <button onClick={() => act(s, 'snoozed')} className="rounded-md border border-line bg-white px-3 py-1 text-xs font-medium">Not now</button>
                        <button onClick={() => act(s, 'dismissed')} className="rounded-md px-3 py-1 text-xs font-medium text-muted hover:bg-gray-100">Dismiss</button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Turn off this ad?">
        {confirm && (
          <>
            <p className="text-sm">
              <b>{confirm.entityName}</b> in {confirm.clientName ?? confirm.accountName} will be paused in Meta. You can turn it back on in Ads Manager.
            </p>
            {SAMPLE_MODE && (
              <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">Sample data: nothing is changed in Meta. Once live, this pauses the ad and records who did it.</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-md border border-line px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={() => { act(confirm, 'done'); setConfirm(null) }} className="rounded-md bg-bad px-3 py-1.5 text-sm font-semibold text-white">Turn off ad</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
