import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient as MasterPrisma } from '@prisma/client-master'

@Injectable()
export class MasterPrismaService extends MasterPrisma implements OnModuleDestroy {
  constructor() {
    const useSqlite = process.env.DEV_SQLITE === 'true'
    super(useSqlite ? { datasources: { db: { url: 'file:./prisma/dev-master.db' } } } : undefined as any)
  }
  async onModuleDestroy() {
    await this.$disconnect()
  }
}
