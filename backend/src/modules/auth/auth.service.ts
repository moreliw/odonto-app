import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Prisma } from '@prisma/client-tenant'
import { PrismaClient as TenantPrisma } from '@prisma/client-tenant'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import * as argon2 from 'argon2'

function isEmailIdentifier(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name)

  constructor(private readonly jwt: JwtService, private readonly prismaTenant: TenantPrismaService) {}

  async validateUser(identifier: string, password: string) {
    const normalized = identifier.trim()
    if (!normalized || !password) throw new UnauthorizedException('Credenciais inválidas')
    const prisma = this.prismaTenant.getClient()
    const user = await prisma.user.findFirst({
      where: isEmailIdentifier(normalized)
        ? { email: { equals: normalized, mode: 'insensitive' }, active: true }
        : {
            active: true,
            OR: [
              { username: { equals: normalized, mode: 'insensitive' } },
              { email: { equals: normalized, mode: 'insensitive' } }
            ]
          }
    })
    // Dentista cadastrado só como referência (sem e-mail/senha) nunca deve ser encontrado aqui,
    // mas o try/catch cobre qualquer hash ausente com uma falha de login normal, não um 500.
    if (!user || !user.passwordHash || !user.email) throw new UnauthorizedException('Credenciais inválidas')
    try {
      const ok = await argon2.verify(user.passwordHash, password)
      if (!ok) throw new UnauthorizedException('Credenciais inválidas')
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e
      throw new UnauthorizedException('Credenciais inválidas')
    }
    return user
  }

  async login(identifier: string, password: string) {
    const user = await this.validateUser(identifier, password)
    const prisma = this.prismaTenant.getClient()
    // validateUser já garante user.email (dentista sem login nunca chega aqui) — o narrowing de
    // propriedade não "sobe" para o tipo do objeto inteiro, por isso a asserção explícita.
    return this.issueTokensAndPersistRefresh(prisma, { ...user, email: user.email as string })
  }

  /** Login público: não usa TenantPrismaService nem RequestContext (evita 500 por escopo ALS/Nest). */
  async loginWithTenantConnection(connectionString: string, identifier: string, password: string) {
    const prisma = new TenantPrisma({ datasources: { db: { url: connectionString } } })
    try {
      const user = await this.validateUserWithPrisma(prisma, identifier, password)
      return await this.issueTokensAndPersistRefresh(prisma, { ...user, email: user.email as string })
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e
      if (e instanceof Prisma.PrismaClientKnownRequestError || e instanceof Prisma.PrismaClientInitializationError) {
        this.log.warn(`Login tenant DB: ${e.message}`)
        throw new ServiceUnavailableException('Base da clínica indisponível. Verifique o deploy e as credenciais do tenant.')
      }
      this.log.error(e)
      throw e
    } finally {
      await prisma.$disconnect().catch(() => undefined)
    }
  }

  private async findUserWithPrisma(prisma: TenantPrisma, identifier: string) {
    const normalized = identifier.trim()
    if (!normalized) return null
    const useSqlite = process.env.DEV_SQLITE === 'true'
    type UserRow = {
      id: string
      username: string | null
      email: string | null
      name: string
      passwordHash: string | null
      role: string
      active: boolean
    }
    if (useSqlite) {
      const u = await prisma.user.findFirst({
        where: isEmailIdentifier(normalized)
          ? { email: { equals: normalized, mode: 'insensitive' } }
          : {
              OR: [
                { username: { equals: normalized, mode: 'insensitive' } },
                { email: { equals: normalized, mode: 'insensitive' } }
              ]
            }
      })
      return u
        ? {
            id: u.id,
            username: u.username,
            email: u.email,
            name: u.name,
            passwordHash: u.passwordHash,
            role: typeof u.role === 'string' ? u.role : String(u.role),
            active: u.active
          }
        : null
    }
    if (isEmailIdentifier(normalized)) {
      const rows = await prisma.$queryRaw<UserRow[]>(
        Prisma.sql`SELECT id, username, email, name, "passwordHash", role::text AS role, active FROM "User" WHERE LOWER(email) = LOWER(${normalized}) LIMIT 1`
      )
      return rows[0] ?? null
    }
    const rows = await prisma.$queryRaw<UserRow[]>(
      Prisma.sql`SELECT id, username, email, name, "passwordHash", role::text AS role, active FROM "User" WHERE LOWER(COALESCE(username,'')) = LOWER(${normalized}) OR LOWER(COALESCE(email,'')) = LOWER(${normalized}) LIMIT 1`
    )
    return rows[0] ?? null
  }

  private async validateUserWithPrisma(prisma: TenantPrisma, identifier: string, password: string) {
    if (!identifier.trim() || !password) throw new UnauthorizedException('Credenciais inválidas')
    const user = await this.findUserWithPrisma(prisma, identifier)
    if (!user || !user.active || !user.passwordHash || !user.email) throw new UnauthorizedException('Credenciais inválidas')
    try {
      const ok = await argon2.verify(user.passwordHash, password)
      if (!ok) throw new UnauthorizedException('Credenciais inválidas')
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e
      throw new UnauthorizedException('Credenciais inválidas')
    }
    return user
  }

  /**
   * Emite tokens sem checar senha. Só deve ser chamado logo após o próprio
   * backend criar a conta (fluxo de ativação de assinatura) — nunca a partir
   * de um identificador vindo do usuário, já que não há verificação de posse
   * da conta aqui.
   */
  async issueTokensForNewAccount(connectionString: string, email: string) {
    const prisma = new TenantPrisma({ datasources: { db: { url: connectionString } } })
    try {
      const user = await this.findUserWithPrisma(prisma, email)
      if (!user || !user.active || !user.email) throw new UnauthorizedException('Conta não encontrada após provisionamento')
      return await this.issueTokensAndPersistRefresh(prisma, { ...user, email: user.email as string })
    } finally {
      await prisma.$disconnect().catch(() => undefined)
    }
  }

  /** Sessão assistida emitida exclusivamente por uma rota protegida pelo MasterAdminGuard. */
  async issueMasterSupportSession(connectionString: string, userId?: string) {
    const prisma = new TenantPrisma({ datasources: { db: { url: connectionString } } })
    try {
      const user = userId
        ? await prisma.user.findFirst({ where: { id: userId, active: true } })
        : await prisma.user.findFirst({ where: { role: 'ADMIN', active: true }, orderBy: { createdAt: 'asc' } })
      if (!user) throw new UnauthorizedException('Nenhum administrador ativo encontrado nesta clínica.')
      const payload = { sub: user.id, email: user.email, role: String(user.role), support: true }
      const accessToken = await this.jwt.signAsync(payload, { expiresIn: '20m' })
      return {
        accessToken,
        refreshToken: '',
        user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role }
      }
    } finally {
      await prisma.$disconnect().catch(() => undefined)
    }
  }

  private async issueTokensAndPersistRefresh(
    prisma: TenantPrisma,
    user: { id: string; username: string | null; email: string; name: string; role: string }
  ) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: typeof user.role === 'string' ? user.role : String(user.role)
    }
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' })
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh'
    const refreshToken = await this.jwt.signAsync(payload, { secret: refreshSecret, expiresIn: '30d' })
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } })
    return { accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role } }
  }

  async refresh(token: string) {
    const prisma = this.prismaTenant.getClient()
    const saved = await prisma.refreshToken.findUnique({ where: { token }, include: { user: true } })
    if (!saved || !saved.user.active || saved.expiresAt.getTime() < Date.now()) throw new UnauthorizedException()
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh'
    const decoded = await this.jwt.verifyAsync(token, { secret: refreshSecret })
    const payload = { sub: decoded.sub, email: decoded.email, role: decoded.role }
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' })
    return { accessToken }
  }
}
