import { Injectable } from '@nestjs/common'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Injectable()
export class PatientsService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}

  list() {
    return this.prismaTenant.getClient().patient.findMany({ orderBy: { createdAt: 'desc' } })
  }
  get(id: string) {
    return this.prismaTenant.getClient().patient.findUnique({ where: { id } })
  }
  create(data: any) {
    return this.prismaTenant.getClient().patient.create({ data })
  }
  update(id: string, data: any) {
    return this.prismaTenant.getClient().patient.update({ where: { id }, data })
  }
  remove(id: string) {
    return this.prismaTenant.getClient().patient.delete({ where: { id } })
  }
}
