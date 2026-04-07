import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prismaTenant: TenantPrismaService) {}

  @Get('metrics')
  async metrics() {
    const prisma: any = this.prismaTenant.getClient()
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [patientCount, appointmentsToday, revenueAgg, invPending, invPaid, invCancelled] = await Promise.all([
      prisma.patient.count(),
      prisma.appointment.count({ where: { startTime: { gte: startOfToday, lt: endOfToday }, status: 'SCHEDULED' } }),
      prisma.invoice.aggregate({ _sum: { amount: true }, where: { issuedAt: { gte: startOfMonth }, status: 'PAID' } }),
      prisma.invoice.count({ where: { status: 'PENDING' } }),
      prisma.invoice.count({ where: { status: 'PAID' } }),
      prisma.invoice.count({ where: { status: 'CANCELLED' } })
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
      revenueThisMonth: Number(revenueAgg._sum.amount || 0),
      invoicesStatus: { pending: invPending, paid: invPaid, cancelled: invCancelled },
      monthlyPatients
    }
  }
}
