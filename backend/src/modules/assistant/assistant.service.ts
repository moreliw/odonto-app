import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { Prisma } from '@prisma/client-tenant'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { AccessControlService } from '../access-control/access-control.service'
import { PermissionKey, TenantRole } from '../access-control/permissions'
import { buildWhatsappUrl, normalizeWhatsappPhone } from '../appointments/whatsapp-link'
import { AiClient } from './ai-client'
import { addMonths, localDate, parseClinicDate, readJsonObject } from './assistant-utils'
import { generateWeekly, weeklyData } from './weekly-summary'

type Actor = { userId: string; name?: string; email?: string; role: TenantRole }
export type ReviewedAppointment = { patientId: string; dentistId?: string; startLocal: string; endLocal: string; notes?: string }
const photoSchema = z.object({ appointments: z.array(z.object({
  patientName: z.string().max(160), startLocal: z.string().max(16), endLocal: z.string().max(16),
  procedure: z.string().max(500), warning: z.string().max(500)
})).max(40), warnings: z.array(z.string().max(500)).max(20) })
const noteSchema = z.object({ text: z.string().min(1).max(20_000), warnings: z.array(z.string().max(500)).max(20) })
const messageSchema = z.object({ message: z.string().min(1).max(2000) })

@Injectable()
export class AssistantService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly ai: AiClient,
    private readonly access: AccessControlService
  ) {}

  private scope(actor: Actor) {
    return actor.role === 'DENTIST' ? { appointments: { some: { dentistId: actor.userId } } } : {}
  }

  private async patient(actor: Actor, id: string) {
    const patient = await this.tenant.getClient().patient.findFirst({ where: { id, ...this.scope(actor) } })
    if (!patient) throw new NotFoundException('Paciente não encontrado ou sem acesso.')
    return patient
  }

  private async draft(actor: Actor, id: string, kind?: string) {
    const draft = await this.tenant.getClient().aiDraft.findFirst({ where: { id, createdById: actor.userId, ...(kind ? { kind } : {}) } })
    if (!draft) throw new NotFoundException('Rascunho não encontrado.')
    if (draft.approvedAt) throw new ConflictException('Este rascunho já foi aprovado. Atualize a página para consultar o resultado.')
    if (draft.createdAt.getTime() < Date.now() - 86400_000) throw new BadRequestException('Este rascunho expirou. Gere outro para revisar dados atualizados.')
    return draft
  }

  private saveDraft(actor: Actor, kind: string, content: unknown, targetId?: string) {
    return this.tenant.getClient().aiDraft.create({ data: { kind, createdById: actor.userId, targetId, content: content as Prisma.InputJsonValue } })
  }

  async workspace(actor: Actor) {
    const permissions = await this.access.effectiveFor(actor)
    const has = (p: PermissionKey) => permissions.includes(p)
    const db = this.tenant.getClient()
    const patients = has('PATIENTS_VIEW') ? await db.patient.findMany({ where: this.scope(actor), select: { id: true, name: true }, orderBy: { name: 'asc' } }) : []
    const professionals = has('APPOINTMENTS_MANAGE') && actor.role !== 'DENTIST'
      ? await db.user.findMany({ where: { role: 'DENTIST', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : []
    const estimates = has('FINANCE_VIEW') ? await db.treatmentEstimate.findMany({
      include: { patient: { select: { id: true, name: true } } }, orderBy: { proposedAt: 'asc' }, take: 200
    }) : []
    // Also expose proposed treatment plans already registered in the clinical record.
    const proposedPlans = has('FINANCE_VIEW') && has('RECORDS_VIEW') ? (await db.record.findMany({
      where: { content: { path: ['type'], equals: 'TREATMENT_PLAN' } },
      include: { patient: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 200
    })).filter(row => readJsonObject(row.content).status === 'PROPOSED').map(row => ({
      id: row.id, patient: row.patient, title: String(readJsonObject(row.content).title || 'Plano de tratamento'),
      proposedAt: row.createdAt, source: 'record'
    })) : []
    const recalls = has('PATIENTS_VIEW') && has('APPOINTMENTS_VIEW') ? await this.recalls(actor) : []
    const settings = await db.aiSettings.findUnique({ where: { id: 'default' } })
    return { ai: this.ai.configuration(), permissions, patients, professionals, estimates, proposedPlans, recalls, weeklyEnabled: settings?.weeklyEnabled || false, today: localDate(), timezone: 'America/Sao_Paulo' }
  }

  async photo(actor: Actor, file: Express.Multer.File, referenceDate: string) {
    if (actor.role === 'DENTIST') throw new ForbiddenException('A recepção ou administração deve importar a agenda.')
    parseClinicDate(`${referenceDate}T00:00`)
    const result = await this.ai.json(
      'Leia SOMENTE os agendamentos visíveis. Retorne {"appointments":[{"patientName":"nome visível ou vazio","startLocal":"YYYY-MM-DDTHH:mm ou vazio","endLocal":"YYYY-MM-DDTHH:mm ou vazio","procedure":"texto visível","warning":"dúvidas, inclusive duração não informada"}],"warnings":["dúvidas gerais"]}. Use a data de referência apenas se a imagem não trouxer outra data explícita. Não invente duração, paciente ou horário; use vazio quando não legível. Máximo 40 linhas.',
      { referenceDate, timezone: 'America/Sao_Paulo' }, photoSchema, file
    )
    return this.saveDraft(actor, 'PHOTO', result)
  }

  async approveAppointments(actor: Actor, draftId: string, rows: ReviewedAppointment[]) {
    if (actor.role === 'DENTIST') throw new ForbiddenException('A recepção ou administração deve importar a agenda.')
    await this.draft(actor, draftId, 'PHOTO')
    if (!rows.length || rows.length > 40) throw new BadRequestException('Revise de 1 a 40 horários.')
    const db = this.tenant.getClient()
    const prepared = rows.map(row => {
      const startTime = parseClinicDate(row.startLocal)
      const endTime = parseClinicDate(row.endLocal)
      if (endTime <= startTime || endTime.getTime() - startTime.getTime() > 12 * 3600_000) throw new BadRequestException('O fim de cada consulta deve ser posterior ao início, com duração de até 12 horas.')
      return { patientId: row.patientId, dentistId: row.dentistId || null, startTime, endTime, notes: row.notes?.trim() || null }
    })
    return db.$transaction(async tx => {
      // Serialize reviewed imports per clinic, including two requests approving the same draft.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('assistant-appointments'))::text`
      const claimed = await tx.aiDraft.updateMany({ where: { id: draftId, createdById: actor.userId, approvedAt: null }, data: { approvedAt: new Date() } })
      if (!claimed.count) throw new ConflictException('Esta importação já foi confirmada.')
      for (const row of prepared) {
        const patient = await tx.patient.findUnique({ where: { id: row.patientId }, select: { id: true } })
        if (!patient) throw new BadRequestException('Vincule cada linha a um paciente cadastrado.')
        if (row.dentistId && !await tx.user.findFirst({ where: { id: row.dentistId, role: 'DENTIST', active: true }, select: { id: true } })) throw new BadRequestException('Escolha um dentista ativo.')
        const overlapping = await tx.appointment.findFirst({ where: {
          status: { not: 'CANCELLED' }, startTime: { lt: row.endTime }, endTime: { gt: row.startTime },
          OR: [{ patientId: row.patientId }, ...(row.dentistId ? [{ dentistId: row.dentistId }] : [])]
        }, select: { id: true } })
        if (overlapping) throw new ConflictException('Há conflito de horário para um paciente ou profissional. Nenhuma consulta desta importação foi salva; revise os horários.')
        await tx.appointment.create({ data: { ...row, status: 'SCHEDULED', confirmationToken: randomUUID(), createdByName: actor.name || 'Equipe', updatedByName: actor.name || 'Equipe' } })
      }
      return { count: prepared.length }
    }, { timeout: 60_000, maxWait: 10_000 })
  }

  async evolution(actor: Actor, patientId: string, file?: Express.Multer.File, dictation?: string) {
    await this.patient(actor, patientId)
    const transcript = file ? await this.ai.transcribe(file) : dictation?.trim() || ''
    if (!transcript || transcript.length > 20_000) throw new BadRequestException('Grave ou informe um ditado de até 20 mil caracteres.')
    const result = await this.ai.json(
      'Organize o ditado como uma evolução odontológica clara, sem acrescentar informação ausente. Não prescreva nem decida conduta. Preserve literalmente dentes, doses, negações e intervalos citados; sinalize ambiguidades em warnings. Retorne {"text":"evolução a revisar","warnings":["pontos a conferir"]}.',
      { dictation: transcript }, noteSchema
    )
    return this.saveDraft(actor, 'EVOLUTION', { ...result, transcript }, patientId)
  }

  async approveEvolution(actor: Actor, id: string, text: string) {
    const draft = await this.draft(actor, id, 'EVOLUTION')
    await this.patient(actor, draft.targetId!)
    const value = text.trim()
    if (!value || value.length > 20_000) throw new BadRequestException('Revise o texto da evolução antes de salvar.')
    // RecordsService preserves the same patient restrictions as the existing clinical workflow.
    const db = this.tenant.getClient()
    return db.$transaction(async tx => {
      const claimed = await tx.aiDraft.updateMany({ where: { id, createdById: actor.userId, approvedAt: null }, data: { approvedAt: new Date() } })
      if (!claimed.count) throw new ConflictException('Esta evolução já foi salva.')
      return tx.record.create({ data: {
        patientId: draft.targetId!, createdByName: actor.name || 'Profissional', updatedByName: actor.name || 'Profissional',
        content: { schemaVersion: 2, type: 'EVOLUTION', title: 'Evolução por ditado — revisada', procedure: value, clinicalDate: new Date().toISOString(),
          aiDraftId: draft.id, reviewedById: actor.userId, reviewedByName: actor.name || '', reviewedAt: new Date().toISOString(),
          // Identifies authorship and review; this is not an ICP-Brasil digital signature.
          authorConfirmed: true }
      } })
    }, { timeout: 30_000, maxWait: 10_000 })
  }

  async createEstimate(actor: Actor, input: { patientId: string; title: string; amountCents: number; notes?: string; proposedAt?: string }) {
    await this.patient(actor, input.patientId)
    return this.tenant.getClient().treatmentEstimate.create({ data: {
      patientId: input.patientId, title: input.title.trim(), amountCents: input.amountCents, notes: input.notes?.trim(),
      proposedAt: input.proposedAt ? parseClinicDate(`${input.proposedAt}T12:00`) : new Date(), createdByName: actor.name || 'Equipe'
    } })
  }

  async updateEstimate(actor: Actor, id: string, status: string) {
    const row = await this.tenant.getClient().treatmentEstimate.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Orçamento não encontrado.')
    await this.patient(actor, row.patientId)
    return this.tenant.getClient().treatmentEstimate.update({ where: { id }, data: { status } })
  }

  async configureRecall(actor: Actor, patientId: string, input: { intervalMonths: number; dueDate?: string }) {
    await this.patient(actor, patientId)
    return this.tenant.getClient().patient.update({ where: { id: patientId }, data: {
      recallIntervalMonths: input.intervalMonths, recallDueAt: input.dueDate ? parseClinicDate(`${input.dueDate}T12:00`) : null
    }, select: { id: true, recallIntervalMonths: true, recallDueAt: true } })
  }

  async recalls(actor: Actor) {
    const now = new Date()
    const rows = await this.tenant.getClient().patient.findMany({
      where: { ...this.scope(actor), recallIntervalMonths: { gt: 0 } },
      select: { id: true, name: true, recallIntervalMonths: true, recallDueAt: true,
        appointments: { where: { status: { in: ['COMPLETED', 'SCHEDULED'] } }, select: { startTime: true, status: true }, orderBy: { startTime: 'desc' } }
      }
    })
    return rows.flatMap(patient => {
      if (patient.appointments.some(a => a.status === 'SCHEDULED' && a.startTime >= now)) return []
      const last = patient.appointments.find(a => a.status === 'COMPLETED')?.startTime
      const due = patient.recallDueAt || (last ? addMonths(last, patient.recallIntervalMonths) : null)
      if (!due || localDate(due) >= localDate(now)) return []
      return [{ id: patient.id, name: patient.name, dueAt: due, intervalMonths: patient.recallIntervalMonths,
        estimated: !patient.recallDueAt, daysOverdue: Math.max(1, Math.floor((now.getTime() - due.getTime()) / 86400_000)) }]
    }).sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 200)
  }

  private async outreachTarget(actor: Actor, kind: string, targetId: string) {
    const db = this.tenant.getClient()
    if (kind === 'ESTIMATE') {
      const estimate = await db.treatmentEstimate.findUnique({ where: { id: targetId } })
      if (!estimate || estimate.status !== 'PROPOSED') throw new BadRequestException('Este orçamento não está mais pendente.')
      return { patient: await this.patient(actor, estimate.patientId), days: Math.max(0, Math.floor((Date.now() - estimate.proposedAt.getTime()) / 86400_000)) }
    }
    if (kind === 'PLAN') {
      const record = await db.record.findUnique({ where: { id: targetId } })
      const content = readJsonObject(record?.content)
      if (!record || content.type !== 'TREATMENT_PLAN' || content.status !== 'PROPOSED') throw new BadRequestException('O plano de tratamento não está pendente.')
      return { patient: await this.patient(actor, record.patientId), days: Math.max(0, Math.floor((Date.now() - record.createdAt.getTime()) / 86400_000)) }
    }
    const recall = (await this.recalls(actor)).find(row => row.id === targetId)
    if (!recall) throw new BadRequestException('Este paciente não tem um retorno atrasado sem consulta futura.')
    return { patient: await this.patient(actor, targetId), days: recall.daysOverdue }
  }

  async message(actor: Actor, kind: string, targetId: string) {
    if (kind !== 'RECALL') await this.access.assertPermission(actor, 'FINANCE_VIEW')
    const target = await this.outreachTarget(actor, kind, targetId)
    // Patient identity, clinical details and telephone are not needed by the model.
    const result = await this.ai.json(
      'Prepare uma mensagem breve, acolhedora, sem pressão, promessas ou detalhes clínicos. Use o marcador {nome}. Para orçamento: perguntar se ficou alguma dúvida e oferecer conversa, sem afirmar que há consulta marcada. Para retorno: convidar a verificar disponibilidade, sem afirmar indicação clínica. Retorne {"message":"mensagem"}.',
      { purpose: kind === 'RECALL' ? 'convidar para retorno' : 'acompanhar orçamento proposto', daysWaiting: target.days }, messageSchema
    )
    return this.saveDraft(actor, `MESSAGE_${kind}`, { message: result.message.replace(/\{nome\}/g, target.patient.name.split(' ')[0]), patientId: target.patient.id }, targetId)
  }

  async prepareMessage(actor: Actor, id: string, message: string) {
    const draft = await this.draft(actor, id)
    if (!draft.kind.startsWith('MESSAGE_')) throw new BadRequestException('Rascunho inválido para mensagem.')
    const kind = draft.kind.slice(8)
    if (kind !== 'RECALL') await this.access.assertPermission(actor, 'FINANCE_VIEW')
    const target = await this.outreachTarget(actor, kind, draft.targetId!)
    const phone = normalizeWhatsappPhone(target.patient.whatsapp || target.patient.phone || '')
    if (!phone) throw new BadRequestException('Cadastre um telefone válido para este paciente antes de abrir o WhatsApp.')
    if (!message.trim() || message.length > 2000) throw new BadRequestException('Revise uma mensagem de até 2 mil caracteres.')
    const claimed = await this.tenant.getClient().aiDraft.updateMany({ where: { id, createdById: actor.userId, approvedAt: null }, data: { approvedAt: new Date(), content: { message: message.trim(), patientId: target.patient.id } } })
    if (!claimed.count) throw new ConflictException('Esta mensagem já foi preparada.')
    return { url: buildWhatsappUrl(phone, message.trim()), message: 'Mensagem preparada. Revise e clique em Enviar no WhatsApp.' }
  }

  async weekly(actor: Actor, withAi = false) {
    await this.access.assertPermission(actor, 'FINANCE_VIEW')
    const db = this.tenant.getClient()
    const snapshot = await weeklyData(db)
    const summary = withAi ? await generateWeekly(db, this.ai) : await db.aiWeeklySummary.findUnique({ where: { weekStart: snapshot.weekStart } })
    const settings = await db.aiSettings.findUnique({ where: { id: 'default' } })
    return { ...snapshot, summary, weeklyEnabled: settings?.weeklyEnabled || false, refreshedEveryMonday: true,
      explanation: 'Consultas: semana anterior. Orçamentos, retornos e valores a receber: posição atual. Consultas sem conclusão não significam faltas.' }
  }

  async weeklySettings(actor: Actor, enabled: boolean) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Apenas o administrador pode ativar o resumo automático.')
    await this.tenant.getClient().aiSettings.upsert({ where: { id: 'default' }, update: { weeklyEnabled: enabled, enabledByName: actor.name }, create: { id: 'default', weeklyEnabled: enabled, enabledByName: actor.name } })
    return { weeklyEnabled: enabled }
  }
}
