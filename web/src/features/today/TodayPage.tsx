/**
 * Today: the home page (docs/suggestions.md#today-screen, docs/sop/acting-on-suggestions.md).
 * One quiet list of what needs doing across a person's accounts: one plain
 * sentence and one button per row, most urgent and most money first. Tap a row
 * for the numbers and the other options. Healthy accounts stay out of the way.
 *
 * Data: suggestions saved by run-rules every 30 min (row-level security limits
 * ads managers to their own; owners/admins can look at anyone's). Turn off and
 * Undo go through the meta-action function. Sample mode runs the rules in the
 * browser and changes nothing.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, ChevronDown, ChevronRight, X } from 'lucide-react'
import { evaluateRules, type Suggestion } from '@shared/domain/rules.ts'
import { canTurnOff, greeting, groupToday, primaryButton, todayLine, todayOrder } from '@shared/domain/today.ts'
import { presetRange } from '@shared/domain/dates.ts'
import { useData, type ActionRecord, type StoredSuggestion, type TurnOffResult } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { Modal } from '../../components/ui'
import { dateTime, money } from '../../lib/format'
import { SAMPLE_MODE } from '../../lib/config'
import { useSession } from '../../app/session'

type Item = Suggestion & { id?: string; turnOffCheck?: StoredSuggestion['turnOffCheck'] }
type Notice = { ok: boolean; text: string; undoId?: string; link?: string; restore?: Item }
/** An ad turned off from this page: its row stays, marked done, until the page reloads. */
type Done = { at: string; verified: boolean; undoId?: string }

const adsManager = (s: Item) =>
  s.level === 'ad'
    ? `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${s.accountId}&selected_ad_ids=${s.entityId}`
    : `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${s.accountId}`
