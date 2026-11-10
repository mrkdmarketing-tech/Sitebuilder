/**
 * One ad: edit, check for mistakes, submit, review (docs/ad-approval.md,
 * docs/sop/ad-approval-submit.md, docs/sop/ad-approval-review.md).
 *
 * Editable while Draft or Changes requested. Status moves go through
 * set_review_status (database), which also records "Submit anyway".
 * Ads imported from Retool are shown read-only.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, ExternalLink, Film, Link2, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react'
import {
  CATEGORY_LABEL, MOVES, fieldLabel, fillTemplate, placeholderValues, toCreative, toLeadForm, unfilledPlaceholders,
  type CreativeCopy, type LeadFormCopy, type ReviewStatus, type StatusMove,
} from '@shared/domain/approvals.ts'
import { Card, Modal } from '../../components/ui'
import { useData } from '../../data/source'
import type { CheckResult, ClientBrief, ReviewAsset, ReviewDetail, ReviewFinding, Template } from '../../data/approvals'
import { useAsync } from '../../lib/useAsync'
import { ACCEPTED_FILES, clock, prepareMedia } from '../../lib/media'
import { useSession } from '../../app/session'
import { Button, Field, Section, StatusPill, ago, htmlToText, inputClass } from './parts'

interface Draft {
  name: string
  adType: string
  bookingType: string
  creative: CreativeCopy
  leadform: LeadFormCopy
  notes: string
  metaLeadformId: string
}

const toDraft = (d: ReviewDetail): Draft => ({
  name: d.name, adType: d.adType ?? '', bookingType: d.bookingType ?? '', creative: d.creative,
  leadform: d.leadform, notes: d.notes, metaLeadformId: d.metaLeadformId ?? '',
})

const TRACKING = ['Website Event', 'CRM Event']
const FORM_TYPES = ['More volume', 'Higher intent', 'Rich creative']

export function ReviewPage() {
  const { id = '' } = useParams()
  const ds = useData()
  const { me } = useSession()
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)
  const detail = useAsync(() => ds.approvals.get(id), [ds, id, version])
  const lookups = useAsync(() => ds.approvals.lookups(), [ds])
  const templates = useAsync(() => ds.approvals.templates(), [ds])
  const employees = useAsync(() => ds.employees(), [ds])
  const d = detail.data
  const brief = useAsync(() => (d?.clientId ? ds.approvals.brief(d.clientId) : Promise.resolve(null)), [ds, d?.clientId])

  // Local edits survive reloads (after a comment, tick...) unless nothing was changed.
  const [draft, setDraft] = useState<Draft | null>(null)
  const saved = useRef('')
  useEffect(() => {
    if (!d) return
    const fresh = toDraft(d)
    const before = saved.current
    setDraft((cur) => (!cur || JSON.stringify(cur) === before ? fresh : cur))
    saved.current = JSON.stringify(fresh)
  }, [d])

  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [move, setMove] = useState<StatusMove | null>(null)

  if (detail.error) return <p className="text-sm text-bad">Couldn't load this ad: {detail.error.message}</p>
  if (!d || !draft) return <p className="py-8 text-center text-sm text-muted">{detail.loading ? 'Loading...' : 'Ad not found.'}</p>

  const editable = !d.legacy && (d.status === 'draft' || d.status === 'request_changes')
  const dirty = JSON.stringify(draft) !== saved.current
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const setCreative = (patch: Partial<CreativeCopy>) => setDraft({ ...draft, creative: { ...draft.creative, ...patch } })
  const setLeadform = (patch: Partial<LeadFormCopy>) => setDraft({ ...draft, leadform: { ...draft.leadform, ...patch } })

  const run = async (label: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(label)
    setNotice(null)
    try {
      await fn()
      if (done) setNotice({ ok: true, text: done })
      reload()
      return true
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message })
      return false
    } finally {
      setBusy(null)
    }
  }

  const save = () => ds.approvals.save(d.id, {
    name: draft.name, adType: draft.adType || null, bookingType: draft.bookingType || null,
    creative: draft.creative, leadform: draft.leadform, notes: draft.notes, metaLeadformId: draft.metaLeadformId || null,
  })
  const saveIfDirty = async () => {
    if (editable && dirty) {
      await save()
      saved.current = JSON.stringify(draft)
    }
  }

  const check = async () => {
    setBusy('check')
    setNotice(null)
    try {
      await saveIfDirty()
      const r: CheckResult = await ds.approvals.runCheck(d.id)
      setNotice({ ok: r.status === 'ok' || r.status === 'unchanged', text: r.message })
      reload()
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const moves = d.legacy ? [] : MOVES[d.status]

  return (
    <div className="pb-8">
      <Link to="/approvals" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={14} /> Ad approval
      </Link>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          {editable ? (
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} aria-label="Ad name"
              className="w-full max-w-xl rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xl font-bold tracking-tight outline-none hover:border-line focus:border-brand" />
          ) : (
            <h1 className="text-xl font-bold tracking-tight">{d.name}</h1>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-sm text-muted">
            <StatusPill status={d.status} />
            <span>{d.clientName ?? 'No client'}</span>
            {d.createdByName && <span>· by {d.createdByName}</span>}
            {d.reviewerName && <span>· reviewer {d.reviewerName}</span>}
            <span>· updated {ago(d.updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Button onClick={() => run('save', async () => { await save(); saved.current = JSON.stringify(draft) }, 'Saved.')} disabled={!dirty || !!busy}>
              {busy === 'save' ? 'Saving...' : dirty ? 'Save' : 'Saved'}
            </Button>
          )}
          {moves.map((m) => (
            <Button key={m.to} kind={m.to === 'request_changes' ? 'secondary' : 'primary'} disabled={!!busy}
              onClick={async () => { try { await saveIfDirty(); setMove(m) } catch (e) { setNotice({ ok: false, text: (e as Error).message }) } }}>
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {notice && (
        <div className={`mb-3 flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm ${notice.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Close"><X size={14} /></button>
        </div>
      )}
      {d.legacy && <LegacyBanner d={d} />}
      {d.status === 'request_changes' && !d.legacy && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">Changes were requested. Read the comments, fix the ad, then click <b>Submit again</b>.</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Section title="Setup">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ad type">
                <select value={draft.adType} disabled={!editable} onChange={(e) => set({ adType: e.target.value })} className={inputClass}>
                  <option value="">Choose...</option>
                  {withCurrent(lookups.data?.adTypes, draft.adType).map((x) => <option key={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Booking type">
                <select value={draft.bookingType} disabled={!editable} onChange={(e) => set({ bookingType: e.target.value })} className={inputClass}>
                  <option value="">Choose...</option>
                  {withCurrent(lookups.data?.bookingTypes, draft.bookingType).map((x) => <option key={x}>{x}</option>)}
                </select>
              </Field>
            </div>
            {editable && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TemplatePicker label="Start from a creative template" templates={templates.data?.creative} brief={brief.data ?? null}
                  onUse={(body) => setCreative(toCreative({ ...draft.creative, ...body }))} />
                <TemplatePicker label="Start from a lead form template" templates={templates.data?.leadform} brief={brief.data ?? null}
                  onUse={(body) => setLeadform(toLeadForm({ ...draft.leadform, ...body }))} />
              </div>
            )}
            <Unfilled draft={draft} />
          </Section>

          <Section title="Creative">
            <div className="space-y-3">
              <Field label="Primary text">
                <textarea rows={7} value={draft.creative.primaryText} disabled={!editable} onChange={(e) => setCreative({ primaryText: e.target.value })} className={inputClass} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Headline"><input value={draft.creative.headline} disabled={!editable} onChange={(e) => setCreative({ headline: e.target.value })} className={inputClass} /></Field>
                <Field label="Call to action">
                  <select value={draft.creative.callToAction} disabled={!editable} onChange={(e) => setCreative({ callToAction: e.target.value })} className={inputClass}>
                    <option value="">Choose...</option>
                    {withCurrent(lookups.data?.ctaOptions, draft.creative.callToAction).map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Description"><input value={draft.creative.description} disabled={!editable} onChange={(e) => setCreative({ description: e.target.value })} className={inputClass} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tracking">
                  <div className="flex flex-wrap gap-3 py-1.5">
                    {withCurrent(TRACKING, ...draft.creative.tracking).map((t) => (
                      <label key={t} className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" disabled={!editable} checked={draft.creative.tracking.includes(t)}
                          onChange={(e) => setCreative({ tracking: e.target.checked ? [...draft.creative.tracking, t] : draft.creative.tracking.filter((x) => x !== t) })} />
                        {t}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="URL parameters"><input value={draft.creative.urlParameters} disabled={!editable} onChange={(e) => setCreative({ urlParameters: e.target.value })} className={inputClass} /></Field>
              </div>
            </div>
          </Section>

          <MediaSection d={d} editable={editable} onChanged={reload} onNotice={setNotice} />

          <Section title="Lead form">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Form name"><input value={draft.leadform.formName} disabled={!editable} onChange={(e) => setLeadform({ formName: e.target.value })} className={inputClass} /></Field>
                <Field label="Form type">
                  <select value={draft.leadform.formType} disabled={!editable} onChange={(e) => setLeadform({ formType: e.target.value })} className={inputClass}>
                    <option value="">Choose...</option>
                    {withCurrent(FORM_TYPES, draft.leadform.formType).map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Reusing an existing Meta lead form? Its name or ID" hint="Leave blank for a new form described below.">
                <input value={draft.metaLeadformId} disabled={!editable} onChange={(e) => set({ metaLeadformId: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Greeting headline"><input value={draft.leadform.greetingHeadline} disabled={!editable} onChange={(e) => setLeadform({ greetingHeadline: e.target.value })} className={inputClass} /></Field>
              <Field label="Greeting description"><textarea rows={3} value={draft.leadform.greetingDescription} disabled={!editable} onChange={(e) => setLeadform({ greetingDescription: e.target.value })} className={inputClass} /></Field>
              <Questions value={draft.leadform.questions} editable={editable} onChange={(questions) => setLeadform({ questions })} />
              <Field label="Privacy policy URL"><input value={draft.leadform.privacyPolicyUrl} disabled={!editable} onChange={(e) => setLeadform({ privacyPolicyUrl: e.target.value })} className={inputClass} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Thank-you headline"><input value={draft.leadform.thankYouHeadline} disabled={!editable} onChange={(e) => setLeadform({ thankYouHeadline: e.target.value })} className={inputClass} /></Field>
                <Field label="Thank-you button"><input value={draft.leadform.thankYouCallToAction} disabled={!editable} onChange={(e) => setLeadform({ thankYouCallToAction: e.target.value })} className={inputClass} /></Field>
              </div>
              <Field label="Thank-you description"><textarea rows={2} value={draft.leadform.thankYouDescription} disabled={!editable} onChange={(e) => setLeadform({ thankYouDescription: e.target.value })} className={inputClass} /></Field>
              <Field label="Thank-you link"><input value={draft.leadform.thankYouUrl} disabled={!editable} onChange={(e) => setLeadform({ thankYouUrl: e.target.value })} className={inputClass} /></Field>
            </div>
          </Section>

          <Section title="Notes for the reviewer">
            <textarea rows={3} value={draft.notes} disabled={!editable} onChange={(e) => set({ notes: e.target.value })} className={inputClass} placeholder="Anything the reviewer should know" />
          </Section>
        </div>

        <div className="min-w-0 space-y-4">
          {!d.legacy && <CheckPanel d={d} busy={busy === 'check'} onCheck={check} onFinding={(f, s) => run('finding', () => ds.approvals.setFinding(f.id, s))} />}
          <BriefPanel brief={brief.data ?? null} loading={brief.loading} />
          {(d.status !== 'draft' || d.legacy) && (
            <Section title="Reviewer checklist" right={<span className="text-xs text-muted">{d.checklist.filter((c) => c.checked).length} of {d.checklist.length}</span>}>
              <ul className="space-y-1.5">
                {d.checklist.map((c) => (
                  <li key={c.key}>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-0.5" checked={c.checked} disabled={d.legacy || d.status === 'completed' || !!busy}
                        onChange={(e) => run('tick', () => ds.approvals.tick(d.id, c.key, e.target.checked))} />
                      <span className="flex-1">
                        {c.label}
                        {c.aiResult && <span className={`ml-1.5 text-xs font-medium ${c.aiResult === 'pass' ? 'text-good' : c.aiResult === 'fail' ? 'text-bad' : 'text-muted'}`}>AI: {c.aiResult === 'pass' ? 'looks right' : c.aiResult === 'fail' ? 'check this' : 'not sure'}</span>}
                        {c.checkedByName && <span className="ml-1.5 text-xs text-muted">{c.checkedByName}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Comments d={d} onPost={(body) => run('comment', () => ds.approvals.comment(d.id, body))} busy={busy === 'comment'} />
          {d.events.length > 0 && (
            <Section title="History">
              <ol className="space-y-1.5 text-sm">
                {d.events.map((e) => (
                  <li key={e.id} className="text-soft">
                    <span className="font-medium text-ink">{e.actorName ?? 'Someone'}</span>: {verb(e.to)}
                    {e.acknowledged > 0 && <span className="text-amber-800"> (submitted with {e.acknowledged} possible issue{e.acknowledged === 1 ? '' : 's'} open)</span>}
                    <span className="text-xs text-muted"> · {ago(e.at)}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>
      </div>

      {move && (
        <MoveModal d={d} move={move} employees={employees.data ?? []} defaultReviewer={d.reviewerId ?? brief.data?.adsManagerId ?? null}
          meId={me?.id ?? null} onClose={() => setMove(null)} onCheck={() => { setMove(null); void check() }}
          onDone={(text) => { setMove(null); setNotice({ ok: true, text }); reload() }} />
      )}
    </div>
  )
}

const verb = (to: ReviewStatus) => ({
  draft: 'moved back to draft', review_pending: 'submitted for review', request_changes: 'requested changes',
  approved: 'approved', completed: 'marked as live',
}[to])

const withCurrent = (list: string[] | undefined, ...current: string[]) =>
  [...new Set([...(list ?? []), ...current.filter(Boolean)])]

function Unfilled({ draft }: { draft: Draft }) {
  const text = JSON.stringify([draft.creative, draft.leadform])
  const left = unfilledPlaceholders(text)
  if (!left.length) return null
  return (
    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
      Still to fill in: {left.map((k) => `{{ ${k} }}`).join(', ')}. The client's info didn't have these.
    </p>
  )
}

function TemplatePicker({ label, templates, brief, onUse }: {
  label: string; templates: Template[] | undefined; brief: ClientBrief | null; onUse: (body: Record<string, unknown>) => void
}) {
  const [pick, setPick] = useState('')
  const use = () => {
    const t = templates?.find((x) => x.id === pick)
    if (!t) return
    onUse(fillTemplate(t.body, placeholderValues(brief?.placeholders ?? {})))
    setPick('')
  }
  return (
    <Field label={label} hint="Fills the fields below; anything you typed in those fields is replaced.">
      <div className="flex gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className={inputClass}>
          <option value="">{templates ? `Choose (${templates.length})` : 'Loading...'}</option>
          {templates?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Button onClick={use} disabled={!pick}>Use</Button>
      </div>
    </Field>
  )
}

function Questions({ value, editable, onChange }: { value: string[]; editable: boolean; onChange: (q: string[]) => void }) {
  return (
    <Field label="Questions">
      <div className="space-y-1.5">
        {value.map((q, i) => (
          <div key={i} className="flex gap-1.5">
            <span className="w-5 pt-2 text-right text-xs text-muted">{i + 1}</span>
            <input value={q} disabled={!editable} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} className={inputClass} />
            {editable && <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-md px-1.5 text-muted hover:bg-subtle" aria-label="Remove question"><Trash2 size={14} /></button>}
          </div>
        ))}
        {editable && <Button kind="quiet" onClick={() => onChange([...value, ''])}><Plus size={14} /> Add question</Button>}
        {!editable && value.length === 0 && <p className="text-sm text-muted">None</p>}
      </div>
    </Field>
  )
}

function MediaSection({ d, editable, onChanged, onNotice }: {
  d: ReviewDetail; editable: boolean; onChanged: () => void; onNotice: (n: { ok: boolean; text: string }) => void
}) {
  const ds = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [canva, setCanva] = useState('')

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    const list = [...files]
    const warnings: string[] = []
    try {
      for (const [i, f] of list.entries()) {
        setProgress(`${f.type.startsWith('video/') ? 'Reading video frames' : 'Preparing'} ${i + 1} of ${list.length}: ${f.name}`)
        const media = await prepareMedia(f)
        if (media.warning) warnings.push(`${f.name}: ${media.warning}`)
        setProgress(`Uploading ${i + 1} of ${list.length}: ${f.name}`)
        await ds.approvals.addFile(d.id, f, media)
      }
      onNotice({ ok: warnings.length === 0, text: warnings.length ? warnings.join(' ') : `Added ${list.length} file${list.length === 1 ? '' : 's'}. Run "Check for mistakes" to read the text in them.` })
    } catch (e) {
      onNotice({ ok: false, text: `Upload failed: ${(e as Error).message}` })
    } finally {
      setProgress(null)
      if (fileRef.current) fileRef.current.value = ''
      onChanged()
    }
  }

  const remove = async (a: ReviewAsset) => {
    if (!window.confirm(`Remove ${a.fileName ?? 'this link'}?`)) return
    try {
      await ds.approvals.removeAsset(a)
    } catch (e) {
      onNotice({ ok: false, text: (e as Error).message })
    }
    onChanged()
  }

  const addCanva = async () => {
    if (!/^https?:\/\//.test(canva.trim())) return onNotice({ ok: false, text: 'Paste the full Canva link, starting with https://' })
    try {
      await ds.approvals.addCanvaLink(d.id, canva)
      setCanva('')
    } catch (e) {
      onNotice({ ok: false, text: (e as Error).message })
    }
    onChanged()
  }

  return (
    <Section title="Images and videos" right={editable && (
      <>
        <input ref={fileRef} type="file" multiple accept={ACCEPTED_FILES} className="hidden" onChange={(e) => upload(e.target.files)} />
        <Button onClick={() => fileRef.current?.click()} disabled={!!progress}><Upload size={14} /> Add files</Button>
      </>
    )}>
      {progress && <p className="mb-2 text-sm text-muted">{progress}</p>}
      {d.assets.length === 0 && !progress && <p className="text-sm text-muted">{editable ? 'No files yet. Images and videos are private to MRKD staff.' : 'No files.'}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {d.assets.map((a, i) => (
          <div key={a.id} className="overflow-hidden rounded-lg border border-line">
            {a.canvaUrl ? (
              <a href={a.canvaUrl} target="_blank" rel="noreferrer" className="flex h-32 items-center justify-center gap-1.5 bg-subtle text-sm font-medium text-brand">
                <Link2 size={16} /> Canva design
              </a>
            ) : a.kind === 'video' ? (
              <div className="bg-black">
                {a.url ? <video src={a.url} controls preload="metadata" className="max-h-72 w-full" /> : <div className="h-32" />}
                {a.frames.length > 1 && (
                  <div className="flex gap-0.5 overflow-x-auto bg-black p-0.5">
                    {a.frames.map((f) => f.url && <img key={f.path} src={f.url} alt={`Frame at ${clock(f.t)}`} title={clock(f.t)} className="h-12 w-auto" />)}
                  </div>
                )}
              </div>
            ) : (
              <a href={a.url ?? undefined} target="_blank" rel="noreferrer">
                {a.frames[0]?.url || a.url ? <img src={a.frames[0]?.url ?? a.url ?? ''} alt={a.fileName ?? ''} className="max-h-72 w-full bg-subtle object-contain" /> : <div className="h-32 bg-subtle" />}
              </a>
            )}
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
              <span className="font-semibold text-muted">{a.kind === 'video' ? <Film size={12} className="inline" /> : null} {a.kind === 'video' ? 'Video' : 'Image'} {i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{a.canvaUrl ?? a.fileName}{a.durationSec ? ` · ${clock(a.durationSec)}` : ''}</span>
              {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" title="Open original"><ExternalLink size={13} /></a>}
              {editable && <button onClick={() => remove(a)} className="text-muted hover:text-bad" aria-label="Remove"><Trash2 size={13} /></button>}
            </div>
            {!a.canvaUrl && a.frames.length === 0 && <p className="px-2.5 pb-2 text-xs text-amber-800">No preview, so the AI check skips this file.</p>}
          </div>
        ))}
      </div>
      {editable && (
        <div className="mt-3 flex gap-2">
          <input value={canva} onChange={(e) => setCanva(e.target.value)} placeholder="Or paste a Canva link" className={inputClass} />
          <Button onClick={addCanva} disabled={!canva.trim()}>Add link</Button>
        </div>
      )}
    </Section>
  )
}

function CheckPanel({ d, busy, onCheck, onFinding }: {
  d: ReviewDetail; busy: boolean; onCheck: () => void; onFinding: (f: ReviewFinding, s: ReviewFinding['status']) => void
}) {
  const open = d.findings.filter((f) => f.status === 'open')
  const done = d.findings.filter((f) => f.status !== 'open')
  const assetNo = (id: string | null) => (id ? d.assets.findIndex((a) => a.id === id) + 1 : 0)
  const canAct = !d.legacy && d.status !== 'completed'
  return (
    <Section title="Mistake check" right={canAct && (
      <Button kind="primary" onClick={onCheck} disabled={busy}><Sparkles size={14} /> {busy ? 'Checking...' : d.lastCheck ? 'Check again' : 'Check for mistakes'}</Button>
    )}>
      <p className="mb-2 text-xs text-muted">
        Reads the copy, lead form, text in images and subtitles in videos (no audio) for spelling, grammar, things that don't make sense, and details that don't match the client.
        {d.lastCheck && ` Last checked ${ago(d.lastCheck.at)}.`}
      </p>
      {d.lastCheck?.status === 'error' && <p className="mb-2 text-sm text-bad">Last check failed: {d.lastCheck.error}</p>}
      {d.lastCheck && open.length === 0 && d.lastCheck.status === 'ok' && <p className="flex items-center gap-1.5 text-sm text-good"><Check size={14} /> Nothing left to fix.</p>}
      <ul className="space-y-2">
        {open.map((f) => <FindingItem key={f.id} f={f} assetNo={assetNo(f.assetId)} canAct={canAct} onSet={(s) => onFinding(f, s)} />)}
      </ul>
      {done.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted">{done.length} marked fixed or ignored</summary>
          <ul className="mt-2 space-y-2 opacity-70">
            {done.map((f) => <FindingItem key={f.id} f={f} assetNo={assetNo(f.assetId)} canAct={canAct} onSet={(s) => onFinding(f, s)} />)}
          </ul>
        </details>
      )}
      {d.submittedWithOpenFindings > 0 && d.status !== 'draft' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-800"><AlertTriangle size={13} /> Submitted with {d.submittedWithOpenFindings} possible issue{d.submittedWithOpenFindings === 1 ? '' : 's'} still open.</p>
      )}
    </Section>
  )
}

function FindingItem({ f, assetNo, canAct, onSet }: { f: ReviewFinding; assetNo: number; canAct: boolean; onSet: (s: ReviewFinding['status']) => void }) {
  const where = f.assetId || f.field === 'asset' ? (f.location ?? (assetNo ? `File ${assetNo}` : 'Image or video')) : fieldLabel(f.field)
  return (
    <li className="rounded-lg border border-line p-2.5 text-sm">
      <div className="mb-0.5 flex items-center gap-1.5 text-xs">
        <span className={`font-semibold ${f.severity === 'error' ? 'text-bad' : 'text-amber-800'}`}>{CATEGORY_LABEL[f.category]}</span>
        <span className="text-muted">· {where}</span>
        {f.status !== 'open' && <span className="ml-auto text-muted">{f.status === 'fixed' ? 'Fixed' : 'Ignored'}</span>}
      </div>
      {f.excerpt && <p className="text-soft">"{f.excerpt}"</p>}
      <p>{f.message}</p>
      {f.suggestion && <p className="text-soft">Try: <span className="font-medium text-ink">{f.suggestion}</span></p>}
      {canAct && (
        <div className="mt-1.5 flex gap-1.5">
          {f.status === 'open' ? (
            <>
              <Button onClick={() => onSet('fixed')}>Fixed</Button>
              <Button kind="quiet" onClick={() => onSet('ignored')}>Ignore</Button>
            </>
          ) : (
            <Button kind="quiet" onClick={() => onSet('open')}>Undo</Button>
          )}
        </div>
      )}
    </li>
  )
}

function BriefPanel({ brief, loading }: { brief: ClientBrief | null; loading: boolean }) {
  if (!brief) return loading ? null : <Section title="Client info"><p className="text-sm text-muted">No client info.</p></Section>
  const rows: [string, string][] = [
    ...(['business_name', 'address', 'city', 'phone', 'website', 'offer', 'call_to_action', 'booking_link'] as const)
      .filter((k) => brief.placeholders[k])
      .map((k): [string, string] => [k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), brief.placeholders[k]]),
  ]
  const more: [string, unknown][] = [...Object.entries(brief.onboarding ?? {}), ...Object.entries(brief.campaign ?? {})]
  return (
    <Section title="Client info" right={brief.adsManager && <span className="text-xs text-muted">Ads manager: {brief.adsManager}</span>}>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v]) => <Row key={k} k={k} v={v} />)}
      </dl>
      {(more.length > 0 || brief.facts.length > 0) && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-muted">More from onboarding and GHL</summary>
          <dl className="mt-2 space-y-1 text-sm">
            {more.map(([k, v]) => <Row key={k} k={k} v={String(v)} />)}
            {brief.facts.map((f) => <Row key={f.label} k={f.label} v={f.value} />)}
          </dl>
        </details>
      )}
    </Section>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  const shown = /^\d{13}$/.test(v) ? new Date(Number(v)).toLocaleDateString() : v
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="break-words">{/^https?:\/\//.test(shown) ? <a href={shown} target="_blank" rel="noreferrer" className="text-brand">{shown.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}</a> : shown}</dd>
    </div>
  )
}

function Comments({ d, onPost, busy }: { d: ReviewDetail; onPost: (body: string) => Promise<boolean>; busy: boolean }) {
  const [text, setText] = useState('')
  const legacyComments = d.legacyInfo?.comments ?? []
  return (
    <Section title="Comments">
      <ul className="space-y-2 text-sm">
        {legacyComments.map((c, i) => (
          <li key={`l${i}`}><span className="font-medium">{c.by ?? 'Retool'}</span> <span className="text-xs text-muted">{c.at ? ago(c.at.replace(' ', 'T')) : ''}</span><p className="whitespace-pre-wrap text-soft">{c.text}</p></li>
        ))}
        {d.comments.map((c) => (
          <li key={c.id}><span className="font-medium">{c.authorName ?? 'Someone'}</span> <span className="text-xs text-muted">{ago(c.at)}</span><p className="whitespace-pre-wrap text-soft">{c.body}</p></li>
        ))}
        {legacyComments.length + d.comments.length === 0 && <li className="text-muted">No comments yet.</li>}
      </ul>
      {!d.legacy && (
        <div className="mt-3 space-y-2">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment" className={inputClass} />
          <div className="flex justify-end">
            <Button onClick={async () => { if (await onPost(text)) setText('') }} disabled={!text.trim() || busy}>{busy ? 'Posting...' : 'Post'}</Button>
          </div>
        </div>
      )}
    </Section>
  )
}

function LegacyBanner({ d }: { d: ReviewDetail }) {
  const info = d.legacyInfo
  return (
    <Card className="mb-3 border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <p><b>From Retool's Ad Preview.</b> Read-only history, copied every 15 minutes while Retool is still in use.</p>
      {info && info.imageCount > 0 && (
        <p className="mt-1">This ad had {info.imageCount} image{info.imageCount === 1 ? '' : 's'} in Retool. Images weren't copied; open the ad in Retool to see them.</p>
      )}
      {info && info.imageLinks.length > 0 && (
        <p className="mt-1">Links: {info.imageLinks.map((l, i) => <a key={l} href={l} target="_blank" rel="noreferrer" className="mr-2 font-medium underline">Design {i + 1}</a>)}</p>
      )}
      {info?.aiResponse && (
        <details className="mt-1">
          <summary className="cursor-pointer font-medium">Retool's AI notes</summary>
          <p className="mt-1 whitespace-pre-wrap text-xs">{htmlToText(info.aiResponse)}</p>
        </details>
      )}
    </Card>
  )
}

/** Confirm a status move. Submitting with open findings shows "Hey, just double checking". */
function MoveModal({ d, move, employees, defaultReviewer, meId, onClose, onDone, onCheck }: {
  d: ReviewDetail; move: StatusMove; employees: { id: string; firstName: string; lastName: string; isAdManager: boolean }[]
  defaultReviewer: string | null; meId: string | null; onClose: () => void; onDone: (text: string) => void; onCheck: () => void
}) {
  const ds = useData()
  const [note, setNote] = useState('')
  const [reviewer, setReviewer] = useState(defaultReviewer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = d.findings.filter((f) => f.status === 'open')
  const submitting = move.to === 'review_pending'
  const unticked = d.checklist.filter((c) => !c.checked).length
  const needsNote = move.to === 'request_changes'
  const reviewers = useMemo(() => [...employees].sort((a, b) => Number(b.isAdManager) - Number(a.isAdManager) || a.firstName.localeCompare(b.firstName)), [employees])

  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      await ds.approvals.move(d.id, move.to, {
        note: note.trim() || undefined, reviewerId: submitting ? reviewer || null : undefined,
        acknowledged: submitting ? open.map((f) => f.id) : undefined,
      })
      onDone({
        review_pending: 'Submitted. The reviewer will see it at the top of their Approvals list.',
        request_changes: 'Sent back with your comment.',
        approved: 'Approved. Build it in Meta, then click Mark as live.',
        completed: 'Marked as live.',
        draft: 'Moved back to draft.',
      }[move.to])
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const title = submitting && open.length ? 'Hey, just double checking' : move.label
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-3 text-sm">
        {submitting && open.length > 0 && (
          <>
            <p>We spotted {open.length} possible issue{open.length === 1 ? '' : 's'}:</p>
            <ul className="max-h-60 space-y-1.5 overflow-auto rounded-lg bg-amber-50 p-2.5 text-amber-950">
              {open.slice(0, 12).map((f) => (
                <li key={f.id}>
                  <span className="font-semibold">{f.assetId || f.field === 'asset' ? f.location ?? 'Image or video' : fieldLabel(f.field)}:</span> {f.message}
                  {f.suggestion && <span className="text-amber-800"> Try: {f.suggestion}</span>}
                </li>
              ))}
              {open.length > 12 && <li>...and {open.length - 12} more.</li>}
            </ul>
            <p className="text-muted">You can still submit. It will be noted that these were open.</p>
          </>
        )}
        {submitting && open.length === 0 && !d.lastCheck && (
          <p className="rounded-lg bg-subtle px-3 py-2">The mistake check hasn't been run on this ad yet. <button className="font-semibold text-brand" onClick={onCheck}>Run it first</button></p>
        )}
        {submitting && (
          <Field label="Reviewer">
            <select value={reviewer} onChange={(e) => setReviewer(e.target.value)} className={inputClass}>
              <option value="">Client's ads manager</option>
              {reviewers.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.id === meId ? ' (you)' : ''}{e.id === defaultReviewer ? " (client's ads manager)" : ''}</option>)}
            </select>
          </Field>
        )}
        {move.to === 'approved' && unticked > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-950">{unticked} checklist item{unticked === 1 ? ' is' : 's are'} not ticked. Approve anyway only if they don't apply.</p>
        )}
        <Field label={needsNote ? 'What needs to change?' : 'Comment (optional)'}>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} autoFocus={needsNote} />
        </Field>
        {error && <p className="text-bad">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button kind="quiet" onClick={onClose}>{submitting && open.length ? 'Go back and fix' : 'Cancel'}</Button>
          <Button kind="primary" onClick={go} disabled={busy || (needsNote && !note.trim())}>
            {busy ? 'Saving...' : submitting && open.length ? 'Submit anyway' : move.label}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
