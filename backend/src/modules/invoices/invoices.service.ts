import { Injectable } from '@nestjs/common'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Injectable()
export class InvoicesService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}
  list() {
    const prisma: any = this.prismaTenant.getClient()
    return prisma.invoice.findMany({ include: { patient: true }, orderBy: { issuedAt: 'desc' } })
  }
  create(data: any) {
    const prisma: any = this.prismaTenant.getClient()
    return prisma.invoice.create({ data })
  }
}
