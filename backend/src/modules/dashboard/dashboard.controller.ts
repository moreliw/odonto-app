import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request } from 'express'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

const APP_TIME_ZONE = process.env.APP_TIMEZONE?.trim() || 'America/Sao_Paulo'

function datePartsInTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value)
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute'), second: value('second') }
}

function timeZoneOffset(date: Date) {
  const parts = datePartsInTimeZone(date)
  const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000
}

function localDateTimeToUtc(year: number, month: number, day: number, hour = 0) {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour)
  let result = new Date(targetAsUtc - timeZoneOffset(new Date(targetAsUtc)))
  result = new Date(targetAsUtc - timeZoneOffset(result))
  return result
}

function dayBoundsInAppTimeZone(now: Date) {
  const { year, month, day } = datePartsInTimeZone(now)
  const followingDay = new Date(Date.UTC(year, month - 1, day + 1))
  return {
    start: localDateTimeToUtc(year, month, day),
    end: localDateTimeToUtc(followingDay.getUTCFullYear(), followingDay.getUTCMonth() + 1, followingDay.getUTCDate())
  }
}

function monthStartInAppTimeZone(now: Date) {
  const { year, month } = datePartsInTimeZone(now)
  return localDateTimeToUtc(year, month, 1)
}

@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prismaTenant: TenantPrismaService) {}

  /** Visão geral da clínica: administrador e equipe de apoio. Dentistas usam /my-metrics (agenda própria). */
  @Get('metrics')
  async metrics(@Req() req: Request) {
    if ((req as any).user?.role === 'DENTIST') {
      throw new ForbiddenException('Dentistas acompanham a própria agenda em "Minha agenda".')
    }
    const prisma: any = this.prismaTenant.getClient()
    const now = new Date()
    const isAdmin = (req as any).user?.role === 'ADMIN'
    const { start: startOfToday, end: endOfToday } = dayBoundsInAppTimeZone(now)
    const startOfMonth = monthStartInAppTimeZone(now)
    const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [
      patientCount,
      appointmentsToday,
      newPatientsThisMonth,
      appointmentsNextSevenDays,
      pendingConfirmations,
      unassignedAppointments,
      completedThisMonth,
      billedThisMonthAgg,
      paymentRevenueAgg,
      legacyRevenueAgg,
      expensesThisMonthAgg,
      invPending,
      invPartial,
      invPaid,
      invCancelled,
      todayAppointments
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.appointment.count({ where: { startTime: { gte: startOfToday, lt: endOfToday } } }),
      prisma.patient.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.appointment.count({ where: { startTime: { gte: now, lt: nextSevenDays }, status: 'SCHEDULED' } }),
      prisma.appointment.count({ where: { startTime: { gte: now }, status: 'SCHEDULED', confirmationStatus: 'PENDING' } }),
      prisma.appointment.count({ where: { startTime: { gte: now }, status: 'SCHEDULED', dentistId: null, dentistName: null } }),
      prisma.appointment.count({ where: { startTime: { gte: startOfMonth }, status: 'COMPLETED' } }),
      isAdmin ? prisma.invoice.aggregate({ _sum: { amount: true }, where: { issuedAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } }) : Promise.resolve({ _sum: { amount: 0 } }),
      isAdmin ? prisma.invoicePayment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startOfMonth } } }) : Promise.resolve({ _sum: { amount: 0 } }),
      isAdmin ? prisma.invoice.aggregate({ _sum: { amount: true }, where: { issuedAt: { gte: startOfMonth }, status: 'PAID', payments: { none: {} } } }) : Promise.resolve({ _sum: { amount: 0 } }),
      isAdmin ? prisma.expense.aggregate({ _sum: { amount: true }, where: { status: 'PAID', paidAt: { gte: startOfMonth } } }) : Promise.resolve({ _sum: { amount: 0 } }),
      isAdmin ? prisma.invoice.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
      isAdmin ? prisma.invoice.count({ where: { status: 'PARTIAL' } }) : Promise.resolve(0),
      isAdmin ? prisma.invoice.count({ where: { status: 'PAID' } }) : Promise.resolve(0),
      isAdmin ? prisma.invoice.count({ where: { status: 'CANCELLED' } }) : Promise.resolve(0),
      prisma.appointment.findMany({
        where: { startTime: { gte: startOfToday, lt: endOfToday } },
        include: { patient: { select: { id: true, name: true } }, dentist: { select: { id: true, name: true } } },
        orderBy: { startTime: 'asc' }
      })
    ])

    const monthlyPatients: { label: string; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const count = await prisma.patient.count({ where: { createdAt: { gte: start, lt: end } } })
      const label = `${start.toLocaleDateString('pt-BR', { month: 'short' })}/${start.getFullYear()}`
      monthlyPatients.push({ label, count })
    }

    const receivedThisMonth = Number(paymentRevenueAgg._sum.amount || 0) + Number(legacyRevenueAgg._sum.amount || 0)
    const expensesThisMonth = Number(expensesThisMonthAgg._sum.amount || 0)

    return {
      patientCount,
      appointmentsToday,
      newPatientsThisMonth,
      appointmentsNextSevenDays,
      pendingConfirmations,
      unassignedAppointments,
      completedThisMonth,
      canViewFinancial: isAdmin,
      billedThisMonth: Number(billedThisMonthAgg._sum.amount || 0),
      revenueThisMonth: receivedThisMonth,
      expensesThisMonth,
      netThisMonth: receivedThisMonth - expensesThisMonth,
      invoicesStatus: { pending: invPending, partial: invPartial, paid: invPaid, cancelled: invCancelled },
      monthlyPatients,
      todayAppointments: todayAppointments.map((a: any) => ({
        id: a.id,
        patientName: a.patient?.name || 'Paciente',
        dentistId: a.dentist?.id || a.dentistId || null,
        dentistName: a.dentist?.name || a.dentistName || null,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        confirmationStatus: a.confirmationStatus
      }))
    }
  }

  /** Painel do dentista: só a própria agenda e os próprios pacientes atendidos. */
  @Get('my-metrics')
  async myMetrics(@Req() req: Request) {
    if ((req as any).user?.role !== 'DENTIST') {
      throw new ForbiddenException('Esta visão é exclusiva do dentista.')
    }
    const prisma: any = this.prismaTenant.getClient()
    const dentistId = (req as any).user?.userId
    const now = new Date()
    const { start: startOfToday, end: endOfToday } = dayBoundsInAppTimeZone(now)
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 7)
    const startOfMonth = monthStartInAppTimeZone(now)

    const where = { dentistId }

    const [appointmentsToday, appointmentsThisWeek, completedThisMonth, distinctPatients, todayAppointments] = await Promise.all([
      prisma.appointment.count({ where: { ...where, startTime: { gte: startOfToday, lt: endOfToday } } }),
      prisma.appointment.count({ where: { ...where, status: 'SCHEDULED', startTime: { gte: startOfWeek, lt: endOfWeek } } }),
      prisma.appointment.count({ where: { ...where, status: 'COMPLETED', startTime: { gte: startOfMonth } } }),
      prisma.appointment.findMany({ where, distinct: ['patientId'], select: { patientId: true } }),
      prisma.appointment.findMany({
        where: { ...where, startTime: { gte: startOfToday, lt: endOfToday } },
        include: { patient: { select: { id: true, name: true } } },
        orderBy: { startTime: 'asc' }
      })
    ])

    const monthlyAppointments: { label: string; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const count = await prisma.appointment.count({ where: { ...where, startTime: { gte: start, lt: end } } })
      const label = `${start.toLocaleDateString('pt-BR', { month: 'short' })}/${start.getFullYear()}`
      monthlyAppointments.push({ label, count })
    }

    return {
      appointmentsToday,
      appointmentsThisWeek,
      completedThisMonth,
      totalPatients: distinctPatients.length,
      todayAppointments: todayAppointments.map((a: any) => ({
        id: a.id,
        patientName: a.patient?.name || 'Paciente',
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        confirmationStatus: a.confirmationStatus
      })),
      monthlyAppointments
    }
  }
}
