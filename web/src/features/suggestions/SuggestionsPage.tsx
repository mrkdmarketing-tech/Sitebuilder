/**
 * Suggestions (Phase 1b preview). One overview card per ad account, in the app
 * only (no Slack), e.g. "Renzo Gracie Boca: an ad has 1 lead at $120. Turn it off?"
 * Rules: shared/domain/rules.ts · docs/suggestions.md.
 *
 * Live: the run-rules job saves suggestions every 30 min; this page reads them
 * (row-level security limits each ads manager to their own), "Not now" and
 * "Dismiss" are saved, and "Turn off" pauses the ad in Meta via meta-action.
 * Sample mode: the same rules run in the browser and nothing is saved.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { DEFAULT_RULE_SETTINGS, evaluateRules, groupByAccount, type RuleSettings, type Suggestion } from '@shared/domain/rules.ts'
import { presetRange } from '@shared/domain/dates.ts'
import { useData, type StoredSuggestion } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { Card, Empty, ManagerChip, Modal, PageTitle } from '../../components/ui'
import { ManagerFilter } from '../insights/Filters'
import { count, dateTime, money } from '../../lib/format'
import { SAMPLE_MODE } from '../../lib/config'
import { useSession } from '../../app/session'

type LocalState = 'done' | 'snoozed' | 'dismissed'
type Shown = Suggestion & { id?: string }
type Notice = { ok: boolean; text: string; adsManagerUrl?: string }

export function SuggestionsPage() {
  const ds = useData()
  const { me, isAdmin } = useSession()
  // Ads managers only ever see suggestions for the accounts assigned to them in
  // GHL ("Assigned to" on the client contact → clients.ad_manager_id). Owners and
  // admins see everyone's and can filter. The database enforces the same rule.
  const [managers, setManagers] = useState<string[]>([])
  const [handled, setHandled] = useState<Record<string, LocalState>>({})
  const [confirm, setConfirm] = useState<Shown | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const range = useMemo(() => presetRange('last_7_days'), [])

  const { data: employees } = useAsync(() => ds.employees(), [ds])
  const live = useLiveRefresh(['rules.run'])
  const [actionsVersion, setActionsVersion] = useState(0)
  const { data: actions } = useAsync(() => ds.recentActions(10), [ds, actionsVersion, live])
  const { data, loading } = useAsync(async () => {
    const [stored, accounts, settings] = await Promise.all([ds.storedSuggestions(), ds.report('account', range), ds.ruleSettings()])
    if (stored) return { suggestions: stored as Shown[], settings, accounts }
    // Sample mode: run the same rules in the browser.
    const [ads, recent] = await Promise.all([ds.report('ad', range), ds.recentLeadsByAccount(3)])
    return { suggestions: evaluateRules({ ads, accounts, recentLeadsByAccount: recent, settings }) as Shown[], settings, accounts }
  }, [ds, live])

  const managerName = useMemo(() => new Map((employees ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`])), [employees])
  const groups = useMemo(() => {
    const mine = (managerId: string | null) =>
      isAdmin ? !managers.length || (!!managerId && managers.includes(managerId)) : !!me && managerId === me.id
    const live = (data?.suggestions ?? []).filter((s) => !handled[s.key] && mine(s.managerId))
    return groupByAccount(live)
  }, [data, handled, managers, isAdmin, me])
  const myAccountCount = useMemo(() => (me ? (data?.accounts ?? []).filter((a) => a.managerId === me.id).length : 0), [data, me])
  const settings: RuleSettings = { ...DEFAULT_RULE_SETTINGS, ...data?.settings }
  const total = groups.reduce((n, g) => n + g.suggestions.length, 0)

  const hide = (s: Shown, state: LocalState) => setHandled((h) => ({ ...h, [s.key]: state }))
  const adsManagerUrl = (s: Shown) =>
    `https://adsmanager.facebook.com/adsmanager/manage/${s.level === 'ad' ? `ads?act=${s.accountId}&selected_ad_ids=${s.entityId}` : `campaigns?act=${s.accountId}`}`

  /** "Not now" / "Dismiss": saved when live. */
  const act = async (s: Shown, state: 'snoozed' | 'dismissed') => {
    hide(s, state)
    if (s.id) {
      try {
        await ds.updateSuggestion(s.id, state)
      } catch (e) {
        setHandled((h) => { const n = { ...h }; delete n[s.key]; return n })
        setNotice({ ok: false, text: `Couldn't save that: ${(e as Error).message}` })
      }
    }
  }

  /** "Turn off": pauses the ad in Meta (sample mode: nothing changes). */
  const turnOff = async (s: Shown) => {
    setBusy(true)
    const res = await ds.turnOffAd((s as StoredSuggestion).id ?? s.key)
    setBusy(false)
    setConfirm(null)
    setActionsVersion((v) => v + 1)
    if (res.ok) {
      hide(s, 'done')
      setNotice({ ok: true, text: `Done: ${res.message} It's recorded that you turned it off.`, adsManagerUrl: adsManagerUrl(s) })
    } else {
      setNotice({ ok: false, text: res.message, adsManagerUrl: adsManagerUrl(s) })
    }
  }

  return (
    <div>
      <PageTitle
        title="Suggestions"
        subtitle={
          loading
            ? 'Checking ad accounts…'
            : isAdmin
              ? `${total} suggestion${total === 1 ? '' : 's'} across ${groups.length} ad account${groups.length === 1 ? '' : 's'} · last 7 days`
              : `${me?.firstName ?? 'You'}, you look after ${myAccountCount} ad account${myAccountCount === 1 ? '' : 's'} (assigned in GHL) · ${total} suggestion${total === 1 ? '' : 's'} · last 7 days`
        }
        right={
          isAdmin ? (
            <ManagerFilter managers={(employees ?? []).filter((e) => e.isAdManager)} selected={managers} onChange={setManagers} />
          ) : (
            <span className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted">Only your accounts</span>
          )
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-xs text-muted">
        <Info size={16} className="mt-px shrink-0" />
        <span>
          Flags ads with cost per lead over <b>{money(settings.expensiveCpl)}</b>, over <b>{money(settings.noLeadSpend)}</b> spent with no leads,
          ads taking <b>{Math.round(settings.budgetHogShare * 100)}%+</b> of their ad set's budget at over <b>{money(settings.budgetHogCpl)}</b> per lead,
          CTR under <b>{settings.lowCtr}%</b> or link CTR under <b>{settings.lowLinkCtr}%</b> (after {count(settings.minImpressions)} impressions),
          account problems, and no leads in {settings.noRecentLeadsDays} days. Updated every 30 minutes. Thresholds will be editable in settings.
        </span>
      </div>

      {notice && (
        <div role="status" className={`mb-4 flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${notice.ok ? 'border-line bg-surface' : 'border-alert-high-line bg-alert-high'}`}>
          <span>
            {notice.text}{' '}
            {notice.adsManagerUrl && (
              <a href={notice.adsManagerUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
                {notice.ok ? 'Check it in Ads Manager' : 'Open in Ads Manager'}
              </a>
            )}
          </span>
          <button onClick={() => setNotice(null)} className="text-xs text-muted">Close</button>
        </div>
      )}

      {!loading && groups.length === 0 && (
        <Card><Empty>{isAdmin ? 'Nothing needs attention right now.' : 'Nothing needs attention on your accounts right now.'}</Empty></Card>
      )}

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
                <li key={s.key} className={`rounded-lg border p-3 ${s.severity === 'high' ? 'border-alert-high-line bg-alert-high' : 'border-alert-med-line bg-alert-med'}`}>
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
                          <button onClick={() => setConfirm(s)} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-on-primary">Turn off</button>
                        ) : (
                          <a href={adsManagerUrl(s)} target="_blank" rel="noreferrer" className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-on-primary">
                            Open in Ads Manager
                          </a>
                        )}
                        <button onClick={() => act(s, 'snoozed')} className="rounded-md border border-line bg-surface px-3 py-1 text-xs font-medium">Not now</button>
                        <button onClick={() => act(s, 'dismissed')} className="rounded-md px-3 py-1 text-xs font-medium text-muted hover:bg-subtle">Dismiss</button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {actions && actions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">Recently turned off</h2>
          <Card>
            <ul className="divide-y divide-line">
              {actions.map((a, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{a.adName ?? 'Ad'}</span>
                    <span className="text-muted"> · {a.accountName ?? ''} · {a.who ?? 'someone'} · {dateTime(a.at)}</span>
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${a.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`} title={a.note ?? undefined}>
                    {a.ok ? (a.note ? 'Already off' : 'Turned off') : 'Failed'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Turn off this ad?">
        {confirm && (
          <>
            <p className="text-sm">
              <b>{confirm.entityName}</b> in {confirm.clientName ?? confirm.accountName} will be paused in Meta, and it's recorded that you did it. You can turn it back on in Ads Manager.
            </p>
            {SAMPLE_MODE && (
              <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">Sample data: nothing is changed in Meta. Once live, this pauses the ad and records who did it.</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} disabled={busy} className="rounded-md border border-line px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={() => turnOff(confirm)} disabled={busy} className="rounded-md bg-bad px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? 'Turning off…' : 'Turn off ad'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
