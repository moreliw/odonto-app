export const PERMISSIONS = [
  'DASHBOARD_VIEW',
  'APPOINTMENTS_VIEW',
  'APPOINTMENTS_MANAGE',
  'PATIENTS_VIEW',
  'PATIENTS_MANAGE',
  'RECORDS_VIEW',
  'RECORDS_MANAGE',
  'FINANCE_VIEW',
  'FINANCE_MANAGE',
  'FISCAL_VIEW',
  'FISCAL_MANAGE',
  'FISCAL_CONFIGURE',
  'TEAM_VIEW',
  'TEAM_MANAGE',
  'ACCESS_MANAGE',
  'BILLING_MANAGE'
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]
export type TenantRole = 'ADMIN' | 'USER' | 'DENTIST'

export const DEFAULT_ROLE_PERMISSIONS: Record<TenantRole, PermissionKey[]> = {
  ADMIN: [...PERMISSIONS],
  USER: [
    'DASHBOARD_VIEW',
    'APPOINTMENTS_VIEW', 'APPOINTMENTS_MANAGE',
    'PATIENTS_VIEW', 'PATIENTS_MANAGE',
    'RECORDS_VIEW', 'RECORDS_MANAGE',
    'FINANCE_VIEW', 'FINANCE_MANAGE',
    'TEAM_VIEW', 'TEAM_MANAGE'
  ],
  DENTIST: [
    'DASHBOARD_VIEW',
    'APPOINTMENTS_VIEW', 'APPOINTMENTS_MANAGE',
    'PATIENTS_VIEW',
    'RECORDS_VIEW', 'RECORDS_MANAGE'
  ]
}

export const MANAGE_DEPENDENCIES: Partial<Record<PermissionKey, PermissionKey>> = {
  APPOINTMENTS_MANAGE: 'APPOINTMENTS_VIEW',
  PATIENTS_MANAGE: 'PATIENTS_VIEW',
  RECORDS_MANAGE: 'RECORDS_VIEW',
  FINANCE_MANAGE: 'FINANCE_VIEW',
  FISCAL_MANAGE: 'FISCAL_VIEW',
  FISCAL_CONFIGURE: 'FISCAL_VIEW',
  TEAM_MANAGE: 'TEAM_VIEW'
}

export function normalizePermissions(input: unknown): PermissionKey[] {
  const allowed = new Set(PERMISSIONS)
  const values = Array.isArray(input) ? input.filter((value): value is PermissionKey => typeof value === 'string' && allowed.has(value as PermissionKey)) : []
  const result = new Set(values)
  for (const [manage, view] of Object.entries(MANAGE_DEPENDENCIES) as Array<[PermissionKey, PermissionKey]>) {
    if (result.has(manage)) result.add(view)
    if (!result.has(view)) result.delete(manage)
  }
  return PERMISSIONS.filter(permission => result.has(permission))
}
