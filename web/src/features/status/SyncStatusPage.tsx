/** Sync health: when each background job last ran and whether it worked. */
import { useData } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { Card, Empty, PageTitle } from '../../components/ui'
import { count, dateTime } from '../../lib/format'

const STYLE = { ok: 'bg-emerald-100 text-emerald-800', partial: 'bg-amber-100 text-amber-800', error: 'bg-red-100 text-red-800', running: 'bg-sky-100 text-sky-800' }
const NAMES: Record<string, string> = { 'meta.sync': 'Meta ads sync', 'rules.run': 'Suggestions', retool_bridge: 'Retool bridge' }

export function SyncStatusPage() {
  const ds = useData()
  const { data, loading } = useAsync(() => ds.syncRuns(), [ds])
  return (
    <div>
      <PageTitle title="Sync status" subtitle="Background jobs: Meta every 30 min, Retool bridge every 15 min" />
      <Card>
        {!data?.length ? <Empty>{loading ? 'Loading…' : 'No runs yet.'}</Empty> : (
          <ul className="divide-y divide-line">
            {data.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <div className="font-medium">{NAMES[r.job] ?? r.job}</div>
                  <div className="text-xs text-muted">{dateTime(r.startedAt)} · {count(r.rows)} rows{r.error ? ` · ${r.error}` : ''}</div>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${STYLE[r.status]}`}>{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
