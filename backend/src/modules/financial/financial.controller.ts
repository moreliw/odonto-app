import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request } from 'express'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from 'class-validator'
import { FinancialService, FinancialRequester } from './financial.service'

enum PaymentMethodDto {
  CASH = 'CASH',
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  BOLETO = 'BOLETO',
  OTHER = 'OTHER'
}

class InvoiceItemDto {
  @IsOptional()
  @IsString()
  serviceId?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number
}

class CreateInvoiceDto {
  @IsString()
  patientId: string

  @IsOptional()
  @IsString()
  dentistId?: string

  @IsOptional()
  @IsString()
  dentistName?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number

  @IsOptional()
  @IsDateString()
  issuedAt?: string

  @IsDateString()
  dueDate: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[]
}

class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  patientId?: string

  @IsOptional()
  @IsString()
  dentistId?: string

  @IsOptional()
  @IsString()
  dentistName?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number

  @IsOptional()
  @IsDateString()
  issuedAt?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[]
}

class PaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number

  @IsDateString()
  paidAt: string

  @IsEnum(PaymentMethodDto)
  method: PaymentMethodDto

  @IsOptional()
  @IsString()
  notes?: string
}

class ExpenseDto {
  @IsString()
  description: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsString()
  supplier?: string

  @IsNumber()
  @Min(0.01)
  amount: number

  @IsOptional()
  @IsDateString()
  issuedAt?: string

  @IsDateString()
  dueDate: string

  @IsOptional()
  @IsBoolean()
  recurring?: boolean

  @IsOptional()
  @IsString()
  notes?: string
}

class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsString()
  supplier?: string

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number

  @IsOptional()
  @IsDateString()
  issuedAt?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsBoolean()
  recurring?: boolean

  @IsOptional()
  @IsString()
  notes?: string
}

class PayExpenseDto {
  @IsDateString()
  paidAt: string

  @IsEnum(PaymentMethodDto)
  method: PaymentMethodDto
}

class ClinicServiceDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsNumber()
  @Min(0)
  price: number

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number

  @IsOptional()
  @IsBoolean()
  active?: boolean
}

class UpdateClinicServiceDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number

  @IsOptional()
  @IsBoolean()
  active?: boolean
}

@UseGuards(AuthGuard('jwt'))
@Controller('financial')
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  private requester(req: Request): FinancialRequester {
    return (req as any).user as FinancialRequester
  }

  @Get('summary')
  summary(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string) {
    return this.financial.summary(this.requester(req), from, to)
  }

  @Get('invoices')
  invoices(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.financial.listInvoices(this.requester(req), { search, status, from, to })
  }

  @Post('invoices')
  createInvoice(@Req() req: Request, @Body() dto: CreateInvoiceDto) {
    return this.financial.createInvoice(this.requester(req), dto)
  }

  @Patch('invoices/:id')
  updateInvoice(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.financial.updateInvoice(this.requester(req), id, dto)
  }

  @Post('invoices/:id/payments')
  addPayment(@Req() req: Request, @Param('id') id: string, @Body() dto: PaymentDto) {
    return this.financial.addPayment(this.requester(req), id, dto)
  }

  @Delete('invoices/:invoiceId/payments/:paymentId')
  removePayment(@Req() req: Request, @Param('invoiceId') invoiceId: string, @Param('paymentId') paymentId: string) {
    return this.financial.removePayment(this.requester(req), invoiceId, paymentId)
  }

  @Post('invoices/:id/cancel')
  cancelInvoice(@Req() req: Request, @Param('id') id: string) {
    return this.financial.cancelInvoice(this.requester(req), id)
  }

  @Delete('invoices/:id')
  deleteInvoice(@Req() req: Request, @Param('id') id: string) {
    return this.financial.deleteInvoice(this.requester(req), id)
  }

  @Get('expenses')
  expenses(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.financial.listExpenses(this.requester(req), { search, status, from, to })
  }

  @Post('expenses')
  createExpense(@Req() req: Request, @Body() dto: ExpenseDto) {
    return this.financial.createExpense(this.requester(req), dto)
  }

  @Patch('expenses/:id')
  updateExpense(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.financial.updateExpense(this.requester(req), id, dto)
  }

  @Post('expenses/:id/pay')
  payExpense(@Req() req: Request, @Param('id') id: string, @Body() dto: PayExpenseDto) {
    return this.financial.payExpense(this.requester(req), id, dto)
  }

  @Post('expenses/:id/reopen')
  reopenExpense(@Req() req: Request, @Param('id') id: string) {
    return this.financial.reopenExpense(this.requester(req), id)
  }

  @Post('expenses/:id/cancel')
  cancelExpense(@Req() req: Request, @Param('id') id: string) {
    return this.financial.cancelExpense(this.requester(req), id)
  }

  @Delete('expenses/:id')
  deleteExpense(@Req() req: Request, @Param('id') id: string) {
    return this.financial.deleteExpense(this.requester(req), id)
  }

  @Get('services')
  services(@Req() req: Request, @Query('includeInactive') includeInactive?: string) {
    return this.financial.listServices(this.requester(req), includeInactive === 'true')
  }

  @Post('services')
  createService(@Req() req: Request, @Body() dto: ClinicServiceDto) {
    return this.financial.createService(this.requester(req), dto)
  }

  @Patch('services/:id')
  updateService(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateClinicServiceDto) {
    return this.financial.updateService(this.requester(req), id, dto)
  }

  @Delete('services/:id')
  deleteService(@Req() req: Request, @Param('id') id: string) {
    return this.financial.deleteService(this.requester(req), id)
  }
}
