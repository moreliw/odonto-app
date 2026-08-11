import { Body, Controller, ForbiddenException, Get, Patch, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { IsString, MaxLength } from 'class-validator'
import { Request } from 'express'
import { WhatsappService } from './whatsapp.service'

class UpdateWhatsappSettingsDto {
  @IsString()
  @MaxLength(32)
  number: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('whatsapp-settings')
export class WhatsappSettingsController {
  constructor(private readonly whatsapp: WhatsappService) {}

  private admin(req: Request) {
    const user = (req as any).user
    if (user?.role !== 'ADMIN') throw new ForbiddenException('Apenas o administrador pode configurar o WhatsApp da clínica.')
    return user
  }

  @Get()
  get(@Req() req: Request) {
    this.admin(req)
    return this.whatsapp.getSettings()
  }

  @Patch()
  update(@Req() req: Request, @Body() dto: UpdateWhatsappSettingsDto) {
    const user = this.admin(req)
    return this.whatsapp.updateSettings(dto.number, user.email || user.userId)
  }
}
