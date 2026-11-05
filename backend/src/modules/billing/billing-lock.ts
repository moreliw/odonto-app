import { ServiceUnavailableException } from '@nestjs/common'
import { Client } from 'pg'

/** Dedicated connections keep provisioning/network waits out of Prisma's pool. */
export async function withBillingLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.MASTER_DATABASE_URL, connectionTimeoutMillis: 10_000 })
  try {
    await client.connect()
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout = '15s'")
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key])
    return await action()
  } catch (error: any) {
    if (error?.code === '55P03') throw new ServiceUnavailableException('Seu cadastro ainda está sendo processado. Aguarde alguns segundos e tente novamente.')
    throw error
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end().catch(() => undefined)
  }
}
