import { Injectable } from '@nestjs/common'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Injectable()
export class RecordsService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}
  async create(patientId: string, content: any) {
    const normalized = typeof content === 'string' ? content : JSON.stringify(content)
    return this.prismaTenant.getClient().record.create({ data: { patientId, content: normalized } })
  }
  async list(patientId: string) {
    return this.prismaTenant.getClient().record.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } })
  }
}
