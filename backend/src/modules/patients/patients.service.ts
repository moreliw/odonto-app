import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client-tenant'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { AccessControlService } from '../access-control/access-control.service'

type Requester = { userId: string; email?: string; name?: string; role: string }

@Injectable()
export class PatientsService {
  constructor(private readonly prismaTenant: TenantPrismaService, private readonly access: AccessControlService) {}

  async list(requester: Requester) {
    if (requester.role === 'DENTIST' && !(await this.access.hasPermission(requester as any, 'PATIENTS_MANAGE'))) {
      return this.prismaTenant.getClient().patient.findMany({
        where: { appointments: { some: { dentistId: requester.userId } } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      })
    }
    return this.prismaTenant.getClient().patient.findMany({ orderBy: { createdAt: 'desc' } })
  }
  async get(requester: Requester, id: string) {
    const restrictedDentist = requester.role === 'DENTIST' && !(await this.access.hasPermission(requester as any, 'PATIENTS_MANAGE'))
    const patient = restrictedDentist
      ? await this.prismaTenant.getClient().patient.findFirst({
          where: { id, appointments: { some: { dentistId: requester.userId } } },
          select: { id: true, name: true }
        })
      : await this.prismaTenant.getClient().patient.findUnique({ where: { id } })
    if (!patient) throw new NotFoundException('Paciente não encontrado')
    return patient
  }
  async workspace(requester: Requester, id: string) {
    await this.assertPatientAccess(requester, id)
    const prisma = this.prismaTenant.getClient()
    const [patient, appointments, records, files, professionals, invoices] = await Promise.all([
      prisma.patient.findUnique({ where: { id } }),
      prisma.appointment.findMany({
        where: { patientId: id },
        include: { dentist: { select: { id: true, name: true } } },
        orderBy: { startTime: 'desc' }
      }),
      prisma.record.findMany({ where: { patientId: id }, orderBy: { createdAt: 'desc' } }),
      prisma.file.findMany({ where: { patientId: id }, orderBy: { createdAt: 'desc' } }),
      prisma.user.findMany({ where: { role: 'DENTIST', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      (await this.access.hasPermission(requester as any, 'FINANCE_VIEW'))
        ? prisma.invoice.findMany({
            where: { patientId: id },
            include: { items: true, payments: true, dentist: { select: { id: true, name: true } } },
            orderBy: { issuedAt: 'desc' }
          })
        : Promise.resolve([])
    ])
    if (!patient) throw new NotFoundException('Paciente não encontrado')

    return {
      patient,
      appointments,
      records: records.map(record => ({ ...record, content: this.parseContent(record.content) })),
      files,
      professionals,
      invoices: invoices.map((invoice: any) => ({
        ...invoice,
        amount: Number(invoice.amount),
        discount: Number(invoice.discount),
        items: invoice.items.map((item: any) => ({ ...item, unitPrice: Number(item.unitPrice), total: Number(item.total) })),
        payments: invoice.payments.map((payment: any) => ({ ...payment, amount: Number(payment.amount) }))
      }))
    }
  }
  async create(requester: Requester, data: any) {
    const auditName = await this.actorName(requester)
    return this.prismaTenant.getClient().patient.create({ data: { ...data, createdByName: auditName, updatedByName: auditName } })
  }
  async update(requester: Requester, id: string, data: any) {
    await this.assertPatientAccess(requester, id)
    return this.prismaTenant.getClient().patient.update({ where: { id }, data: { ...data, updatedByName: await this.actorName(requester) } })
  }
  async remove(requester: Requester, id: string) {
    await this.assertPatientAccess(requester, id)
    return this.prismaTenant.getClient().patient.delete({ where: { id } })
  }

  private async assertPatientAccess(requester: Requester, patientId: string) {
    const prisma = this.prismaTenant.getClient()
    const restrictedDentist = requester.role === 'DENTIST' && !(await this.access.hasPermission(requester as any, 'PATIENTS_MANAGE'))
    const patient = restrictedDentist
      ? await prisma.patient.findFirst({ where: { id: patientId, appointments: { some: { dentistId: requester.userId } } }, select: { id: true } })
      : await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } })
    if (!patient) throw new NotFoundException('Paciente não encontrado')
  }

  private async actorName(requester: Requester) {
    const user = await this.prismaTenant.getClient().user.findUnique({ where: { id: requester.userId }, select: { name: true } })
    return user?.name?.trim() || requester.name?.trim() || 'Sistema'
  }

  private parseContent(content: Prisma.JsonValue): Prisma.JsonValue {
    if (typeof content !== 'string') return content
    try { return JSON.parse(content) as Prisma.JsonValue }
    catch { return { text: content } }
  }
}
