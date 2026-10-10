import type { ReactNode } from 'react'
import { useParams } from '@tanstack/react-router'
import { useIsMutating, useQuery } from '@tanstack/react-query'
import {
  Check,
  ClipboardList,
  ExternalLink,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import {
  UnitBreadcrumbs,
  UnitPage,
  UnitReadState,
  UnitUnavailable,
} from '../components/unit-page'
import { useUnitNavigation } from '../hooks/use-unit-navigation'
import { historyDetailQueryOptions, unitsKey } from '../unit-queries'
import type { HistoryDetail } from '../unit-schema'
import { formatDate, formatIdr } from '@/lib/format'

function WorkResult({ report }: { report: HistoryDetail }) {
  const result = report.maintenanceResult
  if (!result) return null
  return (
    <dl className="space-y-4">
      {[
        ['Inspection', result.inspectionResult],
        ['Problem found', result.problemFound],
        ['Repair action', result.repairAction],
        ['Additional notes', result.additionalNotes ?? 'No additional notes'],
      ].map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm wrap-anywhere">
            {value || 'Not provided'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function HistoryTimeline({ report }: { report: HistoryDetail }) {
  const events: {
    id: string
    title: string
    date: string
    icon: LucideIcon
    content: ReactNode
  }[] = [
    {
      id: 'reported',
      title: 'Report submitted',
      date: report.reportedAt,
      icon: ClipboardList,
      content: (
        <>
          <p className="whitespace-pre-wrap text-sm wrap-anywhere">
            {report.description}
          </p>
          {report.reportedBy && (
            <p className="mt-2 text-sm text-muted-foreground">
              Reported by {report.reportedBy.name}
            </p>
          )}
        </>
      ),
    },
  ]
  if (report.assignment)
    events.push({
      id: 'assigned',
      title: 'Technician assigned',
      date: report.assignment.assignedAt,
      icon: UserRound,
      content: (
        <div className="space-y-2 text-sm">
          <p>
            {report.assignment.technician?.name ?? 'No technician available'}
          </p>
          {report.assignment.estimatedArrivalAt && (
            <p className="text-muted-foreground">
              Estimated arrival:{' '}
              {formatDate(report.assignment.estimatedArrivalAt)}
            </p>
          )}
          {report.assignment.note && (
            <p className="whitespace-pre-wrap wrap-anywhere">
              {report.assignment.note}
            </p>
          )}
        </div>
      ),
    })
  if (report.maintenanceResult) {
    const result = report.maintenanceResult
    const updated = result.updatedAt !== result.createdAt
    events.push({
      id: 'result',
      title: 'Work result recorded',
      date: result.createdAt,
      icon: Wrench,
      content: updated ? (
        <p className="text-sm text-muted-foreground">
          The technician recorded the work result.
        </p>
      ) : (
        <WorkResult report={report} />
      ),
    })
    if (updated)
      events.push({
        id: 'result-updated',
        title: 'Work result updated',
        date: result.updatedAt,
        icon: Wrench,
        content: <WorkResult report={report} />,
      })
  }
  if (report.closedAt)
    events.push({
      id: 'closed',
      title: 'Report closed',
      date: report.closedAt,
      icon: Check,
      content: (
        <p className="text-sm text-muted-foreground">
          {report.closedBy
            ? `Closed by ${report.closedBy.name}.`
            : 'Maintenance report closed.'}
        </p>
      ),
    })
  events.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  return (
    <section
      aria-labelledby="history-timeline-title"
      className="rounded-xl border bg-card p-5"
    >
      <h2 id="history-timeline-title" className="text-lg font-semibold">
        Maintenance Timeline
      </h2>
      <ol aria-label="Maintenance timeline" className="mt-6 space-y-6">
        {events.map(({ id, title, date, icon: Icon, content }) => (
          <li
            key={id}
            className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-4 after:absolute after:top-8 after:-bottom-6 after:left-4 after:w-px after:bg-border last:after:hidden"
          >
            <span
              className={`relative z-10 flex size-8 items-center justify-center rounded-full ${id === 'closed' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-medium">{title}</h3>
                <time dateTime={date} className="text-xs text-muted-foreground">
                  {formatDate(date)}
                </time>
              </div>
              <div className="mt-3">{content}</div>
            </div>
          </li>
        ))}
      </ol>
      {!report.maintenanceResult && (
        <p className="mt-5 text-sm text-muted-foreground">
          No work result available.
        </p>
      )}
    </section>
  )
}

export function UnitHistoryDetailPage() {
  const { unitId, reportId } = useParams({
    from: '/admin/units/$unitId/history/$reportId',
  })
  const { search } = useUnitNavigation()
  const busy = useIsMutating({ mutationKey: unitsKey }) > 0
  const validIds =
    z.uuid().safeParse(unitId).success && z.uuid().safeParse(reportId).success
  const query = useQuery({
    ...historyDetailQueryOptions(unitId, reportId),
    enabled: validIds && !busy,
  })
  if (!validIds)
    return <UnitUnavailable title="Invalid history ID" search={search} />
  const report = query.data
  const attachments = report
    ? [
        ...report.damagePhotos.map((photo, index) => ({
          ...photo,
          label: `Damage photo ${index + 1}`,
        })),
        ...report.repairPhotos.map((photo, index) => ({
          ...photo,
          label: `Repair photo ${index + 1}`,
        })),
        ...(report.receipt ? [{ ...report.receipt, label: 'Receipt' }] : []),
      ]
    : []
  return (
    <UnitPage
      title="History Details"
      description={
        report
          ? `${report.reportNumber} · ${report.unit.unitNumber}`
          : 'Maintenance work result and recorded timeline.'
      }
      search={search}
      breadcrumbs={
        <UnitBreadcrumbs
          current="History Details"
          unitId={unitId}
          historyDetail
          search={search}
        />
      }
    >
      {(query.isPending || query.error) && (
        <UnitReadState
          variant="history"
          loading={query.isPending}
          error={query.error}
          onRetry={() => {
            void query.refetch()
          }}
        />
      )}
      {report && (
        <>
          <section
            aria-label="Maintenance report"
            className="rounded-xl border bg-card p-5"
          >
            <h2 className="text-lg font-semibold wrap-anywhere">
              {report.title}
            </h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              {[
                ['Report ID', report.reportNumber],
                ['Unit Name', report.unit.unitNumber],
                ['Status', 'Closed'],
                [
                  'Category',
                  report.category === 'AC'
                    ? 'AC'
                    : report.category.charAt(0) +
                      report.category.slice(1).toLowerCase(),
                ],
                [
                  'Technician',
                  report.assignment?.technician?.name ??
                    'No technician available',
                ],
                ['Closed Date', formatDate(report.closedAt)],
                ['Total cost (IDR)', formatIdr(report.totalCost)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-sm font-medium wrap-anywhere">
                    {label === 'Status' ? (
                      <Badge variant="secondary">{value}</Badge>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <HistoryTimeline report={report} />
          {!!report.costItems?.length && (
            <section
              aria-labelledby="history-cost-title"
              className="rounded-xl border bg-card p-5"
            >
              <h2 id="history-cost-title" className="text-lg font-semibold">
                Cost Details
              </h2>
              <ul className="mt-4 space-y-4">
                {report.costItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium wrap-anywhere">
                        {item.description}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {item.type === 'SERVICE' ? 'Service' : 'Material'} ·{' '}
                        {item.quantity} × {formatIdr(item.unitPrice)}
                      </p>
                    </div>
                    <span className="tabular-nums">
                      {formatIdr(item.subtotal)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t pt-4 text-right text-sm font-semibold">
                Total: {formatIdr(report.totalCost)}
              </p>
            </section>
          )}
          {!!attachments.length && (
            <section
              aria-labelledby="history-attachments-title"
              className="rounded-xl border bg-card p-5"
            >
              <h2
                id="history-attachments-title"
                className="text-lg font-semibold"
              >
                Attachments
              </h2>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {attachments.map((photo) => (
                  <li key={photo.id}>
                    <a
                      href={photo.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {photo.label}
                      <ExternalLink aria-hidden="true" className="size-4" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </UnitPage>
  )
}
