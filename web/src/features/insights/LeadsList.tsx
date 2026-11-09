import type { MetaLead } from '@shared/domain/types.ts'
import { dateTime } from '../../lib/format'
import { Empty } from '../../components/ui'

/** The "Leads" tab: Name · Email · Created · Form · Ad (as in Retool). */
export function LeadsList({ leads }: { leads: MetaLead[] }) {
  if (!leads.length) return <Empty>No leads in this period.</Empty>
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-muted">
            <tr className="border-b border-line text-left">
              {['Name', 'Email', 'Phone', 'Created', 'Form', 'Ad'].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.slice(0, 500).map((l) => (
              <tr key={l.id} className="border-b border-line/70 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{l.name}</td>
                <td className="px-3 py-2">{l.email && <a className="text-brand hover:underline" href={`mailto:${l.email}`}>{l.email}</a>}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.phone}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{dateTime(l.createdAt)}</td>
                <td className="max-w-[240px] truncate px-3 py-2">{l.formName}</td>
                <td className="max-w-[240px] truncate px-3 py-2">{l.adName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {leads.slice(0, 200).map((l) => (
          <li key={l.id} className="px-3 py-2.5 text-sm">
            <div className="flex justify-between"><span className="font-semibold">{l.name}</span><span className="text-xs text-muted">{dateTime(l.createdAt)}</span></div>
            <div className="text-xs text-muted">{l.email} · {l.phone}</div>
            <div className="truncate text-xs text-muted">{l.adName}</div>
          </li>
        ))}
      </ul>
      {leads.length > 500 && <p className="px-3 py-2 text-xs text-muted">Showing the 500 most recent. Download CSV for all.</p>}
    </>
  )
}
