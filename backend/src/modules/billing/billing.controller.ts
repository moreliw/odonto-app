import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common'
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { RawBodyRequest } from '@nestjs/common'
import { Request } from 'express'
import { Plan, BillingInterval } from '@prisma/client-master'
import { BillingService } from './billing.service'
import { Throttle } from '@nestjs/throttler'

class CreateCheckoutSessionDto {
  @IsString({ message: 'Informe o nome da clínica.' })
  @MinLength(3, { message: 'O nome da clínica precisa ter ao menos 3 caracteres.' })
  @MaxLength(120, { message: 'O nome da clínica pode ter no máximo 120 caracteres.' })
  clinicName: string

  @IsOptional()
  @IsString({ message: 'Informe o nome do responsável.' })
  @MinLength(2, { message: 'O nome do responsável precisa ter ao menos 2 caracteres.' })
  @MaxLength(80, { message: 'O nome do responsável pode ter no máximo 80 caracteres.' })
  adminName?: string

  @IsOptional()
  @IsString({ message: 'Endereço da clínica inválido.' })
  @MinLength(3, { message: 'O endereço da clínica precisa ter ao menos 3 caracteres.' })
  @MaxLength(40, { message: 'O endereço da clínica pode ter no máximo 40 caracteres.' })
  @Matches(/^[a-z0-9-]+$/, { message: 'Use apenas letras minúsculas, números e hífen no endereço da clínica.' })
  subdomain?: string

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  adminEmail: string

  @IsString({ message: 'Informe uma senha.' })
  @MinLength(8, { message: 'A senha precisa ter ao menos 8 caracteres.' })
  @MaxLength(128, { message: 'A senha pode ter no máximo 128 caracteres.' })
  adminPassword: string

  @IsEnum(['FREE', 'BASIC', 'PRO', 'CLINIC'] as any, { message: 'Escolha um plano válido.' })
  plan: Plan

  @IsOptional()
  @IsEnum(['MONTH', 'YEAR'] as any, { message: 'Ciclo de cobrança inválido.' })
  billingInterval?: BillingInterval
}

@Controller('public')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans() {
    return this.billing.getPublicPlans()
  }

  @Post('billing/checkout-session')
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.billing.createCheckoutSession({
      clinicName: dto.clinicName,
      adminName: dto.adminName,
      requestedSubdomain: dto.subdomain,
      adminEmail: dto.adminEmail,
      adminPassword: dto.adminPassword,
      plan: dto.plan,
      billingInterval: dto.billingInterval
    })
  }

  @Get('billing/session/:sessionId')
  sessionStatus(@Param('sessionId') sessionId: string) {
    return this.billing.getCheckoutSessionStatus(sessionId)
  }

  @Post('billing/webhook/stripe')
  @HttpCode(200)
  webhookStripe(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    return this.billing.handleStripeWebhook(req.rawBody, signature)
  }
}
