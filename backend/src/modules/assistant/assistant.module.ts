import { Module } from '@nestjs/common'
import { AiClient } from './ai-client'
import { AssistantController } from './assistant.controller'
import { AssistantService } from './assistant.service'
import { WeeklySummaryJob } from './weekly-summary.job'

@Module({ controllers: [AssistantController], providers: [AiClient, AssistantService, WeeklySummaryJob] })
export class AssistantModule {}
