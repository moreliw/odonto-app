import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import type { Request } from 'express'
import { PrismaClient as TenantPrisma } from '@prisma/client-tenant'
import { RequestContext } from './request-context'

@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  private client: TenantPrisma | null = null

  constructor(@Inject(REQUEST) private readonly req: Request) {}

  private resolveContext() {
    return this.req.tenantContext ?? RequestContext.get() ?? null
  }

  getClient() {
    if (this.client) return this.client
    const ctx = this.resolveContext()
    if (!ctx) throw new Error('No tenant context')
    this.client = new TenantPrisma({ datasources: { db: { url: ctx.connectionString } } })
    return this.client
  }
}
