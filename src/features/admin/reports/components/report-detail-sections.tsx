import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { formatDate, formatIdr } from '@/lib/format'
import type { ReportDetail } from '../report-schema'
import { reportCategoryLabels } from '../report-labels'
import { ReportPriorityBadge, ReportStatusBadge } from './report-badges'
import { ReportPhotos } from './report-photos'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Information({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-5 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm font-medium wrap-anywhere">
            {value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ReportDetailSections({ report }: { report: ReportDetail }) {
  const assignment = report.assignment
  const result = report.maintenanceResult
  const costs = report.costItems ?? []
  const showCosts =
    costs.length > 0 ||
    !!report.receipt ||
    report.status === 'COMPLETED' ||
    report.status === 'CLOSED'
  return (
    <>
      <Section title="Report information">
        <h3 className="text-base font-semibold wrap-anywhere">
          {report.title}
        </h3>
        <p className="mt-3 mb-5 whitespace-pre-wrap text-sm leading-6 wrap-anywhere">
          {report.description}
        </p>
        <Information
          rows={[
            ['Report ID', report.reportNumber],
            ['Unit name', report.unit.unitNumber],
            ['Floor', report.unit.floor],
            ['Category', reportCategoryLabels[report.category]],
            ['Status', <ReportStatusBadge status={report.status} />],
            [
              'Proposed priority',
              <ReportPriorityBadge priority={report.proposedPriority} />,
            ],
            [
              'Final priority',
              <ReportPriorityBadge priority={report.finalPriority} />,
            ],
            ['Reported date', formatDate(report.reportedAt)],
            ['Created by', report.createdBy?.name],
            ['Reported by', report.reportedBy?.name],
          ]}
        />
      </Section>
      <Section title="Damage photos">
        {report.damagePhotos.length ? (
          <ReportPhotos photos={report.damagePhotos} label="Damage photos" />
        ) : (
          <p className="text-sm text-muted-foreground">No damage photos</p>
        )}
      </Section>
      {(report.reviewedBy || report.reviewNote || report.rejectionReason) && (
        <Section title="Review">
          <Information
            rows={[
              ['Reviewed by', report.reviewedBy?.name],
              ['Review note', report.reviewNote],
              ['Rejection reason', report.rejectionReason],
            ]}
          />
        </Section>
      )}
      {assignment && (
        <Section title="Technician assignment">
          <Information
            rows={[
              ['Technician', assignment.technician?.name],
              ['Assigned by', assignment.assignedBy?.name],
              ['Assigned date', formatDate(assignment.assignedAt)],
              [
                'Estimated arrival',
                assignment.estimatedArrivalAt
                  ? formatDate(assignment.estimatedArrivalAt)
                  : null,
              ],
              ['Assignment note', assignment.note],
            ]}
          />
        </Section>
      )}
      {(result || report.repairPhotos.length > 0) && (
        <Section title="Work result">
          {result && (
            <dl className="space-y-5">
              {[
                ['Inspection', result.inspectionResult],
                ['Problem found', result.problemFound],
                ['Repair action', result.repairAction],
                ['Additional notes', result.additionalNotes],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 wrap-anywhere">
                    {value ?? '—'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {report.repairPhotos.length > 0 && (
            <div className={result ? 'mt-5' : undefined}>
              <h3 className="mb-3 text-sm font-medium">Repair photos</h3>
              <ReportPhotos
                photos={report.repairPhotos}
                label="Repair photos"
              />
            </div>
          )}
        </Section>
      )}
      {showCosts && (
        <Section title="Costs and receipt">
          {costs.length ? (
            <ul aria-label="Cost items" className="space-y-5">
              {costs.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium wrap-anywhere">
                      {item.description}
                    </p>
                    <p className="mt-1 text-muted-foreground wrap-anywhere">
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
          ) : (
            <p className="text-sm text-muted-foreground">No cost items</p>
          )}
          <p className="mt-5 border-t pt-4 text-right text-sm font-semibold wrap-anywhere">
            Total cost (IDR): {formatIdr(report.totalCost)}
          </p>
          {report.receipt ? (
            <a
              href={report.receipt.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              View receipt
              <ExternalLink aria-hidden="true" className="size-4" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No receipt</p>
          )}
        </Section>
      )}
      <Section title="Record information">
        <Information
          rows={[
            ['Created date', formatDate(report.createdAt)],
            ['Updated date', formatDate(report.updatedAt)],
            ...(report.closedAt
              ? [
                  ['Closed date', formatDate(report.closedAt)] as [
                    string,
                    ReactNode,
                  ],
                ]
              : []),
            ...(report.closedBy
              ? [['Closed by', report.closedBy.name] as [string, ReactNode]]
              : []),
          ]}
        />
      </Section>
    </>
  )
}
