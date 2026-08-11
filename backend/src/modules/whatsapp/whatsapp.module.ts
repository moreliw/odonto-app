import { Module } from '@nestjs/common'
import { WhatsappService } from './whatsapp.service'
import { WhatsappSettingsController } from './whatsapp-settings.controller'

@Module({ providers: [WhatsappService], controllers: [WhatsappSettingsController], exports: [WhatsappService] })
export class WhatsappModule {}
