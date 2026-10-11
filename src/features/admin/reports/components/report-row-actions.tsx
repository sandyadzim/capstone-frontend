import { Link } from '@tanstack/react-router'
import { Ellipsis, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ReportListItem, ReportsSearch } from '../report-schema'

export function ReportRowActions({
  report,
  search,
}: {
  report: ReportListItem
  search: ReportsSearch
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Actions for ${report.reportNumber}`}
            title={`Actions for ${report.reportNumber}`}
          />
        }
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-48"
        aria-label={`Actions for ${report.reportNumber}`}
      >
        <DropdownMenuItem
          className="min-h-11 gap-3 px-3"
          render={
            <Link
              to="/admin/reports/$reportId"
              params={{ reportId: report.id }}
              search={search}
            />
          }
        >
          <Eye aria-hidden="true" /> View detail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
