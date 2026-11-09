import type { Creative, ReportRow } from '@shared/domain/types.ts'
import { useData } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { Modal } from '../../components/ui'
import { count, money, percent } from '../../lib/format'
import { metricsOf } from './columns'

/** Creative popup (the 🌄 column in Retool): image, copy, and how the ad is doing. */
export function CreativeModal({ row, onClose }: { row: ReportRow | null; onClose: () => void }) {
  const ds = useData()
  const { data: creative } = useAsync<Creative | null>(
    () => (row?.creativeId ? ds.creative(row.creativeId) : Promise.resolve(null)),
    [row?.creativeId],
  )
  if (!row) return null
  const m = metricsOf(row)
  return (
    <Modal open onClose={onClose} title={row.name}>
      {creative?.imageUrl && <img src={creative.imageUrl} alt="" className="mb-3 w-full rounded-lg" />}
      {creative?.videoId && <p className="mb-2 text-xs text-muted">Video ID: {creative.videoId}</p>}
      {creative?.title && <p className="font-semibold">{creative.title}</p>}
      {creative?.body && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{creative.body}</p>}
      {creative?.callToAction && (
        <span className="mt-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">{creative.callToAction.replace(/_/g, ' ')}</span>
      )}
      <div className="tabular mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        {[
          ['Spend', money(row.spend)], ['Leads', count(row.leads)], ['CPL', money(m.cpl, { cents: true })],
          ['CTR', percent(m.ctr)], ['Link CTR', percent(m.linkCtr)], ['CR', percent(m.cr)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-gray-50 py-1.5">
            <div className="text-[10px] font-medium uppercase text-muted">{l}</div>
            <div className="font-semibold">{v}</div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
