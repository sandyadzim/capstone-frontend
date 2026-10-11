import type { ReportListItem } from '@/features/admin/reports/report-schema'

export const report: ReportListItem = {
  id: '55000000-0000-4000-8000-000000000001',
  reportNumber: 'RPT-0000000001',
  unit: {
    id: '11000000-0000-4000-8000-000000000002',
    unitNumber: 'B-202',
    floor: 2,
  },
  title: 'AC is not cooling',
  category: 'AC',
  proposedPriority: 'MEDIUM',
  finalPriority: null,
  status: 'REPORTED',
  reportedAt: '2026-10-01T18:30:00.000Z',
}

export function reportPage<T>(
  data: T[],
  page = 1,
  pageSize = 20,
  total = data.length,
) {
  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
}