const billing = (s: Item) => `https://business.facebook.com/billing_hub/accounts/details?asset_id=${s.accountId}`

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function TodayPage() {
  const ds = useData()
  const { me, isAdmin } = useSession()
  const range = useMemo(() => presetRange('last_7_days'), [])
  const live = useLiveRefresh(['rules.run'])
  const [actionsVersion, setActionsVersion] = useState(0)
  const { data: employees } = useAsync(() => ds.employees(), [ds])
  const { data: actions } = useAsync(() => ds.recentActions(15), [ds, actionsVersion, live])
  const { data, loading, error } = useAsync(async () => {
    const [stored, accounts] = await Promise.all([ds.storedSuggestions(), ds.report('account', range)])
    if (stored) return { items: stored as Item[], accounts }
    const [ads, recent, settings] = await Promise.all([ds.report('ad', range), ds.recentLeadsByAccount(3), ds.ruleSettings()])
    return { items: evaluateRules({ ads, accounts, recentLeadsByAccount: recent, settings }) as Item[], accounts }
  }, [ds, live])

  // Whose accounts: ads managers see their own; owners/admins pick (default: everyone).
  const [scope, setScope] = useState<string>('all')
  const inScope = (managerId: string | null) =>
    !isAdmin ? !!me && managerId === me.id : scope === 'all' || managerId === scope
  const [handled, setHandled] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Item | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  // The Turn off box shows the outcome after the click (done and confirmed, or what went wrong).
  const [outcome, setOutcome] = useState<{ item: Item; res: TurnOffResult } | null>(null)
  const [turnedOff, setTurnedOff] = useState<Map<string, Done>>(new Map())
  // Rows where Meta refused a Turn off just now (the stored check covers the rest).
  const [blocked, setBlocked] = useState<Map<string, string>>(new Map())
  const whyBlocked = (s: Item) => blocked.get(s.key) ?? (s.turnOffCheck && !s.turnOffCheck.ok ? s.turnOffCheck.short ?? "Meta won't let The Lab change this ad" : null)

  const items = useMemo(
    () => todayOrder((data?.items ?? []).filter((s) => !handled.has(s.key) && inScope(s.managerId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, handled, scope, isAdmin, me],
  )
  const accountsInScope = useMemo(
    () => (data?.accounts ?? []).filter((a) => (a.clientStatus === 'Active' || a.clientStatus === 'New') && inScope(a.managerId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, scope, isAdmin, me],
  )
  const pending = items.filter((s) => !turnedOff.has(s.key))
  const fine = Math.max(0, accountsInScope.length - new Set(pending.map((s) => s.accountId)).size)
  const managerName = useMemo(() => new Map((employees ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`])), [employees])

  const hide = (s: Item) => setHandled((h) => new Set(h).add(s.key))
  const unhide = (s: Item) => setHandled((h) => { const n = new Set(h); n.delete(s.key); return n })

  const snooze = async (s: Item, state: 'snoozed' | 'dismissed') => {
    hide(s)
    setOpen(null)
    const where = s.clientName ?? s.accountName
    setNotice({
      ok: true,
      text: state === 'dismissed' ? `Dismissed ${where}. It won't come back for 7 days.` : `Hidden ${where} until tomorrow.`,
      restore: s,
    })
    if (!s.id) return
    try {
      await ds.updateSuggestion(s.id, state)
    } catch (e) {
      unhide(s)
      setNotice({ ok: false, text: `Couldn't save that: ${(e as Error).message}` })
    }
  }

  /** Undo a Dismiss or Not now: back on the list. */
  const restore = async (s: Item) => {
    unhide(s)
    setNotice(null)
    if (!s.id) return
    try {
      await ds.updateSuggestion(s.id, 'open')
    } catch (e) {
      hide(s)
      setNotice({ ok: false, text: `Couldn't undo that: ${(e as Error).message}` })
    }
  }

  const turnOff = async (s: Item) => {
    setBusy(true)
    const res = await ds.turnOffAd(s.id ?? s.key)
    setBusy(false)
    setConfirm(null)
    setActionsVersion((v) => v + 1)
    setOutcome({ item: s, res })
    if (!res.ok && (res.needsManageCampaigns || res.needsPageAccess)) {
      // Meta refused for lack of access: show "Turn off in Ads Manager" on this row from now on.
      setBlocked((m) => new Map(m).set(s.key, res.needsPageAccess ? "The Lab can't see this client's Facebook Page" : 'This ad account is view-only for The Lab'))
    }
    if (res.ok) {
      setOpen(null)
      setNotice(null)
      setTurnedOff((m) => new Map(m).set(s.key, {
        at: res.at ?? new Date().toISOString(), verified: !!res.verified,
        undoId: res.alreadyOff ? undefined : s.id ?? (SAMPLE_MODE ? s.key : undefined),
      }))
    }
  }

  const undo = async (suggestionId: string, s?: Item) => {
    setBusy(true)
    const res = await ds.undoTurnOff(suggestionId)
    setBusy(false)
    setOutcome(null)
    setActionsVersion((v) => v + 1)
    if (res.ok && s) {
      // Turned back on and not suggested for 7 days, so it leaves the list.
      setTurnedOff((m) => { const n = new Map(m); n.delete(s.key); return n })
      hide(s)
    }
    setNotice({ ok: res.ok, text: res.ok ? `${res.message} It won't be suggested again for 7 days.` : res.message })
  }

  const first = me?.firstName ?? ''
  // Whose list this is, for the sentence: you, everyone, or one ads manager.
  const mine = !isAdmin || scope === me?.id
  const other = isAdmin && scope !== 'all' && !mine ? managerName.get(scope)?.split(' ')[0] ?? 'They' : null
  const subject = mine ? 'you' : other ?? 'attention'
  const rest = mine ? 'Your other' : other ? `${other}'s other` : 'The other'
  const summary = loading && !data
    ? 'Checking accounts...'
    : items.length === 0
      ? `Nothing needs ${mine ? 'you' : other ?? 'attention'} today. All ${accountsInScope.length} account${accountsInScope.length === 1 ? ' is' : 's are'} fine.`
      : null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting()}{first ? `, ${first}` : ''}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {summary ?? (pending.length === 0 ? `All done. Every account is fine.` : (
              <>
                <b className="text-ink">{pending.length} thing{pending.length === 1 ? '' : 's'}</b> need{pending.length === 1 ? 's' : ''} {subject} today.{' '}
                {fine > 0 && `${rest} ${fine} account${fine === 1 ? ' is' : 's are'} fine.`}
              </>
            ))}
          </p>
        </div>
        {isAdmin && (
          <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Whose accounts"
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm font-medium">
            <option value="all">Everyone</option>
            {(employees ?? []).filter((e) => e.isAdManager).map((e) => (
              <option key={e.id} value={e.id}>{e.id === me?.id ? 'Mine' : `${e.firstName} ${e.lastName}`}</option>
            ))}
          </select>
        )}
      </div>

      {notice && (
        <div role="status" className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${notice.ok ? 'border-line bg-surface' : 'border-alert-high-line bg-alert-high'}`}>
          <span className="min-w-0">
            {notice.text}{' '}
            {notice.undoId && <button disabled={busy} onClick={() => undo(notice.undoId!)} className="font-semibold text-brand">Undo</button>}
            {notice.restore && <button onClick={() => restore(notice.restore!)} className="font-semibold text-brand">Undo</button>}
            {notice.undoId && notice.link && <span className="text-muted"> · </span>}
            {notice.link && <a href={notice.link} target="_blank" rel="noreferrer" className="font-semibold text-brand">{notice.ok ? 'Check in Ads Manager' : 'Open in Ads Manager'}</a>}
          </span>
          <button onClick={() => setNotice(null)} aria-label="Close" className="text-muted"><X size={15} /></button>
        </div>
      )}

      {error && <p className="text-sm text-bad">Couldn't load: {error.message}</p>}

      {/* One block per location, most urgent and most money first. */}
      <div className="space-y-3">
        {groupToday(items).map((g) => {
          const manager = isAdmin && scope === 'all' ? managerName.get(g.items[0].managerId ?? '') ?? null : null
          const left = g.items.filter((s) => !turnedOff.has(s.key)).length
          return (
            <section key={g.accountId} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <header className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-1">
                <h2 className="min-w-0 truncate font-semibold">{g.name}</h2>
                <span className="shrink-0 text-xs text-muted">
                  {manager && `${manager} · `}{left ? `${left} thing${left === 1 ? '' : 's'}` : 'Done'}
                </span>
              </header>
              <ul>
                {g.items.map((s) => (
                  turnedOff.has(s.key)
                    ? <DoneRow key={s.key} s={s} done={turnedOff.get(s.key)!} busy={busy} onUndo={(id) => undo(id, s)} />
                    : <Row key={s.key} s={s} open={open === s.key} onToggle={() => setOpen(open === s.key ? null : s.key)} blockedWhy={whyBlocked(s)}
                        managerName={manager} onTurnOff={() => { setOutcome(null); setConfirm(s) }} onSnooze={(st) => snooze(s, st)} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>{items.length > 0 ? 'Tap a row for the numbers and other options.' : ''}</span>
        <Link to="/insights" className="font-semibold text-brand">See all {accountsInScope.length} accounts</Link>
      </div>

      <Recent actions={actions ?? []} busy={busy} onUndo={(id) => undo(id, items.find((s) => s.id === id))} />

      <Modal open={!!confirm} onClose={() => !busy && setConfirm(null)} title="Turn off this ad?">
        {confirm && (
          <>
            <p className="text-sm">
              <b>{confirm.entityName}</b> in {confirm.clientName ?? confirm.accountName} will be paused in Meta. You can undo it here for 24 hours.
            </p>
            {SAMPLE_MODE && <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">Sample data: nothing is changed in Meta.</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} disabled={busy} className="rounded-lg border border-line px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={() => turnOff(confirm)} disabled={busy} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-60">
                {busy ? 'Turning off and checking with Meta...' : 'Turn off'}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!outcome} onClose={() => setOutcome(null)}
        title={!outcome ? '' : !outcome.res.ok ? "Couldn't turn it off" : outcome.res.alreadyOff ? 'Already off' : outcome.res.verified ? 'Done: the ad is off' : 'Sent to Meta, not confirmed yet'}>
        {outcome && <Outcome o={outcome} busy={busy} onUndo={(id) => undo(id, outcome.item)} onClose={() => setOutcome(null)} />}
      </Modal>
    </div>
  )
}

function Row({ s, open, onToggle, managerName, onTurnOff, onSnooze, blockedWhy }: {
  s: Item; open: boolean; onToggle: () => void; managerName: string | null
  onTurnOff: () => void; onSnooze: (state: 'snoozed' | 'dismissed') => void
  /** Why Turn off can't work here (checked with Meta in advance), or null. */
  blockedWhy: string | null
}) {
  const primary = primaryButton(s)
  const btn = 'whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold'
  const solid = `${btn} bg-primary text-on-primary`
  const outline = `${btn} border border-line bg-surface`
  const dot = s.rule === 'low_ctr' || s.rule === 'low_link_ctr' || s.severity === 'medium' ? 'bg-warn' : 'bg-bad'

  const primaryEl =
    primary === 'turn_off' && blockedWhy
      ? <a href={adsManager(s)} target="_blank" rel="noreferrer" className={outline} title={`Can't turn off from The Lab: ${blockedWhy}`}>Turn off in Ads Manager</a>
      : primary === 'turn_off' ? <button onClick={onTurnOff} className={solid}>Turn off</button>
      : primary === 'open_billing' ? <a href={billing(s)} target="_blank" rel="noreferrer" className={outline}>Open billing</a>
      : <a href={adsManager(s)} target="_blank" rel="noreferrer" className={outline}>Open</a>

  const e = s.evidence ?? {}
  const facts: [string, string][] = []
  if (s.level === 'ad') facts.push(['Ad', s.entityName])
  if (num(e.spend) !== null) facts.push(['Spent', money(num(e.spend))])
  if (num(e.leads) !== null) facts.push(['Leads', String(num(e.leads))])
  if (num(e.cpl) !== null) facts.push(['Cost per lead', money(num(e.cpl))])
  if (num(e.linkCtr) !== null) facts.push(['Link CTR', `${num(e.linkCtr)!.toFixed(2)}%`])
  if (num(e.ctr) !== null) facts.push(['CTR', `${num(e.ctr)!.toFixed(2)}%`])
  if (num(e.impressions) !== null) facts.push(['Impressions', num(e.impressions)!.toLocaleString()])
  if (num(e.share) !== null) facts.push(["Share of ad set's spend", `${Math.round(num(e.share)! * 100)}%`])
  if (managerName) facts.push(['Ads manager', managerName])
  facts.push(['Period', 'Last 7 days'])

  return (
    <li className="border-t border-line first:border-t-0">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
          <span className="min-w-0">
            <span className="block">{todayLine(s)}</span>
            {s.level === 'ad' && <span className="block truncate text-xs text-muted">{s.entityName}</span>}
            {blockedWhy && canTurnOff(s) && <span className="block text-xs text-warn">Can't turn off from The Lab: {blockedWhy}</span>}
          </span>
        </button>
        {primaryEl}
        <button onClick={() => onSnooze('dismissed')} aria-label="Dismiss" title="Dismiss: hide for 7 days"
          className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink">
          <X size={16} />
        </button>
        <button onClick={onToggle} aria-label={open ? 'Hide details' : 'Show details'} className="hidden text-muted sm:block">
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-subtle/50 px-4 py-3 pl-9 text-sm">
          <p className="text-soft">{s.message} {s.question}</p>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5">
            {facts.map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="truncate">{v}</dd></div>
            ))}
          </dl>
          {s.siblings && s.siblings.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Other ads in this ad set: {s.siblings.map((x) => `${x.name} (${money(x.spend)}, ${x.leads} lead${x.leads === 1 ? '' : 's'}${x.cpl !== null ? `, ${money(x.cpl)} a lead` : ''})`).join(' · ')}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {primary !== 'turn_off' && canTurnOff(s) && !blockedWhy && <button onClick={onTurnOff} className={outline}>Turn off</button>}
            {primary !== 'open_ad' && primary !== 'open_account' && (
              <a href={adsManager(s)} target="_blank" rel="noreferrer" className={outline}>Open in Ads Manager</a>
            )}
            <button onClick={() => onSnooze('snoozed')} className={outline}>Not now</button>
            <button onClick={() => onSnooze('dismissed')} className={`${btn} text-muted hover:bg-subtle`}>Dismiss</button>
          </div>
          <p className="mt-2 text-xs text-muted">Not now hides it for a day. Dismiss (also the X on the row) hides it for 7 days. Both can be undone.</p>
        </div>
      )}
    </li>
  )
}

/** What happened after Turn off: done and confirmed by Meta, already off, not confirmed, or failed. */
function Outcome({ o, busy, onUndo, onClose }: { o: { item: Item; res: TurnOffResult }; busy: boolean; onUndo: (id: string) => void; onClose: () => void }) {
  const { item: s, res } = o
  const good = res.ok && (res.verified || res.alreadyOff)
  const undoId = res.ok && !res.alreadyOff ? s.id ?? (SAMPLE_MODE ? s.key : undefined) : undefined
  const btn = 'rounded-lg px-3 py-1.5 text-sm font-semibold'
  return (
    <>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${good ? 'bg-good/15 text-good' : 'bg-alert-high text-bad'}`}>
          {good ? <Check size={18} strokeWidth={2.5} /> : <AlertTriangle size={16} />}
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-medium">{s.entityName}</p>
          <p className="text-muted">{s.clientName ?? s.accountName}{res.ok && res.at ? ` · ${dateTime(res.at)}` : ''}</p>
          <p className="mt-2">{res.message}</p>
          {res.ok && !res.alreadyOff && <p className="mt-1 text-muted">Undo is available here and under Recently turned off for 24 hours.</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <a href={adsManager(s)} target="_blank" rel="noreferrer" className={`${btn} border border-line`}>{res.ok ? 'Check in Ads Manager' : 'Open in Ads Manager'}</a>
        {undoId && <button disabled={busy} onClick={() => onUndo(undoId)} className={`${btn} border border-line`}>{busy ? 'Turning back on...' : 'Undo'}</button>}
        <button onClick={onClose} className={`${btn} bg-primary text-on-primary`}>{res.ok ? 'Done' : 'Close'}</button>
      </div>
    </>
  )
}

/** A row that was turned off from this page: stays in place, marked done, with Undo. */
function DoneRow({ s, done, busy, onUndo }: { s: Item; done: Done; busy: boolean; onUndo: (id: string) => void }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-good/15 text-good"><Check size={13} strokeWidth={3} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-soft">Turned off{done.verified ? ', confirmed in Meta' : ''} · {dateTime(done.at)}</span>
          <span className="block truncate text-xs text-muted">{s.entityName}</span>
        </span>
        {done.undoId && <button disabled={busy} onClick={() => onUndo(done.undoId!)} className="whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold">Undo</button>}
      </div>
    </li>
  )
}

/** Latest Turn offs (and Undos), with Undo for 24 hours. Collapsed by default. */
function Recent({ actions, busy, onUndo }: { actions: ActionRecord[]; busy: boolean; onUndo: (id: string) => void }) {
  if (!actions.length) return null
  const undone = new Set(actions.filter((a) => a.kind === 'on' && a.ok).map((a) => a.suggestionId))
  const canUndo = (a: ActionRecord) =>
    a.kind === 'off' && a.ok && !a.note && !!a.suggestionId && !undone.has(a.suggestionId) && Date.now() - new Date(a.at).getTime() < 24 * 3_600_000
  return (
    <details className="mt-8">
      <summary className="cursor-pointer text-sm font-semibold text-muted">Recently turned off ({actions.filter((a) => a.kind === 'off').length})</summary>
      <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
        {actions.map((a, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium">{a.adName ?? 'Ad'}</span>
              <span className="text-muted"> · {a.accountName ?? ''} · {a.who ?? 'someone'} · {dateTime(a.at)}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted" title={a.note ?? undefined}>
                {!a.ok ? 'Failed' : a.kind === 'on' ? 'Turned back on' : a.note ? 'Already off' : 'Turned off'}
              </span>
              {canUndo(a) && <button disabled={busy} onClick={() => onUndo(a.suggestionId!)} className="text-xs font-semibold text-brand">Undo</button>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

