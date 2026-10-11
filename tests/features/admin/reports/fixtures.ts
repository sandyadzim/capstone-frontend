import type {
  ReportDetail,
  ReportListItem,
} from '@/features/admin/reports/report-schema'

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

export const reportDetail: ReportDetail = {
  ...report,
  description: 'The AC is running.\nThe room remains warm.',
  rejectionReason: null,
  reviewNote: null,
  closedAt: null,
  createdAt: report.reportedAt,
  updatedAt: report.reportedAt,
  assignment: null,
  damagePhotos: [],
  repairPhotos: [],
  receipt: null,
  maintenanceResult: null,
  totalCost: '0.00',
  costItems: [],
  createdBy: {
    id: '22000000-0000-4000-8000-000000000001',
    name: 'Resident creator',
  },
  reportedBy: {
    id: '22000000-0000-4000-8000-000000000001',
    name: 'Resident reporter',
  },
  reviewedBy: null,
  closedBy: null,
}

export const completedReport: ReportDetail = {
  ...reportDetail,
  status: 'CLOSED',
  finalPriority: 'HIGH',
  reviewNote: 'Check the compressor.\nInternal note.',
  reviewedBy: { id: '22000000-0000-4000-8000-000000000002', name: 'Reviewer' },
  closedBy: { id: '22000000-0000-4000-8000-000000000002', name: 'Closer' },
  closedAt: '2026-10-04T08:00:00.000Z',
  damagePhotos: [photo],
  repairPhotos: [
    {
      ...photo,
      id: '77000000-0000-4000-8000-000000000002',
      fileUrl: 'https://example.test/repair.png',
    },
  ],
  receipt: {
    ...photo,
    id: '77000000-0000-4000-8000-000000000003',
    fileUrl: 'https://example.test/receipt.pdf',
  },
  assignment: {
    id: '66000000-0000-4000-8000-000000000001',
    technician: {
      id: '33000000-0000-4000-8000-000000000001',
      name: 'Technician',
    },
    assignedBy: {
      id: '22000000-0000-4000-8000-000000000002',
      name: 'Assigner',
    },
    assignedAt: '2026-10-02T03:00:00.000Z',
    estimatedArrivalAt: '2026-10-02T05:00:00.000Z',
    note: 'Bring tools.',
  },
  maintenanceResult: {
    id: '88000000-0000-4000-8000-000000000001',
    inspectionResult: 'The compressor was inspected.',
    problemFound: 'Loose connection.',
    repairAction: 'Reconnected the cable.',
    additionalNotes: null,
    createdAt: '2026-10-03T07:00:00.000Z',
    updatedAt: '2026-10-03T07:30:00.000Z',
  },
  costItems: [1, 2].map((index) => ({
    id: `99000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    type: index === 1 ? 'SERVICE' : 'MATERIAL',
    description: index === 1 ? 'Service charge' : 'Replacement connector',
    quantity: '0.500',
    unitPrice: '0.01',
    subtotal: '0.01',
    createdAt: report.reportedAt,
    updatedAt: report.reportedAt,
  })),
  totalCost: '0.01',
}
