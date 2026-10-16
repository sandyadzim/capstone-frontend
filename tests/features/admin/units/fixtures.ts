import type {
  HistoryItem,
  HistoryDetail,
  ResidentAccount,
  Unit,
} from '@/features/admin/units/unit-schema'

export const unit: Unit = {
  id: '55000000-0000-4000-8000-000000000001',
  propertyId: '11000000-0000-4000-8000-000000000001',
  unitNumber: 'A-101',
  floor: 1,
  maintenanceFlag: false,
  isArchived: false,
  displayStatus: 'VACANT',
  activeResident: null,
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
}
export const resident: ResidentAccount = {
  id: '33000000-0000-4000-8000-000000000003',
  name: 'Alex Resident',
  loginIdentifier: 'alex@example.test',
  role: 'RESIDENT',
  isActive: true,
  activeUnit: {
    id: '55000000-0000-4000-8000-000000000002',
    unitNumber: 'B-202',
    floor: 2,
  },
  createdAt: unit.createdAt,
  updatedAt: unit.updatedAt,
}
export const historyItem: HistoryItem = {
  id: '66000000-0000-4000-8000-000000000001',
  reportNumber: 'RPT-0000000001',
  title: 'Leaking pipe',
  category: 'PLUMBING',
  reportedAt: unit.createdAt,
  closedAt: unit.updatedAt,
  technician: null,
  maintenanceResult: {
    id: '77000000-0000-4000-8000-000000000001',
    inspectionResult: 'Inspected pipe',
    problemFound: 'Worn seal',
    repairAction: 'Replaced seal',
    additionalNotes: null,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  },
  totalCost: '125000.50',
  status: 'CLOSED',
}
export function pageData<T>(
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

export const historyDetail: HistoryDetail = {
  id: historyItem.id,
  reportNumber: historyItem.reportNumber,
  title: historyItem.title,
  category: historyItem.category,
  reportedAt: historyItem.reportedAt,
  totalCost: historyItem.totalCost,
  status: 'CLOSED',
  unit: { id: unit.id, unitNumber: unit.unitNumber, floor: unit.floor },
  description: 'A pipe is leaking under the sink.',
  assignment: {
    id: '88000000-0000-4000-8000-000000000001',
    technician: {
      id: '33000000-0000-4000-8000-000000000002',
      name: 'Taylor Technician',
    },
    assignedAt: '2026-10-02T11:00:00.000Z',
    estimatedArrivalAt: '2026-10-02T12:00:00.000Z',
    note: 'Inspect the connection.',
  },
  maintenanceResult: {
    ...historyItem.maintenanceResult!,
    createdAt: '2026-10-02T13:00:00.000Z',
    updatedAt: '2026-10-02T14:00:00.000Z',
  },
  closedAt: '2026-10-03T10:00:00.000Z',
  reportedBy: { id: resident.id, name: resident.name },
  closedBy: {
    id: '33000000-0000-4000-8000-000000000001',
    name: 'Morgan Admin',
  },
  costItems: [
    {
      id: '99000000-0000-4000-8000-000000000001',
      type: 'SERVICE',
      description: 'Pipe repair',
      price: '125000.50',
    },
  ],
  damagePhotos: [],
  repairPhotos: [],
  receipt: null,
}
