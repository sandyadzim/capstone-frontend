import { ExternalLink } from 'lucide-react'
import { ReportPhotos } from '@/features/admin/reports/components/report-photos'
import type { ReportDetail } from '@/features/admin/reports/report-schema'
import { formatIdr } from '@/lib/format'

export function TechnicianWorkResult({ report }: { report: ReportDetail }) {
  const result = report.maintenanceResult
  const showCosts = !!result || ['COMPLETED', 'CLOSED'].includes(report.status)
  return (
    <div className="space-y-6">
      <section aria-label="Work result">
        {result ? (
          <dl className="profile-information">
            {[
              ['Inspection findings', result.inspectionResult],
              ['Problem found', result.problemFound],
              ['Repair action', result.repairAction],
              ['Additional notes', result.additionalNotes],
            ].map(([label, value]) =>
              value ? (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className="whitespace-pre-wrap">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No work result yet.</p>
        )}
      </section>
      {report.repairPhotos.length > 0 && (
        <section aria-label="Repair photos" className="border-t pt-6">
          <h2 className="mb-3 text-base font-semibold">Repair photos</h2>
          <ReportPhotos photos={report.repairPhotos} label="Repair photos" />
        </section>
      )}
      {showCosts && (
        <section aria-label="Costs" className="space-y-4 border-t pt-6">
          <h2 className="text-base font-semibold">Costs</h2>
          {report.costItems?.length ? (
            <ul aria-label="Cost items" className="space-y-4">
              {report.costItems.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium wrap-anywhere">
                      {item.description}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {item.type === 'SERVICE' ? 'Service' : 'Material'}
                    </p>
                  </div>
                  <span className="tabular-nums wrap-anywhere">
                    {formatIdr(item.price)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No cost items</p>
          )}
          <p className="border-t pt-4 text-sm font-semibold wrap-anywhere">
            Total cost: {formatIdr(report.totalCost)}
          </p>
        </section>
      )}
      {(showCosts || report.receipt) && (
        <section aria-label="Receipt" className="border-t pt-6">
          <h2 className="mb-3 text-base font-semibold">Receipt</h2>
          {report.receipt ? (
            <a
              href={report.receipt.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              View receipt{' '}
              <ExternalLink className="size-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">No receipt</p>
          )}
        </section>
      )}
    </div>
  )
}
