import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client-tenant'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@Injectable()
export class RecordsService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}
  async create(patientId: string, content: unknown, actor?: string) {
    const normalized = typeof content === 'string'
      ? { text: content }
      : content && typeof content === 'object'
        ? content as Prisma.InputJsonValue
        : null
    if (!normalized) throw new BadRequestException('O conteúdo do prontuário é obrigatório')
    const auditName = actor?.trim() || 'Sistema'
    return this.prismaTenant.getClient().record.create({
      data: { patientId, content: normalized, createdByName: auditName, updatedByName: auditName }
    })
  }
  async list(patientId: string) {
    const records = await this.prismaTenant.getClient().record.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    })

    return records.map((record) => ({ ...record, content: this.parseContent(record.content) }))
  }

  private parseContent(content: Prisma.JsonValue): Prisma.JsonValue {
    if (typeof content !== 'string') return content
    try {
      return JSON.parse(content) as Prisma.JsonValue
    } catch {
      return { text: content }
    }
  }
}
