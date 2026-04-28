import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { TenantService } from './tenant.service'
import { RequestContext } from './request-context'

function extractSubdomain(host: string) {
  const h = host.split(':')[0]
  const parts = h.split('.')
  if (parts.length < 3) return ''
  return parts[0]
}

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(private readonly tenants: TenantService) {}
  async use(req: Request, res: Response, next: NextFunction) {
    const url = req.originalUrl || req.url || ''
    if (url.startsWith('/api/docs') || url.startsWith('/api/tenants/provision') || url.startsWith('/api/public') || url.startsWith('/api/health') || url.startsWith('/api/master')) {
      return next()
    }
    const host = req.headers['x-forwarded-host']?.toString() || req.headers.host || ''
    let subdomain = req.headers['x-tenant']?.toString().trim() || ''
    if (!subdomain) subdomain = extractSubdomain(host)
    if (!subdomain && process.env.DEV_TENANT_SUBDOMAIN) subdomain = process.env.DEV_TENANT_SUBDOMAIN
    if (!subdomain) return res.status(400).send({ message: 'Tenant not resolved' })
    const tenant = await this.tenants.findBySubdomain(subdomain)
    if (!tenant) return res.status(404).send({ message: 'Tenant not found' })
    const policy = await this.tenants.getAccessPolicyBySubdomain(subdomain)
    if (!policy.allowed) {
      const msg =
        policy.status === 'PAST_DUE'
          ? 'Assinatura em atraso. Regularize o pagamento para continuar.'
          : policy.status === 'CANCELED'
            ? 'Assinatura cancelada. Reative o plano para acessar.'
            : 'Assinatura pendente de ativação. Conclua o pagamento para acessar.'
      return res.status(402).send({ message: msg, subscriptionStatus: policy.status || 'PENDING' })
    }
    req.tenantContext = tenant
    RequestContext.run(tenant, () => next())
  }
}
