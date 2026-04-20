import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'

/** Garante stack no stdout/stderr do Docker (nestjs-pino às vezes não exibe 5xx). */
@Catch()
export class HttpAllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      if (status >= 500) {
        console.error('[HTTP 5xx]', exception.message, exception.stack, body)
      }
      res
        .status(status)
        .json(typeof body === 'object' && body !== null ? body : { statusCode: status, message: body })
      return
    }

    console.error('[HTTP 500 unhandled]', exception instanceof Error ? exception.stack : exception)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error'
    })
  }
}
