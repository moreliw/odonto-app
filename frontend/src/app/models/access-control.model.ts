export const PERMISSIONS = [
  'DASHBOARD_VIEW', 'APPOINTMENTS_VIEW', 'APPOINTMENTS_MANAGE', 'PATIENTS_VIEW', 'PATIENTS_MANAGE',
  'RECORDS_VIEW', 'RECORDS_MANAGE', 'FINANCE_VIEW', 'FINANCE_MANAGE', 'TEAM_VIEW', 'TEAM_MANAGE',
  'ACCESS_MANAGE', 'BILLING_MANAGE'
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]
export type AccessSnapshot = { role: 'ADMIN' | 'USER' | 'DENTIST'; permissions: PermissionKey[] }

export const DEFAULT_PERMISSIONS: Record<AccessSnapshot['role'], PermissionKey[]> = {
  ADMIN: [...PERMISSIONS],
  USER: ['DASHBOARD_VIEW','APPOINTMENTS_VIEW','APPOINTMENTS_MANAGE','PATIENTS_VIEW','PATIENTS_MANAGE','RECORDS_VIEW','RECORDS_MANAGE','FINANCE_VIEW','FINANCE_MANAGE','TEAM_VIEW','TEAM_MANAGE'],
  DENTIST: ['DASHBOARD_VIEW','APPOINTMENTS_VIEW','APPOINTMENTS_MANAGE','PATIENTS_VIEW','RECORDS_VIEW','RECORDS_MANAGE']
}

export type AccessConfiguration = {
  profiles: Array<{ role: 'USER' | 'DENTIST'; permissions: PermissionKey[] }>
  users: Array<{
    id: string
    name: string
    email?: string | null
    role: 'USER' | 'DENTIST'
    active: boolean
    overrides: Partial<Record<PermissionKey, boolean>>
    effectivePermissions: PermissionKey[]
  }>
}

