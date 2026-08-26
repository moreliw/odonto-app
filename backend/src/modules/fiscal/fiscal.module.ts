import { Module } from '@nestjs/common'
import { FiscalController } from './fiscal.controller'
import { FiscalService } from './fiscal.service'
import { NuvemFiscalClient } from './nuvem-fiscal.client'

@Module({
  controllers: [FiscalController],
  providers: [FiscalService, NuvemFiscalClient]
})
export class FiscalModule {}
