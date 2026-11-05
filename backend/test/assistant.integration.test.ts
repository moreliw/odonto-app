import 'reflect-metadata'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client-tenant'
import { AssistantService } from '../src/modules/assistant/assistant.service'
import { AiClient } from '../src/modules/assistant/ai-client'
import { addMonths, parseClinicDate, weekStart } from '../src/modules/assistant/assistant-utils'
import { weeklyData } from '../src/modules/assistant/weekly-summary'

const url = process.env.TEST_TENANT_DATABASE_URL
if (!url || !/\/tenant_qa(?:\?|$)/.test(url)) throw new Error('Use a dedicated tenant_qa database for integration tests.')
const db = new PrismaClient({ datasources: { db: { url } } })
const suffix = randomUUID()
const admin = { userId: `admin-${suffix}`, role: 'ADMIN' as const, name: 'QA Administrador' }
let alice: { id: string }, bob: { id: string }, dentist: { id: string }
const aiInput: unknown[] = []
const fakeAi = {
  configuration: () => ({ enabled: true, provider: 'test-double' }),
  json: async (instructions: string, input: unknown, schema: any) => {
    aiInput.push(input)
    return schema.parse(instructions.includes('"appointments"') ? { appointments: [{ patientName: 'QA Alice', startLocal: '2035-02-10T09:00', endLocal: '', procedure: 'Retorno', warning: 'Duração não informada' }], warnings: [] }
      : instructions.includes('"suggestions"') ? { suggestions: ['Confira as consultas sem conclusão registrada.'] }
      : instructions.includes('"message"') ? { message: 'Olá, {nome}! Podemos conversar sobre seu retorno?' }
      : { text: 'Restauração em resina no dente 26. Sem intercorrências.', warnings: ['Confira o dente 26.'] })
  },
  transcribe: async () => 'Restauração em resina no dente 26. Sem intercorrências.'
}
const access = { effectiveFor: async () => ['PATIENTS_VIEW','PATIENTS_MANAGE','APPOINTMENTS_VIEW','APPOINTMENTS_MANAGE','RECORDS_VIEW','RECORDS_MANAGE','FINANCE_VIEW','FINANCE_MANAGE','DASHBOARD_VIEW'], assertPermission: async () => undefined }
const assistant = new AssistantService({ getClient: () => db } as any, fakeAi as any, access as any)

before(async () => {
  dentist = await db.user.create({ data: { name: `Dentista ${suffix}`, role: 'DENTIST' } })
  alice = await db.patient.create({ data: { name: `QA Alice ${suffix}`, phone: '+5527999999999', recallDueAt: new Date('2020-01-01T12:00:00Z') } })
  bob = await db.patient.create({ data: { name: `QA Bob ${suffix}`, recallDueAt: new Date('2020-01-01T12:00:00Z') } })
  await db.appointment.create({ data: { patientId: alice.id, dentistId: dentist.id, startTime: new Date('2020-02-10T12:00:00Z'), endTime: new Date('2020-02-10T13:00:00Z'), status: 'COMPLETED' } })
})
after(async () => { await db.$disconnect() })

