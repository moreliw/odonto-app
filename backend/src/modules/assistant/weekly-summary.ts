import { PrismaClient } from '@prisma/client-tenant'
import { z } from 'zod'
import { AiClient } from './ai-client'
import { addMonths, localDate, weekStart } from './assistant-utils'

export async function weeklyData(db: PrismaClient) {
  const start = weekStart()
  const previous = new Date(start.getTime() - 7 * 86400_000)
  const [appointments, estimates, invoices, patients] = await Promise.all([
    db.appointment.findMany({ where: { startTime: { gte: previous, lt: start } }, select: { startTime: true, status: true, confirmationStatus: true } }),
    db.treatmentEstimate.count({ where: { status: 'PROPOSED' } }),
    db.invoice.findMany({ where: { status: { in: ['PENDING', 'PARTIAL'] } }, select: { amount: true, discount: true, payments: { select: { amount: true } } } }),
    db.patient.findMany({ where: { recallIntervalMonths: { gt: 0 } }, select: { recallIntervalMonths: true, recallDueAt: true, appointments: {
      where: { status: { in: ['COMPLETED', 'SCHEDULED'] } }, select: { startTime: true, status: true }, orderBy: { startTime: 'desc' }
    } } })
  ])
  const now = new Date()
  const overdueRecalls = patients.filter(p => {
    if (p.appointments.some(a => a.status === 'SCHEDULED' && a.startTime >= now)) return false
    const last = p.appointments.find(a => a.status === 'COMPLETED')?.startTime
    const due = p.recallDueAt || (last ? addMonths(last, p.recallIntervalMonths) : null)
    return due && localDate(due) < localDate(now)
  }).length
  const metrics = {
    appointments: appointments.length,
    completed: appointments.filter(a => a.status === 'COMPLETED').length,
    canceled: appointments.filter(a => a.status === 'CANCELLED').length,
    missed: appointments.filter(a => a.status === 'NO_SHOW').length,
    unclosed: appointments.filter(a => a.status === 'SCHEDULED').length,
    declined: appointments.filter(a => a.confirmationStatus === 'DECLINED').length,
    pendingEstimates: estimates,
    receivableCents: invoices.reduce((sum, i) => sum + Math.max(0, Math.round((Number(i.amount) - Number(i.discount) - i.payments.reduce((s, p) => s + Number(p.amount), 0)) * 100)), 0),
    overdueRecalls
  }
  return { weekStart: start, periodStart: previous, periodEnd: start, metrics }
}

export async function generateWeekly(db: PrismaClient, ai: AiClient) {
  const snapshot = await weeklyData(db)
  const existing = await db.aiWeeklySummary.findUnique({ where: { weekStart: snapshot.weekStart } })
  if (existing) return existing
  const result = await ai.json(
    'Retorne {"suggestions":["até 3 sugestões administrativas curtas"]}. Use só os indicadores recebidos. missed são faltas registradas; unclosed são consultas sem conclusão registrada, não faltas; canceled são cancelamentos. Não invente tendências, causalidade, horários críticos ou conduta clínica. Não prometa aumento de receita.',
    { periodStart: localDate(snapshot.periodStart), periodEnd: localDate(snapshot.periodEnd), metrics: snapshot.metrics },
    z.object({ suggestions: z.array(z.string().min(1).max(500)).min(1).max(3) })
  )
  return db.aiWeeklySummary.upsert({ where: { weekStart: snapshot.weekStart }, update: {}, create: { weekStart: snapshot.weekStart, metrics: snapshot.metrics, suggestions: result.suggestions } })
}
