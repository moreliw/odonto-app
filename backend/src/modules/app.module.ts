import { Module, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { TenancyModule } from './tenancy/tenancy.module'
import { AuthModule } from './auth/auth.module'
import { PatientsModule } from './patients/patients.module'
import { AppointmentsModule } from './appointments/appointments.module'
import { FilesModule } from './files/files.module'
import { RecordsModule } from './records/records.module'
import { UsersModule } from './users/users.module'
import { JobsModule } from './jobs/jobs.module'
import { PublicModule } from './public/public.module'
import { TenantResolverMiddleware } from './tenancy/tenant-resolver.middleware'
import { DashboardModule } from './dashboard/dashboard.module'
import { MasterAdminModule } from './master-admin/master-admin.module'
import { BillingModule } from './billing/billing.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        ...(process.env.LOG_TO_FILE === 'true'
          ? { transport: { target: 'pino/file', options: { destination: '/var/log/app-backend.log' } } }
          : {})
      }
    }),
    TenancyModule,
    AuthModule,
    PatientsModule,
    AppointmentsModule,
    FilesModule,
    RecordsModule,
    UsersModule,
    JobsModule,
    PublicModule,
    DashboardModule,
    MasterAdminModule,
    BillingModule
  ]
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantResolverMiddleware).forRoutes('*')
  }
}
