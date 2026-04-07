import { Injectable } from '@nestjs/common'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Injectable()
export class AppointmentsService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}

  list() {
    return this.prismaTenant.getClient().appointment.findMany({ include: { patient: true }, orderBy: { startTime: 'asc' } })
  }
  get(id: string) {
    return this.prismaTenant.getClient().appointment.findUnique({ where: { id }, include: { patient: true } })
  }
  create(data: any) {
    return this.prismaTenant.getClient().appointment.create({ data })
  }
  update(id: string, data: any) {
    return this.prismaTenant.getClient().appointment.update({ where: { id }, data })
  }
  remove(id: string) {
    return this.prismaTenant.getClient().appointment.delete({ where: { id } })
  }
}
