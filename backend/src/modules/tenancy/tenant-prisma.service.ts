import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import type { Request } from 'express'
import { PrismaClient as TenantPrisma } from '@prisma/client-tenant'
import { RequestContext } from './request-context'

/**
 * Um cliente por banco de clínica, compartilhado entre as requisições.
 * Criar um PrismaClient por request mantém um pool inteiro aberto e esgota o
 * max_connections do PostgreSQL depois de poucos acessos ao dashboard.
 */
const tenantClients = new Map<string, TenantPrisma>()

function pooledConnectionString(connectionString: string) {
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) return connectionString
  const url = new URL(connectionString)
  if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '2')
  if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '10')
  return url.toString()
}

function sharedTenantClient(connectionString: string) {
  const pooledUrl = pooledConnectionString(connectionString)
  const cached = tenantClients.get(pooledUrl)
  if (cached) return cached

  const client = new TenantPrisma({ datasources: { db: { url: pooledUrl } } })
  tenantClients.set(pooledUrl, client)
  return client
}

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
    this.client = sharedTenantClient(ctx.connectionString)
    return this.client
  }
}
