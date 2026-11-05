import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { Throttle } from '@nestjs/throttler'
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { Request } from 'express'
import { PermissionGuard } from '../access-control/permission.guard'
import { RequirePermission } from '../access-control/require-permission.decorator'
import { AssistantService } from './assistant.service'

class ConsentDto {
  @Equals('true', { message: 'Confirme a revisão do conteúdo e o uso do provedor de IA antes de gerar.' })
  consent: string
}
class PhotoDto extends ConsentDto {
  @IsDateString() referenceDate: string
}
class EvolutionDto extends ConsentDto {
  @IsString() @MinLength(1) patientId: string
  @IsOptional() @IsString() @MaxLength(20_000) dictation?: string
}
class ReviewedAppointmentDto {
  @IsString() @MinLength(1) patientId: string
  @IsOptional() @IsString() dentistId?: string
  @IsString() @MaxLength(16) startLocal: string
  @IsString() @MaxLength(16) endLocal: string
  @IsOptional() @IsString() @MaxLength(2000) notes?: string
}
class ApprovalDto {
  @Equals(true, { message: 'Confirme que revisou os dados antes de salvar.' }) reviewed: boolean
}
class AppointmentsApprovalDto extends ApprovalDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => ReviewedAppointmentDto)
  appointments: ReviewedAppointmentDto[]
}
class TextApprovalDto extends ApprovalDto {
  @IsString() @MinLength(1) @MaxLength(20_000) text: string
}
class EstimateDto {
  @IsString() @MinLength(1) patientId: string
  @IsString() @MinLength(2) @MaxLength(160) title: string
  @IsInt() @Min(0) @Max(100_000_000) amountCents: number
  @IsOptional() @IsString() @MaxLength(2000) notes?: string
  @IsOptional() @IsDateString() proposedAt?: string
}
class EstimateStatusDto {
  @IsIn(['PROPOSED', 'APPROVED', 'DECLINED', 'EXPIRED']) status: string
}
class RecallDto {
  @IsInt() @Min(0) @Max(60) intervalMonths: number
  @IsOptional() @IsDateString() dueDate?: string
}
class MessageDto extends ConsentDto {
  @IsIn(['ESTIMATE', 'PLAN', 'RECALL']) kind: string
  @IsString() @MinLength(1) targetId: string
}
class WeeklySettingsDto extends ConsentDto {
  @IsBoolean() enabled: boolean
}

const uploads = (kind: 'image' | 'audio') => FileInterceptor('file', {
  limits: { fileSize: kind === 'image' ? 8 * 1024 * 1024 : 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = kind === 'image' ? ['image/jpeg', 'image/png', 'image/webp'] : ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'video/webm', 'video/mp4']
    cb(allowed.includes(file.mimetype) ? null : new BadRequestException(kind === 'image' ? 'Envie uma foto JPG, PNG ou WebP de até 8 MB.' : 'Envie áudio MP3, MP4, WAV, OGG ou WebM de até 20 MB.'), allowed.includes(file.mimetype))
  }
})

@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('workspace')
  workspace(@Req() req: Request) { return this.assistant.workspace((req as any).user) }

  @Post('photo')
  @RequirePermission('APPOINTMENTS_MANAGE')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseInterceptors(uploads('image'))
  photo(@Req() req: Request, @Body() dto: PhotoDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Selecione uma foto da agenda.')
    return this.assistant.photo((req as any).user, file, dto.referenceDate)
  }

  @Post('drafts/:id/appointments')
  @RequirePermission('APPOINTMENTS_MANAGE')
  appointments(@Req() req: Request, @Param('id') id: string, @Body() dto: AppointmentsApprovalDto) {
    return this.assistant.approveAppointments((req as any).user, id, dto.appointments)
  }

  @Post('evolution')
  @RequirePermission('RECORDS_MANAGE')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseInterceptors(uploads('audio'))
  evolution(@Req() req: Request, @Body() dto: EvolutionDto, @UploadedFile() file?: Express.Multer.File) {
    return this.assistant.evolution((req as any).user, dto.patientId, file, dto.dictation)
  }

  @Post('drafts/:id/evolution')
  @RequirePermission('RECORDS_MANAGE')
  approveEvolution(@Req() req: Request, @Param('id') id: string, @Body() dto: TextApprovalDto) {
    return this.assistant.approveEvolution((req as any).user, id, dto.text)
  }

  @Post('estimates')
  @RequirePermission('FINANCE_MANAGE')
  estimate(@Req() req: Request, @Body() dto: EstimateDto) { return this.assistant.createEstimate((req as any).user, dto) }

  @Patch('estimates/:id')
  @RequirePermission('FINANCE_MANAGE')
  estimateStatus(@Req() req: Request, @Param('id') id: string, @Body() dto: EstimateStatusDto) { return this.assistant.updateEstimate((req as any).user, id, dto.status) }

  @Patch('recalls/:patientId')
  @RequirePermission('PATIENTS_MANAGE')
  recall(@Req() req: Request, @Param('patientId') id: string, @Body() dto: RecallDto) { return this.assistant.configureRecall((req as any).user, id, dto) }

  @Post('messages')
  @RequirePermission('PATIENTS_MANAGE')
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  message(@Req() req: Request, @Body() dto: MessageDto) { return this.assistant.message((req as any).user, dto.kind, dto.targetId) }

  @Post('drafts/:id/whatsapp')
  @RequirePermission('PATIENTS_MANAGE')
  whatsapp(@Req() req: Request, @Param('id') id: string, @Body() dto: TextApprovalDto) { return this.assistant.prepareMessage((req as any).user, id, dto.text) }

  @Get('weekly')
  @RequirePermission('DASHBOARD_VIEW')
  weekly(@Req() req: Request) { return this.assistant.weekly((req as any).user) }

  @Post('weekly-settings')
  weeklySettings(@Req() req: Request, @Body() dto: WeeklySettingsDto) { return this.assistant.weeklySettings((req as any).user, dto.enabled) }

  @Post('weekly')
  @RequirePermission('DASHBOARD_VIEW')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  generateWeekly(@Req() req: Request, @Body() _dto: ConsentDto) { return this.assistant.weekly((req as any).user, true) }
}
