import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request } from 'express'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

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
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [
      patientCount,
      appointmentsToday,
      newPatientsThisMonth,
      appointmentsNextSevenDays,
      pendingConfirmations,
      unassignedAppointments,
      completedThisMonth,
      paymentRevenueAgg,
      legacyRevenueAgg,
      invPending,
      invPartial,
      invPaid,
      invCancelled,
      todayAppointments
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.appointment.count({ where: { startTime: { gte: startOfToday, lt: endOfToday }, status: 'SCHEDULED' } }),
      prisma.patient.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.appointment.count({ where: { startTime: { gte: now, lt: nextSevenDays }, status: 'SCHEDULED' } }),
      prisma.appointment.count({ where: { startTime: { gte: now }, status: 'SCHEDULED', confirmationStatus: 'PENDING' } }),
      prisma.appointment.count({ where: { startTime: { gte: now }, status: 'SCHEDULED', dentistId: null, dentistName: null } }),
      prisma.appointment.count({ where: { startTime: { gte: startOfMonth }, status: 'COMPLETED' } }),
      isAdmin ? prisma.invoicePayment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startOfMonth } } }) : Promise.resolve({ _sum: { amount: 0 } }),
      isAdmin ? prisma.invoice.aggregate({ _sum: { amount: true }, where: { issuedAt: { gte: startOfMonth }, status: 'PAID', payments: { none: {} } } }) : Promise.resolve({ _sum: { amount: 0 } }),
      isAdmin ? prisma.invoice.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
      isAdmin ? prisma.invoice.count({ where: { status: 'PARTIAL' } }) : Promise.resolve(0),
      isAdmin ? prisma.invoice.count({ where: { status: 'PAID' } }) : Promise.resolve(0),
      isAdmin ? prisma.invoice.count({ where: { status: 'CANCELLED' } }) : Promise.resolve(0),
      prisma.appointment.findMany({
        where: { status: 'SCHEDULED', startTime: { gte: startOfToday, lt: endOfToday } },
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

    return {
      patientCount,
      appointmentsToday,
      newPatientsThisMonth,
      appointmentsNextSevenDays,
      pendingConfirmations,
      unassignedAppointments,
      completedThisMonth,
      canViewFinancial: isAdmin,
      revenueThisMonth: Number(paymentRevenueAgg._sum.amount || 0) + Number(legacyRevenueAgg._sum.amount || 0),
      invoicesStatus: { pending: invPending, partial: invPartial, paid: invPaid, cancelled: invCancelled },
      monthlyPatients,
      todayAppointments: todayAppointments.map((a: any) => ({
        id: a.id,
        patientName: a.patient?.name || 'Paciente',
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
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 7)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const where = { dentistId }

    const [appointmentsToday, appointmentsThisWeek, completedThisMonth, distinctPatients, todayAppointments] = await Promise.all([
      prisma.appointment.count({ where: { ...where, status: 'SCHEDULED', startTime: { gte: startOfToday, lt: endOfToday } } }),
      prisma.appointment.count({ where: { ...where, status: 'SCHEDULED', startTime: { gte: startOfWeek, lt: endOfWeek } } }),
      prisma.appointment.count({ where: { ...where, status: 'COMPLETED', startTime: { gte: startOfMonth } } }),
      prisma.appointment.findMany({ where, distinct: ['patientId'], select: { patientId: true } }),
      prisma.appointment.findMany({
        where: { ...where, status: 'SCHEDULED', startTime: { gte: startOfToday, lt: endOfToday } },
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
