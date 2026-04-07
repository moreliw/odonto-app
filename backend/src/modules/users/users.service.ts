import { Injectable, ForbiddenException } from '@nestjs/common'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import * as argon2 from 'argon2'

function usernameFromEmail(email: string) {
  const raw = email.split('@')[0] || 'user'
  return raw.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
}

@Injectable()
export class UsersService {
  constructor(private readonly prismaTenant: TenantPrismaService) {}
  async create(adminUser: { role: string }, data: { username?: string; email: string; name: string; password: string; role: 'ADMIN' | 'USER' }) {
    if (adminUser.role !== 'ADMIN') throw new ForbiddenException()
    const hash = await argon2.hash(data.password)
    const generatedUsername = usernameFromEmail(data.email)
    const username = (data.username || generatedUsername).slice(0, 32)
    return this.prismaTenant.getClient().user.create({ data: { username, email: data.email, name: data.name, passwordHash: hash, role: data.role } })
  }
  async list() {
    return this.prismaTenant.getClient().user.findMany({ orderBy: { createdAt: 'desc' } })
  }
}
