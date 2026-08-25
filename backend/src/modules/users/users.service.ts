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
type Requester = { userId: string; email?: string; name?: string; role: string }

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdByName: true,
  updatedByName: true,
  createdAt: true,
  updatedAt: true
}

function usernameFromEmail(email: string) {
  const raw = email.split('@')[0] || 'user'
  return raw.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
}

function usernameFromName(name: string) {
  const raw = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '.')
  return raw || 'usuario'
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

  /** Quantos dentistas o plano permite e quantos já existem — só conta quem tem acesso ao sistema (com login); um dentista cadastrado só como referência não ocupa vaga. */
  async dentistQuota() {
    const plan = this.currentPlan()
    const ctx = this.req.tenantContext ?? RequestContext.get() ?? null
    const limit = ctx?.dentistLimit !== undefined ? ctx.dentistLimit : DENTIST_LIMIT_BY_PLAN[plan]
    const used = await this.prismaTenant.getClient().user.count({ where: { role: 'DENTIST' as never, email: { not: null } } })
    return { plan, limit, used, remaining: limit === null ? null : Math.max(limit - used, 0) }
  }

  private async assertDentistSlotAvailable() {
    const { plan, limit, used } = await this.dentistQuota()
    if (limit === null || used < limit) return

    const next = nextPlanAfter(plan)
    const upgrade = next ? ` Para cadastrar mais, mude para o plano ${PLAN_LABEL[next]}.` : ''
    throw new ConflictException(
      `Seu plano ${PLAN_LABEL[plan]} permite ${limit} ${limit === 1 ? 'dentista' : 'dentistas'} com acesso ao sistema e você já tem ${used}.${upgrade}` +
        ' Recepção, secretária e dentistas cadastrados só como referência (sem login) não contam nesse limite.'
    )
  }

  async create(
    adminUser: { role: string; email?: string; name?: string },
    data: { username?: string; email?: string; name: string; password?: string; role: TenantRole }
  ) {
    if (adminUser.role !== 'ADMIN' && data.role === 'ADMIN') {
      throw new ForbiddenException('Somente o administrador pode criar outra conta administrativa.')
    }
    // Acesso ao sistema (login) é opcional para dentistas: ou informa e-mail + senha juntos, ou nenhum dos dois.
    if (Boolean(data.email) !== Boolean(data.password)) {
      throw new BadRequestException('Para criar acesso ao sistema, informe e-mail e senha juntos.')
    }
    if (!data.email && data.role !== 'DENTIST') {
      throw new BadRequestException('E-mail e senha são obrigatórios para este perfil.')
    }

    if (data.role === 'DENTIST' && data.email) await this.assertDentistSlotAvailable()

    const hash = data.password ? await argon2.hash(data.password) : null
    const email = data.email || null
    const generatedUsername = email ? usernameFromEmail(email) : usernameFromName(data.name)
    const username = (data.username || generatedUsername).slice(0, 32)

    try {
      return await this.prismaTenant.getClient().user.create({
        data: {
          username,
          email,
          name: data.name,
          passwordHash: hash,
          role: data.role as never,
          active: true,
          createdByName: adminUser.name?.trim() || adminUser.email?.trim() || 'Sistema',
          updatedByName: adminUser.name?.trim() || adminUser.email?.trim() || 'Sistema'
        },
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

  async findById(id: string) {
    const user = await this.prismaTenant.getClient().user.findUnique({ where: { id }, select: USER_SELECT })
    if (!user) throw new NotFoundException('Usuário não encontrado.')
    return user
  }

  async update(requester: Requester, id: string, data: { name?: string; email?: string; password?: string }) {
    const isSelf = requester.userId === id
    if (!isSelf) {
      const target = await this.prismaTenant.getClient().user.findUnique({ where: { id }, select: { role: true } })
      if (requester.role !== 'ADMIN' && target?.role === 'ADMIN') throw new ForbiddenException('Somente outro administrador pode editar uma conta administrativa.')
    }
    const patch: Record<string, unknown> = {}
    if (data.name !== undefined) patch.name = data.name
    if (data.email !== undefined) patch.email = data.email || null
    if (data.password) {
      // Uma senha sem e-mail deixa a conta sem forma de login — exige que o e-mail já exista ou venha junto.
      const resultingEmail = data.email !== undefined ? data.email : (await this.prismaTenant.getClient().user.findUnique({ where: { id }, select: { email: true } }))?.email
      if (!resultingEmail) throw new BadRequestException('Informe um e-mail para criar o acesso deste usuário.')
      patch.passwordHash = await argon2.hash(data.password)
    }
    if (Object.keys(patch).length === 0) throw new BadRequestException('Nada para atualizar.')
    patch.updatedByName = requester.name?.trim() || requester.email?.trim() || 'Sistema'

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
    if (requester.userId === id) throw new BadRequestException('Você não pode remover a própria conta.')
    const target = await this.prismaTenant.getClient().user.findUnique({ where: { id }, select: { role: true } })
    if (requester.role !== 'ADMIN' && target?.role === 'ADMIN') throw new ForbiddenException('Somente outro administrador pode remover uma conta administrativa.')
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
