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

export const createdReport = {
  ...report,
  status: 'VERIFIED' as const,
  proposedPriority: null,
  finalPriority: 'HIGH' as const,
  description: 'The AC is running but the room remains warm.',
  damagePhotos: [],
}
export const photo = {
  id: '77000000-0000-4000-8000-000000000001',
  fileUrl: 'https://example.test/damage.png',
  createdAt: report.reportedAt,
}
export const reportCreate = {
  unitId: report.unit.id,
  title: report.title,
  description: createdReport.description,
  category: report.category,
  priority: 'HIGH' as const,
}
