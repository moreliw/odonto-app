import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { MasterPrismaService } from '../tenancy/master-prisma.service'
import { RequestContext } from '../tenancy/request-context'
import { normalizeWhatsappPhone } from './phone'

export type WhatsappSendReason = 'SENT' | 'NOT_CONFIGURED' | 'INVALID_PHONE' | 'PROVIDER_ERROR'
export type WhatsappSendResult = { sent: boolean; reason: WhatsappSendReason }

/**
 * Envia mensagens de WhatsApp pelo Twilio. As credenciais pertencem à plataforma, enquanto o
 * remetente aprovado é configurado separadamente por clínica. Para iniciar conversas fora da
 * janela de 24 horas, usa um Content Template aprovado pela Meta com estas variáveis, na ordem:
 * {{1}} nome do paciente, {{2}} data/hora da consulta, {{3}} link de confirmação.
 */
@Injectable()
export class WhatsappService {
  private readonly log = new Logger(WhatsappService.name)

  constructor(private readonly master: MasterPrismaService) {}

  private providerConfigured() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim())
  }

  getSettings() {
    const ctx = RequestContext.get()
    if (!ctx) throw new BadRequestException('Clínica não identificada.')
    const number = ctx.whatsappNumber || null
    const providerConfigured = this.providerConfigured()
    const templateConfigured = Boolean(process.env.TWILIO_WHATSAPP_CONTENT_SID?.trim())
    return {
      number,
      providerConfigured,
      templateConfigured,
      ready: Boolean(number && providerConfigured && templateConfigured)
    }
  }

  async updateSettings(rawNumber: string, actorEmail: string) {
    const ctx = RequestContext.get()
    if (!ctx) throw new BadRequestException('Clínica não identificada.')

    const number = rawNumber.trim() ? normalizeWhatsappPhone(rawNumber) : null
    if (rawNumber.trim() && !number) {
      throw new BadRequestException('Informe um telefone válido com DDD. Exemplo: +55 27 99999-9999.')
    }

    await this.master.$transaction([
      this.master.tenant.update({ where: { id: ctx.id }, data: { whatsappNumber: number } }),
      this.master.masterAuditLog.create({
        data: {
          actorEmail,
          action: 'CLINIC_WHATSAPP_UPDATED',
          tenantId: ctx.id,
          targetType: 'TENANT',
          targetId: ctx.id,
          metadata: { configured: Boolean(number), number }
        }
      })
    ])
    ctx.whatsappNumber = number

    return this.getSettings()
  }

  async sendConfirmationMessage(
    phoneRaw: string,
    variables: [string, string, string],
    freeformText: string
  ): Promise<WhatsappSendResult> {
    const ctx = RequestContext.get()
    const fromPhone = ctx?.whatsappNumber ? normalizeWhatsappPhone(ctx.whatsappNumber) : null
    if (!this.providerConfigured() || !fromPhone) return { sent: false, reason: 'NOT_CONFIGURED' }

    const phone = normalizeWhatsappPhone(phoneRaw)
    if (!phone) return { sent: false, reason: 'INVALID_PHONE' }

    const sid = process.env.TWILIO_ACCOUNT_SID!.trim()
    const token = process.env.TWILIO_AUTH_TOKEN!.trim()
    const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID?.trim()
    const params = new URLSearchParams()
    params.set('From', `whatsapp:${fromPhone}`)
    params.set('To', `whatsapp:${phone}`)
    if (contentSid) {
      params.set('ContentSid', contentSid)
      params.set('ContentVariables', JSON.stringify({ '1': variables[0], '2': variables[1], '3': variables[2] }))
    } else {
      params.set('Body', freeformText)
    }

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
        },
        body: params.toString()
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        this.log.warn(`Twilio WhatsApp send failed for tenant ${ctx?.id || 'unknown'} (${res.status}): ${detail.slice(0, 300)}`)
        return { sent: false, reason: 'PROVIDER_ERROR' }
      }
      return { sent: true, reason: 'SENT' }
    } catch (error) {
      this.log.warn(`Twilio WhatsApp send error for tenant ${ctx?.id || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`)
      return { sent: false, reason: 'PROVIDER_ERROR' }
    }
  }
}
