import { NestFactory } from '@nestjs/core'
import { AppModule } from './modules/app.module'
import { ValidationPipe } from '@nestjs/common'
import { Logger } from 'nestjs-pino'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { HttpAllExceptionsFilter } from './http-exception.filter'
import helmet from 'helmet'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true })
  app.getHttpAdapter().getInstance().set('trust proxy', 1)
  app.use(helmet({ crossOriginResourcePolicy: false }))
  app.useLogger(app.get(Logger))
  app.setGlobalPrefix('api')
  app.useGlobalFilters(new HttpAllExceptionsFilter())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  if (process.env.APP_ENV !== 'production') {
    const config = new DocumentBuilder().setTitle('Odonto SaaS API').setVersion('0.1.0').addBearerAuth().build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
  }
  app.enableShutdownHooks()
  const port = process.env.PORT ? Number(process.env.PORT) : 3000
  await app.listen(port)
}

bootstrap()
