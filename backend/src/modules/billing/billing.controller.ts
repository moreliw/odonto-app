import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common'
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { RawBodyRequest } from '@nestjs/common'
import { Request } from 'express'
import { Plan } from '@prisma/client-master'
import { BillingService } from './billing.service'

class CreateCheckoutSessionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  clinicName: string

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  adminName?: string

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z0-9-]+$/)
  subdomain?: string

  @IsEmail()
  adminEmail: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  adminPassword: string

  @IsEnum(['BASIC', 'PRO'] as any)
  plan: Plan
}

@Controller('public')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans() {
    return this.billing.getPublicPlans()
  }

  @Post('billing/checkout-session')
  createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.billing.createCheckoutSession({
      clinicName: dto.clinicName,
      adminName: dto.adminName,
      requestedSubdomain: dto.subdomain,
      adminEmail: dto.adminEmail,
      adminPassword: dto.adminPassword,
      plan: dto.plan
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
