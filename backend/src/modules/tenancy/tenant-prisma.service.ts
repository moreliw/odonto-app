import { Injectable, Scope } from '@nestjs/common'
import { PrismaClient as TenantPrisma } from '@prisma/client-tenant'
import { RequestContext } from './request-context'

@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  private client: TenantPrisma | null = null
  getClient() {
    if (this.client) return this.client
    const ctx = RequestContext.get()
    if (!ctx) throw new Error('No tenant context')
    this.client = new TenantPrisma({ datasources: { db: { url: ctx.connectionString } } })
    return this.client
  }
}
