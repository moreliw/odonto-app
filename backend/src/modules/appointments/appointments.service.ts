import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AppointmentStatus } from '@prisma/client-tenant'
import { randomUUID } from 'crypto'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { RequestContext } from '../tenancy/request-context'
import { buildWhatsappUrl, normalizeWhatsappPhone } from './whatsapp-link'

type Requester = { userId: string; email?: string; role: string }

const DENTIST_SELECT = { id: true, name: true }
const INCLUDE = { patient: true, dentist: { select: DENTIST_SELECT } }

function formatDateTime(d: Date) {
  return d.toLocaleString('pt-BR', {
    timeZone: process.env.APP_TIMEZONE?.trim() || 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}

  /** Dentista só vê a própria agenda, mesmo que tente passar outro dentistId na query. */
  private scopedDentistId(requester: Requester, requestedDentistId?: string) {
    if (requester.role === 'DENTIST') return requester.userId
    return requestedDentistId || undefined
  }

  private publicAppUrl() {
    const explicit = process.env.PUBLIC_APP_URL?.trim()
    if (explicit) return explicit.replace(/\/+$/, '')
    const publicDomain = process.env.PUBLIC_DOMAIN?.trim()
    if (publicDomain) return `https://${publicDomain}`.replace(/\/+$/, '')
    return 'http://localhost:4200'
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
    data: { patientId: string; dentistId?: string; dentistName?: string; startTime: Date; endTime: Date; status: AppointmentStatus; notes?: string }
  ) {
    const dentistId = requester.role === 'DENTIST' ? requester.userId : data.dentistId || null
    // Nome livre só faz sentido quando não há conta vinculada — evita ambiguidade entre os dois.
    const dentistName = dentistId ? null : data.dentistName?.trim() || null
    return this.prismaTenant.getClient().appointment.create({
      data: {
        ...data,
        dentistId,
        dentistName,
        confirmationToken: randomUUID(),
        createdByName: requester.email?.trim() || 'Sistema',
        updatedByName: requester.email?.trim() || 'Sistema'
      },
      include: INCLUDE
    })
  }

  async update(requester: Requester, id: string, data: Record<string, unknown>) {
    await this.assertOwnedByDentistOrAdmin(requester, id)
    data.updatedByName = requester.email?.trim() || 'Sistema'
    // Dentista não pode reatribuir a própria consulta para outro colega.
    if (requester.role === 'DENTIST') {
      delete data.dentistId
      delete data.dentistName
    } else {
      // Conta vinculada e nome livre são mutuamente exclusivos.
      if (data.dentistId) data.dentistName = null
      else if (data.dentistName) data.dentistId = null
    }
    // Uma alteração manual deve registrar quando a decisão foi tomada. Voltar para pendente
    // limpa a resposta anterior, mas preserva o histórico de quando a mensagem foi preparada.
    if (data.confirmationStatus !== undefined) {
      data.confirmationRespondedAt = data.confirmationStatus === 'PENDING' ? null : new Date()
    }
    // Reagendar (horário realmente diferente) invalida uma confirmação já dada — o paciente
    // precisa reconfirmar o novo horário. O formulário sempre reenvia startTime/endTime mesmo
    // quando só o status ou as notas mudaram, então comparamos com o valor atual em vez de só
    // checar se o campo veio no corpo da requisição.
    if (await this.didTimeChange(id, data)) {
      data.confirmationStatus = 'PENDING'
      data.confirmationSentAt = null
      data.confirmationRespondedAt = null
    }
    return this.prismaTenant.getClient().appointment.update({ where: { id }, data, include: INCLUDE })
  }

  private async didTimeChange(id: string, data: Record<string, unknown>) {
    if (data.startTime === undefined && data.endTime === undefined) return false
    const current = await this.prismaTenant.getClient().appointment.findUnique({ where: { id }, select: { startTime: true, endTime: true } })
    if (!current) return false
    const newStart = data.startTime !== undefined ? new Date(data.startTime as string | Date).getTime() : current.startTime.getTime()
    const newEnd = data.endTime !== undefined ? new Date(data.endTime as string | Date).getTime() : current.endTime.getTime()
    return newStart !== current.startTime.getTime() || newEnd !== current.endTime.getTime()
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

  /**
   * Prepara uma conversa gratuita no WhatsApp com a mensagem de confirmação preenchida.
   * O envio continua manual: a pessoa usuária revisa a mensagem e toca em "Enviar" no WhatsApp.
   */
  async prepareWhatsappConfirmation(requester: Requester, id: string) {
    await this.assertOwnedByDentistOrAdmin(requester, id)
    const prisma = this.prismaTenant.getClient()
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: INCLUDE })
    if (!appointment) throw new NotFoundException('Consulta não encontrada')
    if (appointment.status === 'CANCELLED') throw new BadRequestException('Não é possível confirmar uma consulta cancelada.')
    if (!appointment.patient.phone) throw new BadRequestException('O paciente não possui telefone cadastrado.')

    const phone = normalizeWhatsappPhone(appointment.patient.phone)
    if (!phone) throw new BadRequestException('O telefone do paciente é inválido. Corrija o cadastro e tente novamente.')

    const ctx = RequestContext.get()
    if (!ctx?.subdomain) throw new BadRequestException('Não foi possível identificar a clínica para gerar o link.')

    const token = appointment.confirmationToken || randomUUID()
    const confirmationLink = `${this.publicAppUrl()}/confirmar/${ctx.subdomain}/${token}`
    const shareLink = `${this.publicAppUrl()}/c/${ctx.subdomain}/${token}`
    const dentistName = appointment.dentist?.name || appointment.dentistName || null
    const clinicName = ctx.name || 'sua clínica'
    const when = formatDateTime(appointment.startTime)
    const message =
      `Olá, *${appointment.patient.name}*! Sua consulta na ${clinicName}` +
      `${dentistName ? ` com *${dentistName}*` : ''} está marcada para *${when}*.\n\n` +
      `Confirme sua presença ou avise se não puder comparecer pelo link:\n${shareLink}`

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        confirmationToken: token,
        // Não existe callback quando o envio é manual; registramos o momento em que a conversa foi preparada.
        confirmationSentAt: new Date(),
        confirmationStatus: appointment.confirmationStatus === 'DECLINED' ? 'PENDING' : appointment.confirmationStatus,
        updatedByName: requester.email?.trim() || 'Sistema'
      },
      include: INCLUDE
    })

    return { ok: true, whatsappUrl: buildWhatsappUrl(phone, message), message, link: shareLink, confirmationLink, appointment: updated }
  }
}
