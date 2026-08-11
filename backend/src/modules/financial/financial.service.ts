import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'

export type FinancialRequester = { userId: string; email?: string; role: 'ADMIN' | 'DENTIST' | 'USER' }

type ListFilters = { search?: string; status?: string; from?: string; to?: string }
type ItemInput = { serviceId?: string; description?: string; quantity?: number; unitPrice?: number }
type InvoiceInput = {
  patientId?: string
  dentistId?: string
  dentistName?: string
  description?: string
  amount?: number
  discount?: number
  issuedAt?: string
  dueDate?: string
  notes?: string
  items?: ItemInput[]
}
type PaymentInput = { amount: number; paidAt: string; method: string; notes?: string }
type ExpenseInput = {
  description?: string
  category?: string
  supplier?: string
  amount?: number
  issuedAt?: string
  dueDate?: string
  recurring?: boolean
  notes?: string
}
type ServiceInput = {
  name?: string
  description?: string
  category?: string
  price?: number
  durationMinutes?: number
  active?: boolean
}

const invoiceInclude = {
  patient: { select: { id: true, name: true, phone: true } },
  dentist: { select: { id: true, name: true } },
  items: { include: { service: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { paidAt: 'desc' as const } }
}

@Injectable()
export class FinancialService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}

  private get prisma(): any {
    return this.prismaTenant.getClient()
  }

  private assertFinancialAccess(requester: FinancialRequester) {
    if (!requester || !['ADMIN', 'DENTIST'].includes(requester.role)) {
      throw new ForbiddenException('Seu perfil não possui acesso ao financeiro.')
    }
  }

  private assertAdmin(requester: FinancialRequester) {
    if (requester?.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas o administrador da clínica pode realizar esta operação.')
    }
  }

  private invoiceScope(requester: FinancialRequester) {
    this.assertFinancialAccess(requester)
    return requester.role === 'DENTIST' ? { dentistId: requester.userId } : {}
  }

  private startOfToday() {
    const value = new Date()
    value.setHours(0, 0, 0, 0)
    return value
  }

  private dateRange(from?: string, to?: string) {
    const now = new Date()
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1)
    const end = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException('Período financeiro inválido.')
    }
    if (from) start.setHours(0, 0, 0, 0)
    if (to) end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  private money(value: unknown) {
    return Math.round(Number(value || 0) * 100) / 100
  }

  private actor(requester: FinancialRequester) {
    return requester.email?.trim() || 'Sistema'
  }

  private paymentTotal(invoice: any) {
    return this.money((invoice.payments || []).reduce((sum: number, payment: any) => sum + Number(payment.amount), 0))
  }

  private serializeInvoice(invoice: any) {
    const amount = this.money(invoice.amount)
    const paidAmount = this.paymentTotal(invoice)
    const remainingAmount = invoice.status === 'CANCELLED' ? 0 : this.money(Math.max(0, amount - paidAmount))
    let status = invoice.status
    if (status !== 'CANCELLED') {
      status = remainingAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING'
    }
    const effectiveStatus = !['PAID', 'CANCELLED'].includes(status) && new Date(invoice.dueDate) < this.startOfToday()
      ? 'OVERDUE'
      : status
    return {
      ...invoice,
      amount,
      discount: this.money(invoice.discount),
      paidAmount,
      remainingAmount,
      status,
      effectiveStatus,
      items: (invoice.items || []).map((item: any) => ({
        ...item,
        unitPrice: this.money(item.unitPrice),
        total: this.money(item.total)
      })),
      payments: (invoice.payments || []).map((payment: any) => ({ ...payment, amount: this.money(payment.amount) }))
    }
  }

  private serializeExpense(expense: any) {
    const effectiveStatus = expense.status === 'PENDING' && new Date(expense.dueDate) < this.startOfToday()
      ? 'OVERDUE'
      : expense.status
    return { ...expense, amount: this.money(expense.amount), effectiveStatus }
  }

  private async invoiceOrThrow(requester: FinancialRequester, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, ...this.invoiceScope(requester) },
      include: invoiceInclude
    })
    if (!invoice) throw new NotFoundException('Cobrança não encontrada.')
    return invoice
  }

  private async normalizeItems(items: ItemInput[] = []) {
    if (!items.length) return []
    const serviceIds = [...new Set(items.map(item => item.serviceId).filter(Boolean))]
    const services = serviceIds.length
      ? await this.prisma.clinicService.findMany({ where: { id: { in: serviceIds } } })
      : []
    const serviceMap = new Map<string, any>(services.map((service: any) => [service.id, service]))

    return items.map(item => {
      const service = item.serviceId ? serviceMap.get(item.serviceId) : null
      if (item.serviceId && !service) throw new BadRequestException('Um dos serviços selecionados não existe.')
      const description = (item.description || service?.name || '').trim()
      if (!description) throw new BadRequestException('Informe a descrição de todos os itens da cobrança.')
      const quantity = Math.max(1, Number(item.quantity || 1))
      const unitPrice = this.money(item.unitPrice ?? service?.price)
      if (unitPrice < 0) throw new BadRequestException('O valor do serviço não pode ser negativo.')
      return {
        serviceId: service?.id || null,
        description,
        quantity,
        unitPrice,
        total: this.money(quantity * unitPrice)
      }
    })
  }

  private invoiceAmount(items: Array<{ total: number }>, discount: number, fallback?: number) {
    const gross = this.money(items.reduce((sum, item) => sum + item.total, 0))
    const base = items.length ? gross : this.money(fallback)
    if (!base || base <= 0) throw new BadRequestException('Informe ao menos um serviço ou um valor para a cobrança.')
    if (discount > base) throw new BadRequestException('O desconto não pode ser maior que o valor da cobrança.')
    return this.money(base - discount)
  }

  async listInvoices(requester: FinancialRequester, filters: ListFilters = {}) {
    const where: any = { ...this.invoiceScope(requester) }
    if (filters.search?.trim()) {
      const search = filters.search.trim()
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }
    if (filters.from || filters.to) {
      const { start, end } = this.dateRange(filters.from, filters.to)
      where.dueDate = { gte: start, lte: end }
    }
    const invoices = await this.prisma.invoice.findMany({ where, include: invoiceInclude, orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }] })
    const serialized = invoices.map((invoice: any) => this.serializeInvoice(invoice))
    if (!filters.status || filters.status === 'ALL') return serialized
    return serialized.filter((invoice: any) => invoice.effectiveStatus === filters.status)
  }

  async createInvoice(requester: FinancialRequester, input: InvoiceInput) {
    this.assertFinancialAccess(requester)
    if (!input.patientId || !input.dueDate) throw new BadRequestException('Paciente e vencimento são obrigatórios.')
    const patient = await this.prisma.patient.findUnique({ where: { id: input.patientId }, select: { id: true } })
    if (!patient) throw new BadRequestException('Paciente não encontrado.')

    const dentistId = requester.role === 'DENTIST' ? requester.userId : (input.dentistId || null)
    if (dentistId) {
      const dentist = await this.prisma.user.findFirst({ where: { id: dentistId, role: 'DENTIST' }, select: { id: true } })
      if (!dentist) throw new BadRequestException('Dentista responsável não encontrado.')
    }
    // Nome livre só faz sentido quando não há conta vinculada — evita ambiguidade entre os dois.
    const dentistName = dentistId ? null : input.dentistName?.trim() || null

    const items = await this.normalizeItems(input.items)
    const discount = this.money(input.discount)
    const amount = this.invoiceAmount(items, discount, input.amount)
    const invoice = await this.prisma.invoice.create({
      data: {
        patientId: input.patientId,
        dentistId,
        dentistName,
        description: input.description?.trim() || items[0]?.description || 'Cobrança odontológica',
        amount,
        discount,
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : new Date(),
        dueDate: new Date(input.dueDate),
        notes: input.notes?.trim() || null,
        createdByName: this.actor(requester),
        updatedByName: this.actor(requester),
        items: items.length ? { create: items } : undefined
      },
      include: invoiceInclude
    })
    return this.serializeInvoice(invoice)
  }

  async updateInvoice(requester: FinancialRequester, id: string, input: InvoiceInput) {
    const current = await this.invoiceOrThrow(requester, id)
    if (current.status === 'CANCELLED') throw new BadRequestException('Uma cobrança cancelada não pode ser alterada.')
    const data: any = {}
    data.updatedByName = this.actor(requester)
    if (input.patientId !== undefined) data.patientId = input.patientId
    if (input.description !== undefined) data.description = input.description.trim() || 'Cobrança odontológica'
    if (input.issuedAt !== undefined) data.issuedAt = new Date(input.issuedAt)
    if (input.dueDate !== undefined) data.dueDate = new Date(input.dueDate)
    if (input.notes !== undefined) data.notes = input.notes.trim() || null
    if (requester.role === 'ADMIN' && input.dentistId !== undefined) data.dentistId = input.dentistId || null
    if (requester.role === 'ADMIN' && input.dentistName !== undefined) data.dentistName = input.dentistName?.trim() || null
    // Conta vinculada e nome livre são mutuamente exclusivos.
    if (data.dentistId) data.dentistName = null
    else if (data.dentistName) data.dentistId = null

    const items = input.items !== undefined ? await this.normalizeItems(input.items) : null
    const discount = input.discount !== undefined ? this.money(input.discount) : this.money(current.discount)
    if (items !== null || input.amount !== undefined || input.discount !== undefined) {
      const currentItems = items ?? (current.items || []).map((item: any) => ({ total: this.money(item.total) }))
      data.discount = discount
      data.amount = this.invoiceAmount(currentItems, discount, input.amount ?? Number(current.amount) + Number(current.discount))
      const paid = this.paymentTotal(current)
      if (data.amount + 0.001 < paid) {
        throw new BadRequestException('O total não pode ser menor que o valor já recebido.')
      }
      data.status = paid <= 0 ? 'PENDING' : data.amount <= paid ? 'PAID' : 'PARTIAL'
    }
    if (items !== null) data.items = { deleteMany: {}, create: items }

    const invoice = await this.prisma.invoice.update({ where: { id }, data, include: invoiceInclude })
    return this.serializeInvoice(invoice)
  }

  async addPayment(requester: FinancialRequester, id: string, input: PaymentInput) {
    const current = await this.invoiceOrThrow(requester, id)
    if (current.status === 'CANCELLED') throw new BadRequestException('Não é possível receber uma cobrança cancelada.')
    const serialized = this.serializeInvoice(current)
    const amount = this.money(input.amount)
    if (amount <= 0 || amount > serialized.remainingAmount + 0.001) {
      throw new BadRequestException('O recebimento deve ser maior que zero e não pode ultrapassar o saldo em aberto.')
    }
    const paidAfter = this.money(serialized.paidAmount + amount)
    const status = paidAfter + 0.001 >= serialized.amount ? 'PAID' : 'PARTIAL'
    const [, invoice] = await this.prisma.$transaction([
      this.prisma.invoicePayment.create({
        data: { invoiceId: id, amount, paidAt: new Date(input.paidAt), method: input.method, notes: input.notes?.trim() || null }
      }),
      this.prisma.invoice.update({ where: { id }, data: { status, updatedByName: this.actor(requester) }, include: invoiceInclude })
    ])
    return this.serializeInvoice(invoice)
  }

  async removePayment(requester: FinancialRequester, invoiceId: string, paymentId: string) {
    this.assertAdmin(requester)
    const current = await this.invoiceOrThrow(requester, invoiceId)
    const payment = current.payments.find((entry: any) => entry.id === paymentId)
    if (!payment) throw new NotFoundException('Recebimento não encontrado.')
    const remainingPaid = this.money(this.paymentTotal(current) - Number(payment.amount))
    const status = remainingPaid <= 0 ? 'PENDING' : remainingPaid + 0.001 >= Number(current.amount) ? 'PAID' : 'PARTIAL'
    const [, invoice] = await this.prisma.$transaction([
      this.prisma.invoicePayment.delete({ where: { id: paymentId } }),
      this.prisma.invoice.update({ where: { id: invoiceId }, data: { status, updatedByName: this.actor(requester) }, include: invoiceInclude })
    ])
    return this.serializeInvoice(invoice)
  }

  async cancelInvoice(requester: FinancialRequester, id: string) {
    const current = await this.invoiceOrThrow(requester, id)
    if (this.paymentTotal(current) > 0) throw new BadRequestException('Remova os recebimentos antes de cancelar esta cobrança.')
    const invoice = await this.prisma.invoice.update({ where: { id }, data: { status: 'CANCELLED', updatedByName: this.actor(requester) }, include: invoiceInclude })
    return this.serializeInvoice(invoice)
  }

  async deleteInvoice(requester: FinancialRequester, id: string) {
    this.assertAdmin(requester)
    const current = await this.invoiceOrThrow(requester, id)
    if (this.paymentTotal(current) > 0) throw new BadRequestException('Cobranças com recebimentos não podem ser excluídas.')
    await this.prisma.invoice.delete({ where: { id } })
    return { ok: true }
  }

  async listExpenses(requester: FinancialRequester, filters: ListFilters = {}) {
    this.assertAdmin(requester)
    const where: any = {}
    if (filters.search?.trim()) {
      const search = filters.search.trim()
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { supplier: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ]
    }
    if (filters.from || filters.to) {
      const { start, end } = this.dateRange(filters.from, filters.to)
      where.dueDate = { gte: start, lte: end }
    }
    const expenses = await this.prisma.expense.findMany({ where, orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }] })
    const serialized = expenses.map((expense: any) => this.serializeExpense(expense))
    if (!filters.status || filters.status === 'ALL') return serialized
    return serialized.filter((expense: any) => expense.effectiveStatus === filters.status)
  }

  async createExpense(requester: FinancialRequester, input: ExpenseInput) {
    this.assertAdmin(requester)
    if (!input.description?.trim() || !input.amount || !input.dueDate) {
      throw new BadRequestException('Descrição, valor e vencimento são obrigatórios.')
    }
    const expense = await this.prisma.expense.create({
      data: {
        description: input.description.trim(),
        category: input.category?.trim() || null,
        supplier: input.supplier?.trim() || null,
        amount: this.money(input.amount),
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : new Date(),
        dueDate: new Date(input.dueDate),
        recurring: Boolean(input.recurring),
        notes: input.notes?.trim() || null,
        createdByName: this.actor(requester),
        updatedByName: this.actor(requester)
      }
    })
    return this.serializeExpense(expense)
  }

  async updateExpense(requester: FinancialRequester, id: string, input: ExpenseInput) {
    this.assertAdmin(requester)
    const current = await this.prisma.expense.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Despesa não encontrada.')
    if (current.status === 'CANCELLED') throw new BadRequestException('Uma despesa cancelada não pode ser alterada.')
    const data: any = {}
    data.updatedByName = this.actor(requester)
    if (input.description !== undefined) data.description = input.description.trim()
    if (input.category !== undefined) data.category = input.category.trim() || null
    if (input.supplier !== undefined) data.supplier = input.supplier.trim() || null
    if (input.amount !== undefined) data.amount = this.money(input.amount)
    if (input.issuedAt !== undefined) data.issuedAt = new Date(input.issuedAt)
    if (input.dueDate !== undefined) data.dueDate = new Date(input.dueDate)
    if (input.recurring !== undefined) data.recurring = input.recurring
    if (input.notes !== undefined) data.notes = input.notes.trim() || null
    const expense = await this.prisma.expense.update({ where: { id }, data })
    return this.serializeExpense(expense)
  }

  async payExpense(requester: FinancialRequester, id: string, input: { paidAt: string; method: string }) {
    this.assertAdmin(requester)
    const current = await this.prisma.expense.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Despesa não encontrada.')
    if (current.status === 'CANCELLED') throw new BadRequestException('Não é possível pagar uma despesa cancelada.')
    const expense = await this.prisma.expense.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(input.paidAt), paymentMethod: input.method, updatedByName: this.actor(requester) }
    })
    return this.serializeExpense(expense)
  }

  async reopenExpense(requester: FinancialRequester, id: string) {
    this.assertAdmin(requester)
    const current = await this.prisma.expense.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Despesa não encontrada.')
    if (current.status !== 'PAID') throw new BadRequestException('Apenas despesas pagas podem ter o pagamento estornado.')
    const expense = await this.prisma.expense.update({
      where: { id },
      data: { status: 'PENDING', paidAt: null, paymentMethod: null, updatedByName: this.actor(requester) }
    })
    return this.serializeExpense(expense)
  }

  async cancelExpense(requester: FinancialRequester, id: string) {
    this.assertAdmin(requester)
    const current = await this.prisma.expense.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Despesa não encontrada.')
    if (current.status === 'PAID') throw new BadRequestException('Uma despesa paga não pode ser cancelada.')
    const expense = await this.prisma.expense.update({ where: { id }, data: { status: 'CANCELLED', updatedByName: this.actor(requester) } })
    return this.serializeExpense(expense)
  }

  async deleteExpense(requester: FinancialRequester, id: string) {
    this.assertAdmin(requester)
    const current = await this.prisma.expense.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Despesa não encontrada.')
    if (current.status === 'PAID') throw new BadRequestException('Despesas pagas não podem ser excluídas.')
    await this.prisma.expense.delete({ where: { id } })
    return { ok: true }
  }

  async listServices(requester: FinancialRequester, includeInactive = false) {
    this.assertFinancialAccess(requester)
    const where = requester.role === 'ADMIN' && includeInactive ? {} : { active: true }
    const services = await this.prisma.clinicService.findMany({ where, orderBy: [{ active: 'desc' }, { name: 'asc' }] })
    return services.map((service: any) => ({ ...service, price: this.money(service.price) }))
  }

  async createService(requester: FinancialRequester, input: ServiceInput) {
    this.assertAdmin(requester)
    if (!input.name?.trim() || input.price === undefined) throw new BadRequestException('Nome e valor são obrigatórios.')
    const service = await this.prisma.clinicService.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        category: input.category?.trim() || null,
        price: this.money(input.price),
        durationMinutes: input.durationMinutes || null,
        active: input.active !== false,
        createdByName: this.actor(requester),
        updatedByName: this.actor(requester)
      }
    })
    return { ...service, price: this.money(service.price) }
  }

  async updateService(requester: FinancialRequester, id: string, input: ServiceInput) {
    this.assertAdmin(requester)
    const current = await this.prisma.clinicService.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Serviço não encontrado.')
    const data: any = {}
    data.updatedByName = this.actor(requester)
    if (input.name !== undefined) data.name = input.name.trim()
    if (input.description !== undefined) data.description = input.description.trim() || null
    if (input.category !== undefined) data.category = input.category.trim() || null
    if (input.price !== undefined) data.price = this.money(input.price)
    if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes || null
    if (input.active !== undefined) data.active = input.active
    const service = await this.prisma.clinicService.update({ where: { id }, data })
    return { ...service, price: this.money(service.price) }
  }

  async deleteService(requester: FinancialRequester, id: string) {
    this.assertAdmin(requester)
    const current = await this.prisma.clinicService.findUnique({ where: { id }, include: { _count: { select: { invoiceItems: true } } } })
    if (!current) throw new NotFoundException('Serviço não encontrado.')
    if (current._count.invoiceItems > 0) {
      const service = await this.prisma.clinicService.update({ where: { id }, data: { active: false, updatedByName: this.actor(requester) } })
      return { ...service, price: this.money(service.price), archived: true }
    }
    await this.prisma.clinicService.delete({ where: { id } })
    return { ok: true }
  }

  async summary(requester: FinancialRequester, from?: string, to?: string) {
    const scope = this.invoiceScope(requester)
    const { start, end } = this.dateRange(from, to)
    const [invoiceRows, expenseRows] = await Promise.all([
      this.prisma.invoice.findMany({ where: scope, include: invoiceInclude }),
      requester.role === 'ADMIN' ? this.prisma.expense.findMany() : Promise.resolve([])
    ])
    const invoices = invoiceRows.map((invoice: any) => this.serializeInvoice(invoice))
    const expenses = expenseRows.map((expense: any) => this.serializeExpense(expense))
    const inPeriod = (value: string | Date) => {
      const date = new Date(value)
      return date >= start && date <= end
    }

    const payments = invoices.flatMap((invoice: any) => invoice.payments.map((payment: any) => ({
      ...payment,
      invoiceId: invoice.id,
      patientName: invoice.patient.name,
      description: invoice.description
    })))
    const periodPayments = payments.filter((payment: any) => inPeriod(payment.paidAt))
    const periodExpenses = expenses.filter((expense: any) => expense.status === 'PAID' && expense.paidAt && inPeriod(expense.paidAt))
    const revenue = this.money(periodPayments.reduce((sum: number, payment: any) => sum + payment.amount, 0))
    const expenseTotal = this.money(periodExpenses.reduce((sum: number, expense: any) => sum + expense.amount, 0))
    const openInvoices = invoices.filter((invoice: any) => !['PAID', 'CANCELLED'].includes(invoice.status))
    const receivable = this.money(openInvoices.reduce((sum: number, invoice: any) => sum + invoice.remainingAmount, 0))
    const overdue = this.money(openInvoices.filter((invoice: any) => invoice.effectiveStatus === 'OVERDUE').reduce((sum: number, invoice: any) => sum + invoice.remainingAmount, 0))
    const payable = this.money(expenses.filter((expense: any) => expense.status === 'PENDING').reduce((sum: number, expense: any) => sum + expense.amount, 0))
    const uniquePaidInvoices = new Set(periodPayments.map((payment: any) => payment.invoiceId)).size

    const cashFlow: Array<{ label: string; income: number; expense: number }> = []
    for (let offset = 5; offset >= 0; offset--) {
      const monthStart = new Date(end.getFullYear(), end.getMonth() - offset, 1)
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999)
      const label = monthStart.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      cashFlow.push({
        label,
        income: this.money(payments.filter((payment: any) => new Date(payment.paidAt) >= monthStart && new Date(payment.paidAt) <= monthEnd).reduce((sum: number, payment: any) => sum + payment.amount, 0)),
        expense: this.money(expenses.filter((expense: any) => expense.status === 'PAID' && expense.paidAt && new Date(expense.paidAt) >= monthStart && new Date(expense.paidAt) <= monthEnd).reduce((sum: number, expense: any) => sum + expense.amount, 0))
      })
    }

    const serviceMap = new Map<string, { name: string; quantity: number; total: number }>()
    invoices
      .filter((invoice: any) => invoice.status !== 'CANCELLED' && inPeriod(invoice.issuedAt))
      .flatMap((invoice: any) => invoice.items)
      .forEach((item: any) => {
        const key = item.service?.id || item.description.toLowerCase()
        const current = serviceMap.get(key) || { name: item.service?.name || item.description, quantity: 0, total: 0 }
        current.quantity += item.quantity
        current.total = this.money(current.total + item.total)
        serviceMap.set(key, current)
      })

    const methodMap = new Map<string, number>()
    periodPayments.forEach((payment: any) => methodMap.set(payment.method, this.money((methodMap.get(payment.method) || 0) + payment.amount)))

    const recentMovements = [
      ...periodPayments.map((payment: any) => ({
        id: payment.id,
        type: 'INCOME',
        description: payment.description,
        detail: payment.patientName,
        amount: payment.amount,
        date: payment.paidAt,
        method: payment.method
      })),
      ...periodExpenses.map((expense: any) => ({
        id: expense.id,
        type: 'EXPENSE',
        description: expense.description,
        detail: expense.supplier || expense.category || 'Despesa da clínica',
        amount: expense.amount,
        date: expense.paidAt,
        method: expense.paymentMethod
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)

    return {
      role: requester.role,
      period: { from: start, to: end },
      kpis: {
        revenue,
        expenses: expenseTotal,
        balance: this.money(revenue - expenseTotal),
        receivable,
        overdue,
        payable,
        averageTicket: uniquePaidInvoices ? this.money(revenue / uniquePaidInvoices) : 0
      },
      counts: {
        pending: invoices.filter((invoice: any) => invoice.effectiveStatus === 'PENDING').length,
        partial: invoices.filter((invoice: any) => invoice.effectiveStatus === 'PARTIAL').length,
        overdue: invoices.filter((invoice: any) => invoice.effectiveStatus === 'OVERDUE').length,
        paid: invoices.filter((invoice: any) => invoice.status === 'PAID').length
      },
      cashFlow,
      topServices: [...serviceMap.values()].sort((a, b) => b.total - a.total).slice(0, 5),
      paymentMethods: [...methodMap.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
      recentMovements,
      upcomingReceivables: openInvoices.filter((invoice: any) => invoice.effectiveStatus !== 'OVERDUE').sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 5),
      overdueReceivables: openInvoices.filter((invoice: any) => invoice.effectiveStatus === 'OVERDUE').sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 5)
    }
  }
}
