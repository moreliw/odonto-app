import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient as MasterPrisma } from '@prisma/client-master'

@Injectable()
export class MasterPrismaService extends MasterPrisma implements OnModuleDestroy {
  constructor() {
    const useSqlite = process.env.DEV_SQLITE === 'true'
    const url = useSqlite ? 'file:./prisma/dev-master.db' : process.env.MASTER_DATABASE_URL
    super({ datasources: { db: { url } } })
  }
  async onModuleDestroy() {
    await this.$disconnect()
  }
}
