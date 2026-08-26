import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { Request, Response } from 'express'
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator'
import { PermissionGuard } from '../access-control/permission.guard'
import { RequirePermission } from '../access-control/require-permission.decorator'
import { FiscalRequester, FiscalService } from './fiscal.service'

class FiscalSettingsDto {
  @IsBoolean() enabled: boolean
  @IsIn(['SANDBOX', 'PRODUCTION']) environment: 'SANDBOX' | 'PRODUCTION'
  @IsIn(['NATIONAL', 'MUNICIPAL']) providerMode: 'NATIONAL' | 'MUNICIPAL'
  @IsString() @MinLength(11) @MaxLength(20) taxId: string
  @IsOptional() @IsString() @MaxLength(50) municipalRegistration?: string
  @IsOptional() @IsString() @MaxLength(50) stateRegistration?: string
  @IsString() @MinLength(2) @MaxLength(500) legalName: string
  @IsOptional() @IsString() @MaxLength(500) tradeName?: string
  @IsEmail() @MaxLength(320) email: string
  @IsOptional() @IsString() @MaxLength(30) phone?: string
  @IsString() @MaxLength(12) postalCode: string
  @IsString() @MinLength(2) @MaxLength(255) street: string
  @IsString() @MinLength(1) @MaxLength(60) number: string
  @IsOptional() @IsString() @MaxLength(120) complement?: string
  @IsString() @MinLength(2) @MaxLength(120) neighborhood: string
  @IsString() @MinLength(2) @MaxLength(120) city: string
  @IsString() @Matches(/^[A-Za-z]{2}$/) state: string
  @IsString() @Matches(/^\d{7}$/) cityCode: string
  @IsInt() @Min(1) @Max(3) simpleNationalOption: number
  @IsInt() @Min(0) @Max(3) simpleNationalTaxRegime: number
  @IsInt() @Min(0) @Max(6) specialTaxRegime: number
  @IsBoolean() fiscalIncentive: boolean
  @IsString() @MinLength(1) @MaxLength(20) rpsSeries: string
  @IsInt() @Min(0) rpsBatch: number
  @IsInt() @Min(0) rpsNumber: number
  @IsString() @MinLength(4) @MaxLength(20) defaultNationalTaxCode: string
  @IsOptional() @IsString() @MaxLength(30) defaultMunicipalTaxCode?: string
  @IsOptional() @IsString() @MaxLength(20) defaultCnae?: string
  @IsOptional() @IsString() @MaxLength(20) defaultNbs?: string
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultIssRate?: number
  @IsBoolean() defaultIssWithheld: boolean
}

class IssueFiscalInvoiceDto {
  @IsString() invoiceId: string
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) serviceDate: string
  @IsString() @MinLength(3) @MaxLength(2000) serviceDescription: string
  @IsOptional() @IsString() @MaxLength(20) nationalTaxCode?: string
  @IsOptional() @IsString() @MaxLength(30) municipalTaxCode?: string
  @IsOptional() @IsString() @MaxLength(20) cnae?: string
  @IsOptional() @IsString() @MaxLength(20) nbs?: string
  @IsOptional() @IsNumber() @Min(0) @Max(100) issRate?: number
  @IsOptional() @IsBoolean() issWithheld?: boolean
  @IsOptional() @IsString() @MaxLength(20) customerDocument?: string
  @IsOptional() @IsEmail() @MaxLength(320) customerEmail?: string
  @IsOptional() @IsString() @MaxLength(30) customerPhone?: string
  @IsOptional() @IsString() @MaxLength(12) customerPostalCode?: string
  @IsOptional() @IsString() @MaxLength(255) customerStreet?: string
  @IsOptional() @IsString() @MaxLength(60) customerNumber?: string
  @IsOptional() @IsString() @MaxLength(120) customerComplement?: string
  @IsOptional() @IsString() @MaxLength(120) customerNeighborhood?: string
  @IsOptional() @IsString() @MaxLength(120) customerCity?: string
  @IsOptional() @IsString() @Matches(/^[A-Za-z]{2}$/) customerState?: string
  @IsOptional() @IsString() @Matches(/^\d{7}$/) customerCityCode?: string
}

class CancelFiscalInvoiceDto {
  @IsOptional() @IsString() @MaxLength(20) code?: string
  @IsString() @MinLength(15) @MaxLength(255) reason: string
}

class CertificateDto {
  @IsString() @MinLength(1) @MaxLength(300) password: string
}

class ProviderSyncDto {
  @IsOptional() @IsString() @MaxLength(200) municipalLogin?: string
  @IsOptional() @IsString() @MaxLength(300) municipalPassword?: string
  @IsOptional() @IsString() @MaxLength(1000) municipalToken?: string
}

@UseGuards(AuthGuard('jwt'), PermissionGuard)
@RequirePermission('FISCAL_VIEW')
@Controller('fiscal')
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  private requester(req: Request) { return (req as any).user as FiscalRequester }

  @Get()
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.fiscal.list({ search, status, from, to })
  }

  @Get('settings')
  settings() { return this.fiscal.getSettings() }

  @Put('settings')
  @RequirePermission('FISCAL_CONFIGURE')
  saveSettings(@Req() req: Request, @Body() dto: FiscalSettingsDto) {
    return this.fiscal.saveSettings(this.requester(req), dto)
  }

  @Get('provider/status')
  @RequirePermission('FISCAL_CONFIGURE')
  providerStatus() { return this.fiscal.providerStatus() }

  @Post('provider/sync')
  @RequirePermission('FISCAL_CONFIGURE')
  syncProvider(@Req() req: Request, @Body() dto: ProviderSyncDto) {
    return this.fiscal.syncProvider(this.requester(req), {
      login: dto.municipalLogin,
      password: dto.municipalPassword,
      token: dto.municipalToken
    })
  }

  @Post('provider/certificate')
  @RequirePermission('FISCAL_CONFIGURE')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  certificate(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CertificateDto
  ) {
    return this.fiscal.uploadCertificate(this.requester(req), file, dto.password)
  }

  @Get('eligible-invoices')
  @RequirePermission('FISCAL_MANAGE')
  eligibleInvoices() { return this.fiscal.eligibleInvoices() }

  @Post()
  @RequirePermission('FISCAL_MANAGE')
  issue(@Req() req: Request, @Body() dto: IssueFiscalInvoiceDto) {
    return this.fiscal.issue(this.requester(req), dto)
  }

  @Post(':id/sync')
  @RequirePermission('FISCAL_MANAGE')
  sync(@Req() req: Request, @Param('id') id: string) {
    return this.fiscal.sync(this.requester(req), id)
  }

  @Post(':id/cancel')
  @RequirePermission('FISCAL_MANAGE')
  cancel(@Req() req: Request, @Param('id') id: string, @Body() dto: CancelFiscalInvoiceDto) {
    return this.fiscal.cancel(this.requester(req), id, dto.code || '1', dto.reason)
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() response: Response) {
    const file = await this.fiscal.download(id, 'pdf')
    response.setHeader('Content-Type', file.contentType)
    response.setHeader('Content-Disposition', `inline; filename="${safeFilename(file.filename)}"`)
    response.send(file.body)
  }

  @Get(':id/xml')
  async xml(@Param('id') id: string, @Res() response: Response) {
    const file = await this.fiscal.download(id, 'xml')
    response.setHeader('Content-Type', file.contentType)
    response.setHeader('Content-Disposition', `attachment; filename="${safeFilename(file.filename)}"`)
    response.send(file.body)
  }
}

function safeFilename(value: string) { return value.replace(/[^a-zA-Z0-9._-]/g, '-') }
