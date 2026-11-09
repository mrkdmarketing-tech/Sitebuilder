/** Lead form & ad copy search (Phase 1a). Replaces Retool's "Search Meta Lead Forms". */
import { useState } from 'react'
import { Search } from 'lucide-react'
import { useData } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { Card, Empty, PageTitle } from '../../components/ui'

export function SearchPage() {
  const ds = useData()
  const [mode, setMode] = useState<'forms' | 'copy'>('forms')
  const [query, setQuery] = useState('')
  const forms = useAsync(() => (mode === 'forms' ? ds.searchLeadForms(query) : Promise.resolve([])), [ds, mode, query])
  const copy = useAsync(() => (mode === 'copy' ? ds.searchAdCopy(query) : Promise.resolve([])), [ds, mode, query])

  return (
    <div>
      <PageTitle title="Search" subtitle="Find any lead form or ad copy across every client" />
      <div className="mb-3 flex flex-wrap gap-2">
        {(['forms', 'copy'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === m ? 'bg-primary text-on-primary' : 'border border-line bg-surface'}`}>
            {m === 'forms' ? 'Lead forms' : 'Ad copy'}
          </button>
        ))}
        <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 sm:max-w-md">
          <Search size={16} className="text-muted" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mode === 'forms' ? 'Form name, page or question…' : 'Headline, body or ad name…'} className="w-full bg-transparent text-sm outline-none" />
        </label>
      </div>
      <Card>
        {mode === 'forms' &&
          (forms.data?.length ? (
            <ul className="divide-y divide-line">
              {forms.data.map((f) => (
                <li key={f.id} className="p-3 text-sm">
                  <div className="font-semibold">{f.name}</div>
                  <div className="text-xs text-muted">Page {f.pageId} · {f.questions.join(' · ')}</div>
                  {f.contextCardTitle && <div className="mt-1 text-xs">Intro: “{f.contextCardTitle}”</div>}
                  {f.thankYouTitle && <div className="text-xs">Thank you: “{f.thankYouTitle}”</div>}
                </li>
              ))}
            </ul>
          ) : <Empty>{forms.loading ? 'Searching…' : 'No lead forms match.'}</Empty>)}
        {mode === 'copy' &&
          (copy.data?.length ? (
            <ul className="divide-y divide-line">
              {copy.data.map((c) => (
                <li key={c.id} className="flex gap-3 p-3 text-sm">
                  {c.imageUrl && <img src={c.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />}
                  <div className="min-w-0">
                    <div className="font-semibold">{c.title ?? c.name}</div>
                    <div className="line-clamp-2 text-xs text-soft">{c.body}</div>
                    <div className="text-[11px] text-muted">{c.name}{c.callToAction ? ` · ${c.callToAction.replace(/_/g, ' ')}` : ''}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty>{copy.loading ? 'Searching…' : 'No ad copy matches.'}</Empty>)}
      </Card>
    </div>
  )
}
