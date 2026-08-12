import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

type Requester = { userId: string; email?: string; role: string }

@Injectable()
export class PatientsService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}

  list(requester: Requester) {
    if (requester.role === 'DENTIST') {
      return this.prismaTenant.getClient().patient.findMany({
        where: { appointments: { some: { dentistId: requester.userId } } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      })
    }
    return this.prismaTenant.getClient().patient.findMany({ orderBy: { createdAt: 'desc' } })
  }
  async get(requester: Requester, id: string) {
    const patient = requester.role === 'DENTIST'
      ? await this.prismaTenant.getClient().patient.findFirst({
          where: { id, appointments: { some: { dentistId: requester.userId } } },
          select: { id: true, name: true }
        })
      : await this.prismaTenant.getClient().patient.findUnique({ where: { id } })
    if (!patient) throw new NotFoundException('Paciente não encontrado')
    return patient
  }
  create(requester: Requester, data: any) {
    this.assertCanManage(requester)
    const auditName = requester.email?.trim() || 'Sistema'
    return this.prismaTenant.getClient().patient.create({ data: { ...data, createdByName: auditName, updatedByName: auditName } })
  }
  update(requester: Requester, id: string, data: any) {
    this.assertCanManage(requester)
    return this.prismaTenant.getClient().patient.update({ where: { id }, data: { ...data, updatedByName: requester.email?.trim() || 'Sistema' } })
  }
  remove(requester: Requester, id: string) {
    this.assertCanManage(requester)
    return this.prismaTenant.getClient().patient.delete({ where: { id } })
  }

  private assertCanManage(requester: Requester) {
    if (requester.role === 'DENTIST') {
      throw new ForbiddenException('Dentistas não podem acessar ou alterar o cadastro geral de pacientes.')
    }
  }
}
