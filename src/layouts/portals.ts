import { Building2, House, Wrench } from 'lucide-react'

export const portals = {
  resident: {
    name: 'Resident',
    home: '/',
    example: '/examples/form',
    icon: House,
    heading: 'Your property, in one place.',
    description: 'A space for your home and the people who look after it.',
    emptyTitle: 'No property connected',
    emptyDescription:
      'This is your resident starter. Property information will appear here when a data source is connected.',
  },
  admin: {
    name: 'Admin',
    home: '/admin',
    example: '/admin/examples/form',
    icon: Building2,
    heading: 'Property overview',
    description: 'A workspace for managing your properties.',
    emptyTitle: 'No properties connected',
    emptyDescription:
      'Your admin workspace is ready. Connect your property data to start building your overview.',
  },
  technician: {
    name: 'Technician',
    home: '/technician',
    example: '/technician/examples/form',
    icon: Wrench,
    heading: 'A space for the work ahead.',
    description: 'Keep your property work close at hand.',
    emptyTitle: 'No assignments connected',
    emptyDescription:
      'This is your technician starter. Assignments will appear here when a data source is connected.',
  },
} as const

export type PortalId = keyof typeof portals
