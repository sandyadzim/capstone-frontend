import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { toast } from '@/components/ui/toast'
import { FullScreenLoader } from '@/components/full-screen-loader'
import { ReportForm } from '../components/report-form'
import { useCreateReport } from '../hooks/use-create-report'

export function CreateReportPage() {
  const search = getRouteApi('/admin/reports').useSearch()
  const navigate = useNavigate({ from: '/admin/reports/new' })
  const creation = useCreateReport()
  function returnToReports() {
    return navigate({
      to: '/admin/reports',
      replace: true,
      search: { q: '', page: 1, pageSize: search.pageSize },
    })
  }
  async function complete() {
    toast.add({ title: 'Report created', type: 'success' })
    await returnToReports()
  }
  return (
    <div className="min-w-0 max-w-3xl">
      <FullScreenLoader open={creation.busy} />
      <Breadcrumb aria-label="Breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-ring"
              render={<Link to="/admin/reports" search={search} />}
            >
              Reports
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Create report</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Create report
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Record a maintenance issue for a unit.
      </p>
      <div className="mt-6">
        <ReportForm
          creation={creation}
          onCancel={() => {
            void navigate({ to: '/admin/reports', search })
          }}
          onComplete={complete}
          onReturnToReports={() => {
            void returnToReports()
          }}
        />
      </div>
    </div>
  )
}
