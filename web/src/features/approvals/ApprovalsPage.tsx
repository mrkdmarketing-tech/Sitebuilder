/** Ad approval (Phase 2). Placeholder describing what's coming; see docs/ad-approval.md. */
import { CheckCircle2, FileText, Image, MessageSquare, ShieldAlert, Video } from 'lucide-react'
import { Card, PageTitle } from '../../components/ui'

const STEPS = [
  { icon: FileText, title: 'Submit copy + creative', text: 'Employees upload images or videos and write the copy, starting from templates and the client’s onboarding info.' },
  { icon: ShieldAlert, title: 'AI quality check', text: 'Spelling, grammar and things that don’t make sense in the copy, the text in images, and the subtitles in videos. Also checks city, phone, offer and CTA against the client.' },
  { icon: CheckCircle2, title: '“Hey, just double checking”', text: 'If anything was flagged, submitting shows the issues with Fix or Submit anyway. Submitting anyway is allowed and recorded.' },
  { icon: MessageSquare, title: 'Review', text: 'Reviewer works through the 11-point checklist (AI pre-fills what it can), comments, and approves or requests changes. Slack + ClickUp notifications as today.' },
]

export function ApprovalsPage() {
  return (
    <div>
      <PageTitle title="Ad approval" subtitle="Coming in Phase 2. Replaces Retool’s Ad Preview." />
      <div className="grid gap-3 md:grid-cols-2">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <Card key={title} className="flex gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle"><Icon size={18} /></div>
            <div>
              <div className="text-xs font-semibold text-muted">Step {i + 1}</div>
              <div className="font-semibold">{title}</div>
              <p className="mt-0.5 text-sm text-soft">{text}</p>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted"><Image size={14} /><Video size={14} /> Images and videos are stored privately; only signed-in staff can open them.</p>
    </div>
  )
}
