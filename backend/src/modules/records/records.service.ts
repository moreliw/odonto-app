import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client-tenant'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

type Requester = { userId: string; email?: string; name?: string; role: string }

@Injectable()
export class RecordsService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}
  async create(requester: Requester, patientId: string, content: unknown) {
    await this.assertPatientAccess(requester, patientId)
    const normalized = typeof content === 'string'
      ? { text: content }
      : content && typeof content === 'object'
        ? { ...(content as Record<string, unknown>), schemaVersion: 2 } as Prisma.InputJsonObject
        : null
    if (!normalized) throw new BadRequestException('O conteúdo do prontuário é obrigatório')
    const serialized = JSON.stringify(normalized)
    if (serialized.length > 100_000) {
      throw new BadRequestException('O registro clínico excede o limite de 100 KB. Anexe arquivos separadamente.')
    }
    const auditName = await this.actorName(requester)
    return this.prismaTenant.getClient().record.create({
      data: { patientId, content: normalized, createdByName: auditName, updatedByName: auditName }
    })
  }
  async list(requester: Requester, patientId: string) {
    await this.assertPatientAccess(requester, patientId)
    const records = await this.prismaTenant.getClient().record.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    })

    return records.map((record) => ({ ...record, content: this.parseContent(record.content) }))
  }

  private async assertPatientAccess(requester: Requester, patientId: string) {
    if (requester.role !== 'DENTIST') return
    const appointment = await this.prismaTenant.getClient().appointment.findFirst({
      where: { patientId, dentistId: requester.userId },
      select: { id: true }
    })
    if (!appointment) {
      throw new ForbiddenException('Você só pode acessar prontuários de pacientes vinculados à sua agenda.')
    }
  }

  private parseContent(content: Prisma.JsonValue): Prisma.JsonValue {
    if (typeof content !== 'string') return content
    try {
      return JSON.parse(content) as Prisma.JsonValue
    } catch {
      return { text: content }
    }
  }

  private async actorName(requester: Requester) {
    const user = await this.prismaTenant.getClient().user.findUnique({ where: { id: requester.userId }, select: { name: true } })
    return user?.name?.trim() || requester.name?.trim() || 'Sistema'
  }
}
