/**
 * Ad Studio (docs/ad-studio.md): make ads in an approved MRKD style from a form,
 * inside ad approval. The style kit's own Python renders them in the browser
 * (lib/pyRender), so the look is exactly the approved one. Chosen ads are added
 * to the ad like uploaded files, then go through the usual checks and review.
 *
 * Pilot style: EC Echo. Rules from its BUILD.md live in shared/domain/styleKit.ts.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { quickChecks, checkClient } from '@shared/domain/adChecks.ts'
import {
  ECHO_FIELDS, ECHO_PALETTES, ECHO_STARTERS, buildEchoConfig, checkEcho, echoCheckTexts, echoPeopleFor, echoTextFrom, isGracieBarra,
  type EchoAd, type EchoConfig, type EchoText, type GymType,
} from '@shared/domain/styleKit.ts'
import { useData } from '../../data/source'
import type { ClientBrief } from '../../data/approvals'
import type { KitFile } from '../../data/styleKit'
import { prepareMedia } from '../../lib/media'
import { render, warmUp } from '../../lib/pyRender'

const STYLE = 'EC'
const field = 'w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm uppercase'
const personName = (p: string) => p.replace(/^(gb|generic)-/, '').replace(/-white-gi$/, '').replace(/-/g, ' ')

export function AdStudio({ reviewId, clientName, brief, onClose, onAdded }: {
  reviewId: string; clientName: string; brief: ClientBrief | null; onClose: () => void; onAdded: (n: number) => void
}) {
  const ds = useData()
  const [kit, setKit] = useState<KitFile[] | null>(null)
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map())
  const [examples, setExamples] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [gym, setGym] = useState<GymType>(isGracieBarra(clientName) ? 'gracie-barra' : 'generic')
  const [starter, setStarter] = useState(ECHO_STARTERS[0].file)
  const [text, setText] = useState<EchoText | null>(null)
  const [ads, setAds] = useState<EchoAd[]>([])
  const [bf, setBf] = useState(false)
  // Lines still as copied from the example config (another gym's offer): flagged until changed or confirmed.
  const [fromExample, setFromExample] = useState<Set<string>>(new Set())
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<{ name: string; url: string; data: Uint8Array; keep: boolean }[]>([])

  const city = brief?.placeholders.city ?? null
  const people = useMemo(() => (kit ?? []).filter((f) => f.kind === 'person').map((f) => f.path.split('/').pop()!.replace('-cutout.png', '')), [kit])
  const allowed = useMemo(() => echoPeopleFor(people, gym), [people, gym])

  // Load the style's file list, previews and examples; start the engine in the background.
  useEffect(() => {
    let gone = false
    void warmUp().catch(() => undefined)
    ;(async () => {
      try {
        const list = await ds.styleKit.list(STYLE)
        if (gone) return
        setKit(list)
        const small = await ds.styleKit.get(list.filter((f) => f.kind === 'thumb' || f.kind === 'example'))
        if (gone) return
        const url = (b: Uint8Array) => URL.createObjectURL(new Blob([b as BlobPart], { type: 'image/jpeg' }))
        setThumbs(new Map(list.filter((f) => f.kind === 'thumb').map((f) => [f.path.split('/').pop()!.replace('.jpg', ''), url(small.get(f.path)!)])))
        setExamples(list.filter((f) => f.kind === 'example').map((f) => url(small.get(f.path)!)))
      } catch (e) {
        setLoadError((e as Error).message)
      }
    })()
    return () => { gone = true }
  }, [ds])

  // Starting point: the shipped config's copy, with this client's name and place.
  useEffect(() => {
    if (!kit) return
    const file = kit.find((f) => f.path === `${STYLE}/code/configs/${starter}`)
    if (!file) return
    void ds.styleKit.get([file]).then((m) => {
      const cfg = JSON.parse(new TextDecoder().decode(m.get(file.path))) as Partial<EchoConfig>
      setText(echoTextFrom(cfg, { name: clientName, city }))
      setBf(false)
      setConfirmed(false)
      setFromExample(new Set(['kicker', 'echo1', 'echo2', 'details1', 'details2', 'small1', 'small2', 'button']))
      setAds((cfg.ads ?? []).slice(0, 3).map((a) => {
        // Swap GB / generic versions of the same person to match this gym.
        const base = a.person.replace(/^(gb|generic)-/, '')
        const person = allowed.find((p) => p.endsWith(base)) ?? allowed[0] ?? a.person
        return { person, palette: a.palette, treat: a.treat, flip: !!a.flip }
      }))
      setResults([])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit, starter])

  // Keep picked people valid when GB / generic changes.
  useEffect(() => {
    setAds((list) => list.map((a) => (allowed.includes(a.person) ? a : { ...a, person: allowed.find((p) => p.endsWith(a.person.replace(/^(gb|generic)-/, ''))) ?? allowed[0] ?? a.person })))
  }, [allowed])

  const problems = text ? checkEcho(text, gym, ads, { blackFridayOffer: bf }) : []
  const spelling = useMemo(() => (text ? quickChecks({ texts: echoCheckTexts(text), client: checkClient(brief) }) : []), [text, brief])
  const blocked = problems.some((p) => p.severity === 'error') || !confirmed
  const mentionsBf = text ? /black\s*friday/i.test(Object.values(text).join(' ')) : false

  const make = async () => {
    if (!text || !kit) return
    setBusy('Loading the design engine (first time takes a little while)...')
    setError(null)
    setResults([])
    try {
      await warmUp()
      setBusy('Getting the style and photos...')
      const cfg = buildEchoConfig(text, gym, ads)
      const need = kit.filter((f) => f.kind === 'code' || f.kind === 'font'
        || (f.kind === 'person' && ads.some((a) => f.path.endsWith(`/${a.person}-cutout.png`))))
      const bytes = await ds.styleKit.get(need)
      const files: Record<string, Uint8Array> = {}
      for (const [p, b] of bytes) files[p.replace(`${STYLE}/`, '')] = b
      files['code/configs/studio.json'] = new TextEncoder().encode(JSON.stringify(cfg))
      setBusy(`Making ${ads.length} ad${ads.length === 1 ? '' : 's'}...`)
      const images = await render({ files, cwd: 'code', script: 'ec_ad.py', args: ['configs/studio.json', '{out}'], outDir: 'out' })
      setResults(images.map((im) => ({ ...im, url: URL.createObjectURL(new Blob([im.data as BlobPart], { type: 'image/png' })), keep: true })))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const add = async () => {
    const chosen = results.filter((r) => r.keep)
    setBusy(`Adding ${chosen.length} to the ad...`)
    setError(null)
    try {
      for (const r of chosen) {
        const file = new File([r.data as BlobPart], r.name.replace('.png', '.png'), { type: 'image/png' })
        await ds.approvals.addFile(reviewId, file, await prepareMedia(file))
      }
      onAdded(chosen.length)
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  const setAd = (i: number, patch: Partial<EchoAd>) => { setAds((l) => l.map((a, j) => (j === i ? { ...a, ...patch } : a))); setResults([]) }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label="Create with a style" onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full flex-col overflow-hidden bg-surface shadow-xl sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <h2 className="font-semibold">Create with a style</h2>
            <p className="text-xs text-muted">{clientName} · approved MRKD styles, rendered exactly as the kit makes them</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-subtle"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadError && <p className="text-sm text-bad">Couldn't load the style kit: {loadError}</p>}
          {kit && kit.length === 0 && <p className="text-sm text-muted">The style kit isn't available here (sample data). Ad Studio works on the live site.</p>}
          {!kit && !loadError && <p className="py-8 text-center text-sm text-muted">Loading styles...</p>}

          {kit && kit.length > 0 && text && (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-sm font-semibold">Style</h3>
                <div className="rounded-xl border-2 border-brand p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">Echo <span className="text-xs font-normal text-muted">EC · adults, split layout · 1:1</span></span>
                    <span className="text-xs text-muted">More styles from the kit are added one by one.</span>
                  </div>
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {examples.map((u) => <img key={u} src={u} alt="Echo example" className="h-24 w-24 shrink-0 rounded-md object-cover" />)}
                  </div>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-soft">Gym</span>
                  <select value={gym} onChange={(e) => setGym(e.target.value as GymType)} className={field.replace(' uppercase', '')}>
                    <option value="generic">Generic gym (plain gis)</option>
                    <option value="gracie-barra">Gracie Barra (GB patches)</option>
                  </select>
                  <span className="mt-1 block text-xs text-muted">GB people wear Gracie Barra patches: only for Gracie Barra locations.</span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-soft">Start from</span>
                  <select value={starter} onChange={(e) => setStarter(e.target.value)} className={field.replace(' uppercase', '')}>
                    {ECHO_STARTERS.map((s) => <option key={s.file} value={s.file}>{s.label}</option>)}
                  </select>
                  <span className="mt-1 block text-xs text-muted">Then change every line to match this client's real offer.</span>
                </label>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Words on the ad</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ECHO_FIELDS.map((f) => {
                    const hints = [...problems.filter((p) => p.field === f.key), ...spelling.filter((s) => s.field === `studio.${f.key}`).map((s) => ({ severity: s.severity, message: s.message }))]
                    return (
                      <label key={f.key} className="block">
                        <span className="mb-1 block text-xs font-semibold text-soft">{f.label}</span>
                        <input value={text[f.key]} spellCheck className={field}
                          onChange={(e) => { setText({ ...text, [f.key]: e.target.value }); setResults([]); setFromExample((s) => { const n = new Set(s); n.delete(f.key); return n }) }} />
                        {fromExample.has(f.key) && text[f.key].trim() && hints.length === 0
                          ? <span className="mt-1 block text-xs text-warn">From the example: change it, or confirm below that it's right for this client.</span>
                          : hints.length > 0
                          ? hints.map((h, i) => <span key={i} className={`mt-1 block text-xs ${h.severity === 'error' ? 'text-bad' : 'text-warn'}`}>{h.message}</span>)
                          : f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
                      </label>
                    )
                  })}
                </div>
                <label className="mt-3 flex items-start gap-2 rounded-lg bg-subtle px-3 py-2 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  <span>I've checked every line matches this client's real offer: programs, prices, dates and what's included. <span className="text-muted">(The kit's rule: never invent offers, ages, dates or prices.)</span></span>
                </label>
                {(mentionsBf || starter.includes('black-friday')) && (
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={bf} onChange={(e) => setBf(e.target.checked)} />
                    This client really runs a Black Friday offer
                  </label>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Ads ({ads.length})</h3>
                  {ads.length < 6 && (
                    <button type="button" onClick={() => setAds([...ads, { person: allowed[0], palette: 'cream', treat: 'color', flip: false }])}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><Plus size={14} /> Add another</button>
                  )}
                </div>
                <div className="space-y-3">
                  {ads.map((a, i) => (
                    <div key={i} className="rounded-xl border border-line p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-soft">Ad {i + 1}: {personName(a.person)}</span>
                        <button type="button" onClick={() => setAds(ads.filter((_, j) => j !== i))} className="text-muted hover:text-bad" aria-label="Remove"><Trash2 size={14} /></button>
                      </div>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {allowed.map((p) => (
                          <button key={p} type="button" onClick={() => setAd(i, { person: p })} title={personName(p)}
                            className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-md border-2 ${a.person === p ? 'border-brand' : 'border-transparent'}`}>
                            {thumbs.get(p) ? <img src={thumbs.get(p)} alt={personName(p)} className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-subtle" />}
                            {a.person === p && <span className="absolute right-0.5 top-0.5 rounded-full bg-brand p-0.5 text-white"><Check size={10} /></span>}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <select aria-label="Colours" value={a.palette} onChange={(e) => setAd(i, { palette: e.target.value as EchoAd['palette'] })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
                          {ECHO_PALETTES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                        </select>
                        <select aria-label="Photo" value={a.treat} onChange={(e) => setAd(i, { treat: e.target.value as EchoAd['treat'] })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
                          <option value="color">Colour photo</option>
                          <option value="mono">Black and white</option>
                        </select>
                        <select aria-label="Layout" value={a.flip ? 'left' : 'right'} onChange={(e) => setAd(i, { flip: e.target.value === 'left' })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
                          <option value="right">Person right</option>
                          <option value="left">Person left</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {problems.filter((p) => !p.field).map((p, i) => (
                <p key={i} className={`flex items-start gap-1.5 text-sm ${p.severity === 'error' ? 'text-bad' : 'text-warn'}`}><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {p.message}</p>
              ))}

              {results.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Made ({results.filter((r) => r.keep).length} of {results.length} picked)</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {results.map((r, i) => (
                      <button key={r.name} type="button" onClick={() => setResults(results.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))}
                        className={`relative overflow-hidden rounded-lg border-2 ${r.keep ? 'border-brand' : 'border-line opacity-50'}`}>
                        <img src={r.url} alt={r.name} className="w-full" />
                        {r.keep && <span className="absolute right-1.5 top-1.5 rounded-full bg-brand p-1 text-white"><Check size={12} /></span>}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">Check each at full size before adding: faces clear of the words, spelling, dates and prices right.</p>
                </section>
              )}
              {error && <p className="text-sm text-bad">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
          {busy && <span className="mr-auto flex items-center gap-1.5 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> {busy}</span>}
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-muted">Cancel</button>
          <button onClick={make} disabled={!text || blocked || !!busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
            <Sparkles size={14} /> {results.length ? 'Make again' : 'Make ads'}
          </button>
          {results.length > 0 && (
            <button onClick={add} disabled={!!busy || !results.some((r) => r.keep)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-40">
              Add {results.filter((r) => r.keep).length} to this ad
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
