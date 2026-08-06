import { Inject, Injectable, ForbiddenException, ConflictException, NotFoundException, Scope, BadRequestException } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import type { Request } from 'express'
import { Plan } from '@prisma/client-master'
import { Prisma } from '@prisma/client-tenant'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { RequestContext } from '../tenancy/request-context'
import { DENTIST_LIMIT_BY_PLAN, PLAN_LABEL, nextPlanAfter } from '../billing/plan-limits'
import * as argon2 from 'argon2'

type TenantRole = 'ADMIN' | 'USER' | 'DENTIST'
type Requester = { userId: string; role: string }

const USER_SELECT = { id: true, username: true, email: true, name: true, role: true, active: true, createdAt: true }

function usernameFromEmail(email: string) {
  const raw = email.split('@')[0] || 'user'
  return raw.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
}

@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  constructor(
    private readonly prismaTenant: TenantPrismaService,
    @Inject(REQUEST) private readonly req: Request
  ) {}

  private currentPlan(): Plan {
    const ctx = this.req.tenantContext ?? RequestContext.get() ?? null
    const plan = (ctx?.plan as Plan | undefined) ?? undefined
    // Tenants antigos podem não ter assinatura registrada; trata como BASIC.
    return plan && plan in DENTIST_LIMIT_BY_PLAN ? plan : 'BASIC'
  }

  /** Quantos dentistas o plano permite e quantos já existem. */
  async dentistQuota() {
    const plan = this.currentPlan()
    const ctx = this.req.tenantContext ?? RequestContext.get() ?? null
    const limit = ctx?.dentistLimit !== undefined ? ctx.dentistLimit : DENTIST_LIMIT_BY_PLAN[plan]
    const used = await this.prismaTenant.getClient().user.count({ where: { role: 'DENTIST' as never } })
    return { plan, limit, used, remaining: limit === null ? null : Math.max(limit - used, 0) }
  }

  private async assertDentistSlotAvailable() {
    const { plan, limit, used } = await this.dentistQuota()
    if (limit === null || used < limit) return

    const next = nextPlanAfter(plan)
    const upgrade = next ? ` Para cadastrar mais, mude para o plano ${PLAN_LABEL[next]}.` : ''
    throw new ConflictException(
      `Seu plano ${PLAN_LABEL[plan]} permite ${limit} ${limit === 1 ? 'dentista' : 'dentistas'} e você já cadastrou ${used}.${upgrade}` +
        ' Recepção e secretária não contam nesse limite.'
    )
  }

  async create(
    adminUser: { role: string },
    data: { username?: string; email: string; name: string; password: string; role: TenantRole }
  ) {
    if (adminUser.role !== 'ADMIN') throw new ForbiddenException()

    if (data.role === 'DENTIST') await this.assertDentistSlotAvailable()

    const hash = await argon2.hash(data.password)
    const generatedUsername = usernameFromEmail(data.email)
    const username = (data.username || generatedUsername).slice(0, 32)

    try {
      return await this.prismaTenant.getClient().user.create({
        data: { username, email: data.email, name: data.name, passwordHash: hash, role: data.role as never, active: true },
        select: USER_SELECT
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe um usuário com esse e-mail.')
      }
      throw e
    }
  }

  async list(role?: TenantRole) {
    return this.prismaTenant.getClient().user.findMany({
      where: role ? { role: role as never } : undefined,
      orderBy: { createdAt: 'desc' },
      select: USER_SELECT
    })
  }

  async update(requester: Requester, id: string, data: { name?: string; email?: string; password?: string }) {
    if (requester.role !== 'ADMIN' && requester.userId !== id) {
      throw new ForbiddenException('Você só pode editar o próprio perfil.')
    }
    const patch: Record<string, unknown> = {}
    if (data.name !== undefined) patch.name = data.name
    if (data.email !== undefined) patch.email = data.email
    if (data.password) patch.passwordHash = await argon2.hash(data.password)
    if (Object.keys(patch).length === 0) throw new BadRequestException('Nada para atualizar.')

    try {
      return await this.prismaTenant.getClient().user.update({ where: { id }, data: patch, select: USER_SELECT })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe um usuário com esse e-mail.')
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Usuário não encontrado.')
      }
      throw e
    }
  }

  async remove(requester: Requester, id: string) {
    if (requester.role !== 'ADMIN') throw new ForbiddenException()
    if (requester.userId === id) throw new BadRequestException('Você não pode remover a própria conta.')
    try {
      // As consultas já atribuídas ficam sem dentista (onDelete: SetNull) — não perdem histórico.
      await this.prismaTenant.getClient().user.delete({ where: { id } })
      return { ok: true }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Usuário não encontrado.')
      }
      throw e
    }
  }
}
