import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { InvoicesService } from './invoices.service'
import { AuthGuard } from '@nestjs/passport'
import { IsString, IsNumber, IsDateString } from 'class-validator'

class InvoiceDto {
  @IsString()
  patientId: string
  @IsNumber()
  amount: number
  @IsDateString()
  issuedAt: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}
  @Get()
  list() {
    return this.invoices.list()
  }
  @Post()
  create(@Body() dto: InvoiceDto) {
    const data = { patientId: dto.patientId, amount: dto.amount, issuedAt: new Date(dto.issuedAt) }
    return this.invoices.create(data)
  }
}
