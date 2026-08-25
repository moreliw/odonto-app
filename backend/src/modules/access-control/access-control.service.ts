import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { DEFAULT_ROLE_PERMISSIONS, MANAGE_DEPENDENCIES, normalizePermissions, PermissionKey, TenantRole } from './permissions'

type Requester = { userId: string; role: TenantRole; name?: string; email?: string }
type Overrides = Partial<Record<PermissionKey, boolean>>

@Injectable()
export class AccessControlService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}

  async effectiveFor(requester: Requester) {
    if (requester.role === 'ADMIN') return [...DEFAULT_ROLE_PERMISSIONS.ADMIN]
    const prisma = this.prismaTenant.getClient()
    const [policy, user] = await Promise.all([
      prisma.roleAccessPolicy.findUnique({ where: { role: requester.role as never } }),
      prisma.user.findUnique({ where: { id: requester.userId }, select: { accessOverrides: true } })
    ])
    const base = new Set(policy ? this.parsePermissions(policy.permissions) : DEFAULT_ROLE_PERMISSIONS[requester.role])
    const overrides = this.parseOverrides(user?.accessOverrides)
    for (const [permission, enabled] of Object.entries(overrides) as Array<[PermissionKey, boolean]>) {
      if (enabled) base.add(permission)
      else base.delete(permission)
    }
    for (const [manage, view] of Object.entries(MANAGE_DEPENDENCIES) as Array<[PermissionKey, PermissionKey]>) {
      if (overrides[manage] === true) {
        base.add(manage)
        base.add(view)
      }
      if (overrides[manage] === false) base.delete(manage)
      if (overrides[view] === false) {
        base.delete(view)
        base.delete(manage)
      }
    }
    return normalizePermissions([...base])
  }

  async hasPermission(requester: Requester, permission: PermissionKey) {
    return (await this.effectiveFor(requester)).includes(permission)
  }

  async assertPermission(requester: Requester, permission: PermissionKey) {
    if (!(await this.hasPermission(requester, permission))) {
      throw new ForbiddenException('Seu perfil não possui permissão para realizar esta ação.')
    }
  }

  async current(requester: Requester) {
    return { permissions: await this.effectiveFor(requester), role: requester.role }
  }

  async configuration(requester: Requester) {
    this.assertAdmin(requester)
    const prisma = this.prismaTenant.getClient()
    const [policies, users] = await Promise.all([
      prisma.roleAccessPolicy.findMany(),
      prisma.user.findMany({
        where: { role: { in: ['USER', 'DENTIST'] }, active: true, email: { not: null } },
        select: { id: true, name: true, email: true, role: true, active: true, accessOverrides: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }]
      })
    ])
    const policyMap = new Map(policies.map(policy => [String(policy.role), this.parsePermissions(policy.permissions)]))
    return {
      profiles: (['USER', 'DENTIST'] as TenantRole[]).map(role => ({ role, permissions: policyMap.get(role) || DEFAULT_ROLE_PERMISSIONS[role] })),
      users: await Promise.all(users.map(async user => ({
        ...user,
        overrides: this.parseOverrides(user.accessOverrides),
        effectivePermissions: await this.effectiveFor({ userId: user.id, role: String(user.role) as TenantRole })
      })))
    }
  }

  async updateRole(requester: Requester, role: TenantRole, permissions: unknown) {
    this.assertAdmin(requester)
    if (!['USER', 'DENTIST'].includes(role)) throw new ForbiddenException('As permissões do administrador são fixas por segurança.')
    const normalized = normalizePermissions(permissions)
    await this.prismaTenant.getClient().roleAccessPolicy.upsert({
      where: { role: role as never },
      create: { role: role as never, permissions: JSON.stringify(normalized), updatedByName: this.actor(requester) },
      update: { permissions: JSON.stringify(normalized), updatedByName: this.actor(requester) }
    })
    return { role, permissions: normalized }
  }

  async updateUser(requester: Requester, userId: string, overrides: unknown) {
    this.assertAdmin(requester)
    const prisma = this.prismaTenant.getClient()
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })
    if (!user) throw new NotFoundException('Usuário não encontrado.')
    if (String(user.role) === 'ADMIN') throw new ForbiddenException('O acesso do administrador não pode ser reduzido.')
    const normalized = this.normalizeOverrides(overrides)
    await prisma.user.update({ where: { id: userId }, data: { accessOverrides: Object.keys(normalized).length ? JSON.stringify(normalized) : null } })
    const role = String(user.role) as TenantRole
    return { userId, overrides: normalized, effectivePermissions: await this.effectiveFor({ userId, role }) }
  }

  private assertAdmin(requester: Requester) {
    if (requester.role !== 'ADMIN') throw new ForbiddenException('Apenas o administrador da clínica pode gerenciar acessos.')
  }
  private actor(requester: Requester) { return requester.name?.trim() || requester.email?.trim() || 'Sistema' }
  private parsePermissions(value?: string | null) {
    try { return normalizePermissions(JSON.parse(value || '[]')) }
    catch { return [] }
  }
  private parseOverrides(value?: string | null): Overrides {
    try { return this.normalizeOverrides(JSON.parse(value || '{}')) }
    catch { return {} }
  }
  private normalizeOverrides(value: unknown): Overrides {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const result: Overrides = {}
    for (const [key, enabled] of Object.entries(value)) {
      if ((DEFAULT_ROLE_PERMISSIONS.ADMIN as string[]).includes(key) && typeof enabled === 'boolean') result[key as PermissionKey] = enabled
    }
    return result
  }
}
