import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken'

@Injectable()
export class MasterAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest()
    const authHeader = req.headers.authorization || ''
    if (!authHeader.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente')
    const token = authHeader.slice(7)
    let payload: { scope?: string; sub?: string }
    try {
      payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET || 'secret' }) as typeof payload
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        throw new UnauthorizedException('Sessão expirada. Faça login novamente.')
      }
      if (e instanceof JsonWebTokenError) {
        throw new UnauthorizedException('Token inválido')
      }
      throw new UnauthorizedException('Não autorizado')
    }
    if (!payload || payload.scope !== 'MASTER_ADMIN') throw new UnauthorizedException('Token inválido')
    req.masterAdmin = payload
    return true
  }
}
