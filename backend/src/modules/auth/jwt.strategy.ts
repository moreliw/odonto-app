import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Request } from 'express'
import { RequestContext } from '../tenancy/request-context'
import { sharedTenantClient } from '../tenancy/tenant-prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: process.env.JWT_SECRET || 'secret'
    })
  }
  async validate(req: Request, payload: any) {
    const tenant = req.tenantContext ?? RequestContext.get()
    if (!tenant || typeof payload.sub !== 'string') throw new UnauthorizedException('Sessão inválida para esta clínica.')
    const user = await sharedTenantClient(tenant.connectionString).user.findUnique({ where: { id: payload.sub }, select: { id: true, active: true, email: true, name: true, role: true } })
    if (!user?.active || user.role !== payload.role) throw new UnauthorizedException('Sessão inválida ou acesso revogado para esta clínica.')
    return { userId: user.id, email: user.email, name: user.name, role: user.role }
  }
}
