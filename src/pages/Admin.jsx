import { useMemo, useState } from 'react'
import { decideVerification, getAdminOverview, getIssues, getOccupancy, getVerifications, updateIssue } from '@/api'
import { cn } from '@/lib/cn'
import { dateTime, money, relativeDay } from '@/lib/format'
import { ISSUE_STATUS, SEVERITY } from '@/lib/status'
import { useAsync } from '@/hooks/useAsync'
import { PageShell, PageHeader } from '@/components/layout/PageShell'
import KumbhMap from '@/components/map/KumbhMap'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import Photo from '@/components/ui/Photo'
import StatusPill from '@/components/ui/StatusPill'
import { SegmentedTabs } from '@/components/ui/Chip'
import { Textarea } from '@/components/ui/Field'
import Sheet from '@/components/ui/Sheet'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'

const TABS = [
  { id: 'verifications', label: 'Verifications' },
  { id: 'occupancy', label: 'Live occupancy' },
  { id: 'issues', label: 'Issues' },
]

const VEHICLE_ICON = { '2w': 'bike', car: 'car', bus: 'bus' }

export default function Admin() {
  const toast = useToast()
  const [tab, setTab] = useState('verifications')
  const [busyId, setBusyId] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [note, setNote] = useState('')
  const [issueFor, setIssueFor] = useState(null)

  const { data: overview, loading, error, reload } = useAsync(() => getAdminOverview(), [])
  const { data: subs, reload: reloadSubs } = useAsync(() => getVerifications(), [])
  const { data: issues, reload: reloadIssues } = useAsync(() => getIssues(), [])
  const { data: occupancy } = useAsync(() => getOccupancy(), [])

  const pending = useMemo(() => (subs ?? []).filter((s) => s.status === 'pending'), [subs])
  const openIssues = useMemo(() => (issues ?? []).filter((i) => i.status !== 'resolved'), [issues])

  const decide = async (submission, decision) => {
    setBusyId(submission.id)
    try {
      await decideVerification(submission.id, decision, note || null)
      toast.push({
        tone: decision === 'verified' ? 'success' : 'info',
        title: decision === 'verified' ? 'Host verified' : 'Submission rejected',
        message: `${submission.hostName} · ${submission.title}`,
      })
      setReviewing(null)
      setNote('')
      reloadSubs()
      reload()
    } catch (err) {
      toast.push({ tone: 'error', title: 'Action failed', message: err.friendlyMessage ?? err.message })
    } finally {
      setBusyId(null)
    }
  }

  const setIssueStatus = async (issue, status) => {
    setBusyId(issue.id)
    try {
      await updateIssue(issue.id, { status })
      toast.push({ tone: 'success', title: `Marked ${ISSUE_STATUS[status].label.toLowerCase()}` })
      setIssueFor(null)
      reloadIssues()
      reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageShell>
      <PageHeader title="Admin" subtitle="Mela operations console" backTo="/host" />

      <div className="mx-auto max-w-4xl px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="h-[74px] rounded-[var(--radius-card)] bg-surface card-shadow" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Pending verifications" value={overview?.pendingVerifications ?? 0} icon="shield" tone="warning" />
            <Tile label="Live bookings" value={overview?.liveBookings ?? 0} icon="ticket" />
            <Tile label="Open issues" value={overview?.openIssues ?? 0} icon="alert" tone="danger" />
            <Tile label="Gross booked" value={money(overview?.grossToday ?? 0)} icon="wallet" tone="accent" />
          </div>
        )}

        <div className="mt-4">
          <SegmentedTabs
            tabs={[
              { ...TABS[0], count: pending.length },
              TABS[1],
              { ...TABS[2], count: openIssues.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {/* ----------------------------- verifications ---------------------------- */}
        {tab === 'verifications' && (
          <div className="mt-4 space-y-3 pb-4">
            {error && <ErrorState message={error.friendlyMessage} onRetry={reload} />}
            {pending.length === 0 && (
              <EmptyState icon="shield" title="Queue is clear" message="No host submissions are waiting for review." />
            )}
            {pending.map((submission) => (
              <article key={submission.id} className="rounded-[var(--radius-card)] bg-surface p-3.5 card-shadow">
                <div className="flex items-start gap-3">
                  <Photo
                    seed={submission.id}
                    label={submission.zoneName}
                    ratio="aspect-square w-16 shrink-0"
                    rounded="rounded-[12px]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{submission.title}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {submission.hostName} · {submission.phone}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {submission.zoneName} · {submission.capacity} vehicles · {money(submission.priceHour)}/hr
                    </p>
                  </div>
                  <StatusPill tone="warning" label={relativeDay(submission.submittedISO)} size="sm" pulse />
                </div>

                {submission.note && (
                  <p className="mt-2.5 rounded-[12px] bg-surface-sunken p-2.5 text-[12px] text-muted">
                    “{submission.note}”
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {submission.documents.map((doc) => (
                    <span
                      key={doc}
                      className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-muted"
                    >
                      <Icon name="ticket" size={12} />
                      {doc}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setReviewing(submission)
                      setNote('')
                    }}
                  >
                    Review
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    loading={busyId === submission.id}
                    icon={<Icon name="check" size={15} />}
                    onClick={() => decide(submission, 'verified')}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Icon name="x" size={15} />}
                    onClick={() => decide(submission, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ------------------------------ occupancy ------------------------------ */}
        {tab === 'occupancy' && (
          <div className="mt-4 space-y-3 pb-4">
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
              <div className="relative h-72">
                <KumbhMap spots={occupancy ?? []} zoom={12} showZoom />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Legend tone="success" label="Available" />
              <Legend tone="warning" label="Filling fast" />
              <Legend tone="danger" label="Full" />
              <span className="ml-auto text-[12px] text-muted">
                {overview?.occupancy?.rate ?? 0}% of listings have a free bay
              </span>
            </div>

            <div className="space-y-2">
              {(overview?.zoneLoad ?? []).map((zone) => (
                <div key={zone.id} className="rounded-[14px] bg-surface p-3.5 card-shadow">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold">{zone.name}</span>
                    <span className="text-muted">
                      {zone.open}/{zone.listings} open
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-500 [transition-timing-function:var(--ease-out-expo)]',
                        zone.rate > 60 ? 'bg-success' : zone.rate > 25 ? 'bg-warning' : 'bg-danger',
                      )}
                      style={{ width: `${zone.rate}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">{zone.rate}% availability</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* -------------------------------- issues ------------------------------- */}
        {tab === 'issues' && (
          <div className="mt-4 space-y-3 pb-4">
            {(issues ?? []).map((issue) => {
              const status = ISSUE_STATUS[issue.status]
              const severity = SEVERITY[issue.severity]
              return (
                <article key={issue.id} className="rounded-[var(--radius-card)] bg-surface p-3.5 card-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">{issue.title}</p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {issue.type} · {issue.zoneName} · raised by {issue.raisedBy}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill tone={status.tone} label={status.label} size="sm" />
                      <StatusPill tone={severity.tone} label={severity.label} size="sm" />
                    </div>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{issue.detail}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted">{dateTime(issue.raisedISO)}</span>
                    <Button variant="outline" size="sm" onClick={() => setIssueFor(issue)}>
                      Update
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* verification review sheet */}
      <Sheet
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Review submission"
        subtitle={reviewing?.title}
        height="auto"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              full
              size="lg"
              onClick={() => decide(reviewing, 'rejected')}
              loading={busyId === reviewing?.id}
            >
              Reject
            </Button>
            <Button
              full
              size="lg"
              onClick={() => decide(reviewing, 'verified')}
              loading={busyId === reviewing?.id}
              icon={<Icon name="check" size={16} />}
            >
              Approve listing
            </Button>
          </div>
        }
      >
        {reviewing && (
          <div className="space-y-3 pt-1">
            <div className="flex gap-3">
              <Photo seed={reviewing.id} label={reviewing.zoneName} ratio="aspect-square w-20 shrink-0" rounded="rounded-[12px]" />
              <div className="min-w-0 text-[13px]">
                <p className="font-semibold">{reviewing.hostName}</p>
                <p className="text-muted">{reviewing.phone}</p>
                <p className="mt-1 text-muted">{reviewing.address}</p>
                <p className="mt-1 text-muted">
                  {reviewing.latlng[0].toFixed(4)}, {reviewing.latlng[1].toFixed(4)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {reviewing.vehicles.map((vehicle) => (
                <span
                  key={vehicle}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-[12px] font-semibold"
                >
                  <Icon name={VEHICLE_ICON[vehicle]} size={13} />
                </span>
              ))}
            </div>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Note for the host (optional)"
            />
          </div>
        )}
      </Sheet>

      {/* issue update sheet */}
      <Sheet
        open={Boolean(issueFor)}
        onClose={() => setIssueFor(null)}
        title="Update issue"
        subtitle={issueFor?.title}
        height="auto"
      >
        {issueFor && (
          <div className="space-y-2 pt-1">
            {Object.entries(ISSUE_STATUS).map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => setIssueStatus(issueFor, key)}
                className={cn(
                  'flex w-full items-center justify-between rounded-[14px] border p-3.5 text-left transition-all active:scale-[0.99]',
                  issueFor.status === key ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
                )}
              >
                <span className="text-[14px] font-semibold">{value.label}</span>
                {issueFor.status === key && <Icon name="checkCircle" size={18} className="text-accent" />}
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </PageShell>
  )
}

function Tile({ label, value, icon, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-muted',
    warning: 'text-warning',
    danger: 'text-danger',
    accent: 'text-accent',
  }
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-3.5 card-shadow">
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={14} className={tones[tone]} />
        <p className="truncate text-[11px] font-semibold text-muted">{label}</p>
      </div>
      <p className="mt-1.5 text-[19px] font-bold">{value}</p>
    </div>
  )
}

function Legend({ tone, label }) {
  const colors = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1.5 text-[12px] font-semibold card-shadow">
      <span className={cn('size-2 rounded-full', colors[tone])} />
      {label}
    </span>
  )
}