describe('assistente com persistência PostgreSQL e IA controlada', () => {
  it('gera horários incompletos para revisão sem criar consultas automaticamente', async () => {
    const before = await db.appointment.count()
    const draft = await assistant.photo(admin, { buffer: Buffer.from('synthetic'), mimetype: 'image/png' } as any, '2035-02-10')
    assert.equal((draft.content as any).appointments[0].endLocal, '')
    assert.equal(await db.appointment.count(), before)
  })

  it('confirma a importação uma vez e rejeita aprovação repetida', async () => {
    const draft = await assistant.photo(admin, {} as any, '2035-02-10')
    const rows = [{ patientId: alice.id, dentistId: dentist.id, startLocal: '2035-02-10T09:00', endLocal: '2035-02-10T09:30' }]
    const result = await assistant.approveAppointments(admin, draft.id, rows)
    assert.equal(result.count, 1)
    await assert.rejects(() => assistant.approveAppointments(admin, draft.id, rows), /já foi aprovado|já foi confirmada/)
  })

  it('desfaz todo o lote quando a segunda consulta tem conflito', async () => {
    const draft = await assistant.photo(admin, {} as any, '2035-02-10')
    const before = await db.appointment.count()
    await assert.rejects(() => assistant.approveAppointments(admin, draft.id, [
      { patientId: alice.id, startLocal: '2035-02-11T10:00', endLocal: '2035-02-11T10:30' },
      { patientId: alice.id, dentistId: dentist.id, startLocal: '2035-02-10T09:10', endLocal: '2035-02-10T09:20' }
    ]), /conflito/)
    assert.equal(await db.appointment.count(), before)
    assert.equal((await db.aiDraft.findUniqueOrThrow({ where: { id: draft.id } })).approvedAt, null)
  })

  it('não salva evolução até a revisão, registra autoria e impede duplicação', async () => {
    const before = await db.record.count({ where: { patientId: alice.id } })
    const draft = await assistant.evolution(admin, alice.id, undefined, 'Ditado fictício do atendimento.')
    assert.equal(await db.record.count({ where: { patientId: alice.id } }), before)
    const saved = await assistant.approveEvolution(admin, draft.id, 'Texto conferido: dente 26, sem intercorrências.')
    assert.equal((saved.content as any).reviewedById, admin.userId)
    assert.equal((saved.content as any).procedure, 'Texto conferido: dente 26, sem intercorrências.')
    await assert.rejects(() => assistant.approveEvolution(admin, draft.id, 'Repetição'), /já foi aprovado|já foi salva/)
  })

  it('impede dentista de ditar para paciente que não está em sua agenda', async () => {
    await assert.rejects(() => assistant.evolution({ userId: dentist.id, role: 'DENTIST' }, bob.id, undefined, 'Dados'), /sem acesso/)
  })

  it('restringe rascunhos ao autor que os criou', async () => {
    const draft = await assistant.evolution(admin, alice.id, undefined, 'Dados fictícios')
    await assert.rejects(() => assistant.approveEvolution({ ...admin, userId: 'outro-autor' }, draft.id, 'Texto'), /não encontrado/)
  })

  it('separa orçamento de cobrança e prepara WhatsApp sem registrar envio', async () => {
    const before = await db.invoice.count()
    const quote = await assistant.createEstimate(admin, { patientId: alice.id, title: 'Orçamento fictício', amountCents: 10000 })
    assert.equal(await db.invoice.count(), before)
    const draft = await assistant.message(admin, 'ESTIMATE', quote.id)
    assert.ok(!JSON.stringify(aiInput.at(-1)).includes(alice.id))
    const result = await assistant.prepareMessage(admin, draft.id, 'Olá! Podemos conversar?')
    assert.match(result.url, /^https:\/\/wa\.me\/5527/)
    assert.equal((await db.treatmentEstimate.findUniqueOrThrow({ where: { id: quote.id } })).lastContactAt, null)
    await assistant.updateEstimate(admin, quote.id, 'APPROVED')
    await assert.rejects(() => assistant.message(admin, 'ESTIMATE', quote.id), /não está mais pendente/)
  })

  it('não lista retorno atrasado quando há consulta futura ou acompanhamento desativado', async () => {
    let recalls = await assistant.recalls(admin)
    assert.ok(!recalls.some(r => r.id === alice.id))
    assert.ok(recalls.some(r => r.id === bob.id))
    await assistant.configureRecall(admin, bob.id, { intervalMonths: 0 })
    recalls = await assistant.recalls(admin)
    assert.ok(!recalls.some(r => r.id === bob.id))
  })

  it('calcula saldo líquido e diferencia falta, cancelamento e consulta não concluída', async () => {
    const previous = new Date(weekStart().getTime() - 3 * 86400_000)
    await db.appointment.createMany({ data: ['NO_SHOW','CANCELLED','SCHEDULED'].map(status => ({ patientId: bob.id, status: status as any, startTime: previous, endTime: new Date(previous.getTime() + 1800_000) })) })
    await db.invoice.create({ data: { patientId: bob.id, amount: 100, discount: 10, status: 'PARTIAL', payments: { create: { amount: 20, method: 'CASH' } } } })
    const result = await weeklyData(db)
    assert.ok(result.metrics.missed >= 1)
    assert.ok(result.metrics.canceled >= 1)
    assert.ok(result.metrics.unclosed >= 1)
    assert.ok(result.metrics.receivableCents >= 7000)
  })

  it('impede equipe de ativar geração recorrente sem ser administrador', async () => {
    await assert.rejects(() => assistant.weeklySettings({ userId: 'equipe', role: 'USER' }, true), /Apenas o administrador/)
  })
})

describe('datas e configuração', () => {
  it('preserva fim do mês ao calcular retornos', () => { assert.equal(addMonths(new Date('2024-08-31T15:00:00Z'), 6).toISOString(), '2025-02-28T15:00:00.000Z') })
  it('converte Brasília e rejeita datas impossíveis', () => {
    assert.equal(parseClinicDate('2035-02-10T09:00').toISOString(), '2035-02-10T12:00:00.000Z')
    assert.throws(() => parseClinicDate('2035-02-30T09:00'))
    assert.throws(() => parseClinicDate('2035-02-10T25:00'))
  })
  it('informa IA indisponível quando não há chave e não executa chamada externa', async () => {
    const old = process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY
    process.env.AI_PROVIDER = 'groq'
    const client = new AiClient()
    assert.equal(client.configuration().enabled, false)
    await assert.rejects(() => client.json('teste', {}, {} as any), /não está configurada/)
    if (old) process.env.GROQ_API_KEY = old
  })
})
