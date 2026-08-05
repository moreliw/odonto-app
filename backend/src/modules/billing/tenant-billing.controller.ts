import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request } from 'express'
import { IsEnum } from 'class-validator'
import { Plan } from '@prisma/client-master'
import { BillingService } from './billing.service'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { RequestContext } from '../tenancy/request-context'

class ChangePlanDto {
  @IsEnum(['FREE', 'BASIC', 'PRO', 'CLINIC'] as any)
  plan: Plan
}

/**
 * Assinatura da própria clínica, para o administrador autenticado gerenciar
 * o plano — diferente de BillingController (rotas públicas de cadastro) e de
 * MasterAdminController (visão do dono da plataforma sobre todas as clínicas).
 */
@UseGuards(AuthGuard('jwt'))
@Controller('billing')
export class TenantBillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly prismaTenant: TenantPrismaService
  ) {}

  private tenantId(req: Request) {
    const ctx = req.tenantContext ?? RequestContext.get()
    if (!ctx) throw new ForbiddenException('Tenant não resolvido')
    return ctx.id
  }

  private async dentistCount() {
    return this.prismaTenant.getClient().user.count({ where: { role: 'DENTIST' as never } })
  }

  private assertAdmin(req: Request) {
    const user = (req as any).user
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas o administrador da clínica pode gerenciar a assinatura.')
    }
    return user
  }

  @Get('subscription')
  async subscription(@Req() req: Request) {
    const used = await this.dentistCount()
    return this.billing.getSubscriptionForTenant(this.tenantId(req), used)
  }

  @Post('change-plan')
  async changePlan(@Req() req: Request, @Body() dto: ChangePlanDto) {
    const user = this.assertAdmin(req)
    const used = await this.dentistCount()
    return this.billing.changeTenantPlan(this.tenantId(req), dto.plan, user.email, used)
  }

  @Post('portal')
  portal(@Req() req: Request) {
    this.assertAdmin(req)
    return this.billing.createPortalSession(this.tenantId(req))
  }

  @Post('cancel')
  cancel(@Req() req: Request) {
    this.assertAdmin(req)
    return this.billing.cancelTenantSubscription(this.tenantId(req))
  }
}
