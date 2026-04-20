import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaClient as TenantPrisma } from '@prisma/client-tenant'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import * as argon2 from 'argon2'

function isEmailIdentifier(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService, private readonly prismaTenant: TenantPrismaService) {}

  async validateUser(identifier: string, password: string) {
    const normalized = identifier.trim()
    if (!normalized || !password) throw new UnauthorizedException('Credenciais inválidas')
    const prisma = this.prismaTenant.getClient()
    const user = await prisma.user.findFirst({
      where: isEmailIdentifier(normalized)
        ? { email: { equals: normalized, mode: 'insensitive' } }
        : {
            OR: [
              { username: { equals: normalized, mode: 'insensitive' } },
              { email: { equals: normalized, mode: 'insensitive' } }
            ]
          }
    })
    if (!user) throw new UnauthorizedException('Credenciais inválidas')
    const ok = await argon2.verify(user.passwordHash, password)
    if (!ok) throw new UnauthorizedException('Credenciais inválidas')
    return user
  }

  async login(identifier: string, password: string) {
    const user = await this.validateUser(identifier, password)
    const prisma = this.prismaTenant.getClient()
    return this.issueTokensAndPersistRefresh(prisma, user)
  }

  /** Login público: não usa TenantPrismaService nem RequestContext (evita 500 por escopo ALS/Nest). */
  async loginWithTenantConnection(connectionString: string, identifier: string, password: string) {
    const prisma = new TenantPrisma({ datasources: { db: { url: connectionString } } })
    try {
      const user = await this.validateUserWithPrisma(prisma, identifier, password)
      return await this.issueTokensAndPersistRefresh(prisma, user)
    } finally {
      await prisma.$disconnect()
    }
  }

  private async validateUserWithPrisma(prisma: TenantPrisma, identifier: string, password: string) {
    const normalized = identifier.trim()
    if (!normalized || !password) throw new UnauthorizedException('Credenciais inválidas')
    const user = await prisma.user.findFirst({
      where: isEmailIdentifier(normalized)
        ? { email: { equals: normalized, mode: 'insensitive' } }
        : {
            OR: [
              { username: { equals: normalized, mode: 'insensitive' } },
              { email: { equals: normalized, mode: 'insensitive' } }
            ]
          }
    })
    if (!user) throw new UnauthorizedException('Credenciais inválidas')
    try {
      const ok = await argon2.verify(user.passwordHash, password)
      if (!ok) throw new UnauthorizedException('Credenciais inválidas')
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e
      throw new UnauthorizedException('Credenciais inválidas')
    }
    return user
  }

  private async issueTokensAndPersistRefresh(
    prisma: TenantPrisma,
    user: { id: string; username: string | null; email: string; name: string; role: string }
  ) {
    const payload = { sub: user.id, email: user.email, role: user.role }
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' })
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh'
    const refreshToken = await this.jwt.signAsync(payload, { secret: refreshSecret, expiresIn: '30d' })
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } })
    return { accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role } }
  }

  async refresh(token: string) {
    const prisma = this.prismaTenant.getClient()
    const saved = await prisma.refreshToken.findUnique({ where: { token } })
    if (!saved || saved.expiresAt.getTime() < Date.now()) throw new UnauthorizedException()
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh'
    const decoded = await this.jwt.verifyAsync(token, { secret: refreshSecret })
    const payload = { sub: decoded.sub, email: decoded.email, role: decoded.role }
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' })
    return { accessToken }
  }
}
