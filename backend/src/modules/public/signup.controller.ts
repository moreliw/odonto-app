import { Body, Controller, Get, Headers, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common'
import { PublicService } from './public.service'
import { IsEmail, IsEnum, IsIn, IsString, MinLength, MaxLength } from 'class-validator'
import { Throttle } from '@nestjs/throttler'
import { Request, Response } from 'express'
import { createClinicMonogram } from './branding-preview'
import { renderConfirmationSharePage } from './confirmation-share'

function publicOrigin(req: Request) {
  const configured = process.env.PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  const protocol = req.headers['x-forwarded-proto']?.toString().split(',')[0] || req.protocol || 'https'
  const host = req.headers['x-forwarded-host']?.toString().split(',')[0] || req.get('host') || ''
  return `${protocol}://${host}`.replace(/\/+$/, '')
}

function absoluteUrl(value: string, origin: string) {
  try {
    const url = new URL(value, `${origin}/`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

class ConfirmAppointmentDto {
  @IsIn(['CONFIRM', 'DECLINE'])
  action: 'CONFIRM' | 'DECLINE'
}

class SignupDto {
  @IsString()
  name: string
  @IsEmail()
  adminEmail: string
  @IsString()
  adminPassword: string
  @IsEnum(['BASIC', 'PRO'] as any)
  plan: 'BASIC' | 'PRO'
}

class PublicLoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  identifier: string
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string
}

@Controller('public')
export class SignupController {
  constructor(private readonly service: PublicService) {}

  @Get('ping')
  ping() {
    return { ok: true, service: 'odonto-backend', t: Date.now() }
  }

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.service.signup(dto)
  }
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() dto: PublicLoginDto) {
    return this.service.loginByIdentifier(dto.identifier, dto.password)
  }

  /** Identidade visual da clínica (nome, cor, logo). Usada pelo app após o login para aplicar o tema da clínica. */
  @Get('branding')
  branding(@Headers('x-tenant') tenantHeader?: string, @Query('subdomain') subdomainQuery?: string) {
    return this.service.getBranding((tenantHeader || subdomainQuery || '').toString())
  }

  /** Imagem neutra com as iniciais e a cor da clínica, usada quando ainda não há logo cadastrada. */
  @Get('branding/preview/:subdomain')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async brandingPreview(@Param('subdomain') subdomain: string, @Res() res: Response) {
    const branding = await this.service.getBranding(subdomain)
    if (!branding?.name) throw new NotFoundException('Clínica não encontrada.')
    const png = createClinicMonogram(branding.name, branding.primaryColor)
    res.set({ 'Content-Type': 'image/png', 'Content-Length': png.length.toString(), 'Cache-Control': 'public, max-age=86400' })
    return res.send(png)
  }

  /** Tela pública de confirmação de consulta — o paciente acessa pelo link do e-mail, sem login. */
  @Get('appointments/confirm/:subdomain/:token')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  getConfirmation(@Param('subdomain') subdomain: string, @Param('token') token: string) {
    return this.service.getAppointmentConfirmation(subdomain, token)
  }

  /**
   * Página lida pelo WhatsApp para montar a prévia da clínica. No navegador, encaminha o
   * paciente imediatamente à tela Angular que já trata a confirmação.
   */
  @Get('appointments/share/:subdomain/:token')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async shareConfirmation(
    @Param('subdomain') subdomain: string,
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const confirmation = await this.service.getAppointmentConfirmation(subdomain, token)
    const origin = publicOrigin(req)
    const encodedSubdomain = encodeURIComponent(subdomain)
    const encodedToken = encodeURIComponent(token)
    const shareUrl = `${origin}/c/${encodedSubdomain}/${encodedToken}`
    const confirmationUrl = `${origin}/confirmar/${encodedSubdomain}/${encodedToken}`
    const fallbackLogoUrl = `${origin}/api/public/branding/preview/${encodedSubdomain}`
    const logoUrl = (confirmation.logoUrl && absoluteUrl(confirmation.logoUrl, origin)) || fallbackLogoUrl
    const clinicName = confirmation.clinicName || 'Clínica odontológica'

    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Content-Security-Policy': "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    })
    return res.send(
      renderConfirmationSharePage({
        clinicName,
        primaryColor: confirmation.primaryColor,
        logoUrl,
        shareUrl,
        confirmationUrl
      })
    )
  }

  @Post('appointments/confirm/:subdomain/:token')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  respondConfirmation(@Param('subdomain') subdomain: string, @Param('token') token: string, @Body() dto: ConfirmAppointmentDto) {
    return this.service.respondAppointmentConfirmation(subdomain, token, dto.action)
  }
}
