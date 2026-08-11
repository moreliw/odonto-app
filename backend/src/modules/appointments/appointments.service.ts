import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { AppointmentStatus } from '@prisma/client-tenant'
import { randomUUID } from 'crypto'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { RequestContext } from '../tenancy/request-context'
import { MailerService } from '../mailer/mailer.service'

type Requester = { userId: string; role: string }

const DENTIST_SELECT = { id: true, name: true }
const INCLUDE = { patient: true, dentist: { select: DENTIST_SELECT } }

function formatDateTime(d: Date) {
  return d.toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly prismaTenant: TenantPrismaService, private readonly mailer: MailerService) {}

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

  private confirmationEmailHtml(input: { patientName: string; dentistName: string | null; clinicName: string; when: string; link: string }) {
    return `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#0f172a;">Olá, ${input.patientName}!</h2>
        <p style="color:#334155;font-size:15px;line-height:1.6;">
          Você tem uma consulta agendada em <strong>${input.clinicName}</strong>${input.dentistName ? ` com <strong>${input.dentistName}</strong>` : ''}:
        </p>
        <p style="background:#eff6ff;color:#1d4ed8;padding:14px 16px;border-radius:10px;font-size:15px;font-weight:600;text-transform:capitalize;">
          ${input.when}
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.6;">Pode confirmar sua presença?</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="${input.link}" style="background:#2563eb;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">
            Responder confirmação
          </a>
        </p>
        <p style="color:#94a3b8;font-size:12.5px;line-height:1.5;">Se o botão não funcionar, copie e cole este link no navegador:<br/>${input.link}</p>
      </div>
    `
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
      data: { ...data, dentistId, dentistName, confirmationToken: randomUUID() },
      include: INCLUDE
    })
  }

  async update(requester: Requester, id: string, data: Record<string, unknown>) {
    await this.assertOwnedByDentistOrAdmin(requester, id)
    // Dentista não pode reatribuir a própria consulta para outro colega.
    if (requester.role === 'DENTIST') {
      delete data.dentistId
      delete data.dentistName
    } else {
      // Conta vinculada e nome livre são mutuamente exclusivos.
      if (data.dentistId) data.dentistName = null
      else if (data.dentistName) data.dentistId = null
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

  /** Envia (ou reenvia) o link público de confirmação por e-mail. Sempre devolve o link, mesmo sem e-mail cadastrado, para cópia manual. */
  async sendConfirmation(requester: Requester, id: string) {
    await this.assertOwnedByDentistOrAdmin(requester, id)
    const prisma = this.prismaTenant.getClient()
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: INCLUDE })
    if (!appointment) throw new NotFoundException('Consulta não encontrada')
    if (appointment.status === 'CANCELLED') throw new BadRequestException('Não é possível confirmar uma consulta cancelada.')

    const ctx = RequestContext.get()
    if (!ctx?.subdomain) throw new BadRequestException('Não foi possível identificar a clínica para gerar o link.')

    const token = appointment.confirmationToken || randomUUID()
    const link = `${this.publicAppUrl()}/confirmar/${ctx.subdomain}/${token}`

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        confirmationToken: token,
        confirmationSentAt: new Date(),
        // Reabre para nova resposta se o paciente havia recusado antes.
        confirmationStatus: appointment.confirmationStatus === 'DECLINED' ? 'PENDING' : appointment.confirmationStatus
      },
      include: INCLUDE
    })

    let emailed = false
    if (appointment.patient.email) {
      await this.mailer.send(
        appointment.patient.email,
        `Confirme sua consulta — ${ctx.name || 'Clínica'}`,
        this.confirmationEmailHtml({
          patientName: appointment.patient.name,
          dentistName: appointment.dentist?.name || appointment.dentistName || null,
          clinicName: ctx.name || 'sua clínica',
          when: formatDateTime(appointment.startTime),
          link
        })
      )
      emailed = true
    }

    return { ok: true, emailed, link, appointment: updated }
  }

  /** Dispara confirmações para todas as consultas agendadas no período que ainda não receberam pedido de confirmação. */
  async sendConfirmationsBulk(requester: Requester, opts: { from?: string; to?: string }) {
    const prisma = this.prismaTenant.getClient()
    const dentistId = this.scopedDentistId(requester, undefined)
    const where: Record<string, unknown> = { status: 'SCHEDULED', confirmationSentAt: null }
    if (dentistId) where.dentistId = dentistId
    if (opts.from || opts.to) {
      where.startTime = {
        ...(opts.from ? { gte: new Date(opts.from) } : {}),
        ...(opts.to ? { lt: new Date(opts.to) } : {})
      }
    }
    const appointments = await prisma.appointment.findMany({ where, include: INCLUDE })

    let sent = 0
    let skippedNoEmail = 0
    for (const appt of appointments) {
      if (!appt.patient.email) {
        skippedNoEmail++
        continue
      }
      await this.sendConfirmation(requester, appt.id)
      sent++
    }
    return { ok: true, sent, skippedNoEmail, total: appointments.length }
  }
}
