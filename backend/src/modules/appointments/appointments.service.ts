import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AppointmentStatus } from '@prisma/client-tenant'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

type Requester = { userId: string; role: string }

const DENTIST_SELECT = { id: true, name: true }
const INCLUDE = { patient: true, dentist: { select: DENTIST_SELECT } }

@Injectable()
export class AppointmentsService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}

  /** Dentista só vê a própria agenda, mesmo que tente passar outro dentistId na query. */
  private scopedDentistId(requester: Requester, requestedDentistId?: string) {
    if (requester.role === 'DENTIST') return requester.userId
    return requestedDentistId || undefined
  }

  list(opts: { requester: Requester; dentistId?: string; from?: string; to?: string }) {
    const where: Record<string, unknown> = {}
    const dentistId = this.scopedDentistId(opts.requester, opts.dentistId)
    if (dentistId) where.dentistId = dentistId
    if (opts.from || opts.to) {
      where.startTime = {
        ...(opts.from ? { gte: new Date(opts.from) } : {}),
        ...(opts.to ? { lt: new Date(opts.to) } : {})
      }
    }
    return this.prismaTenant.getClient().appointment.findMany({ where, include: INCLUDE, orderBy: { startTime: 'asc' } })
  }

  get(id: string) {
    return this.prismaTenant.getClient().appointment.findUnique({ where: { id }, include: INCLUDE })
  }

  create(
    requester: Requester,
    data: { patientId: string; dentistId?: string; startTime: Date; endTime: Date; status: AppointmentStatus; notes?: string }
  ) {
    const dentistId = requester.role === 'DENTIST' ? requester.userId : data.dentistId || null
    return this.prismaTenant.getClient().appointment.create({
      data: { ...data, dentistId },
      include: INCLUDE
    })
  }

  async update(requester: Requester, id: string, data: Record<string, unknown>) {
    await this.assertOwnedByDentistOrAdmin(requester, id)
    // Dentista não pode reatribuir a própria consulta para outro colega.
    if (requester.role === 'DENTIST') delete data.dentistId
    return this.prismaTenant.getClient().appointment.update({ where: { id }, data, include: INCLUDE })
  }

  async remove(requester: Requester, id: string) {
    await this.assertOwnedByDentistOrAdmin(requester, id)
    return this.prismaTenant.getClient().appointment.delete({ where: { id } })
  }

  private async assertOwnedByDentistOrAdmin(requester: Requester, id: string) {
    if (requester.role !== 'DENTIST') return
    const appointment = await this.prismaTenant.getClient().appointment.findUnique({ where: { id }, select: { dentistId: true } })
    if (!appointment) throw new NotFoundException('Consulta não encontrada')
    if (appointment.dentistId !== requester.userId) throw new ForbiddenException('Você só pode gerenciar as próprias consultas')
  }
}
