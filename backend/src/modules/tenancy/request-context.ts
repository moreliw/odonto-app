import { AsyncLocalStorage } from 'async_hooks'

export type TenantContext = {
  /** Id do Tenant no banco master; usado para ler/atualizar a Subscription. */
  id: string
  subdomain: string
  slug: string
  dbName: string
  connectionString: string
  /** Plano vigente da clínica; usado para aplicar o limite de dentistas. */
  plan?: string | null
  /** Limite concedido pelo master; undefined usa o limite normal do plano e null significa ilimitado. */
  dentistLimit?: number | null
  name?: string
  primaryColor?: string | null
  logoUrl?: string | null
  whatsappNumber?: string | null
}

const storage = new AsyncLocalStorage<TenantContext>()

export const RequestContext = {
  run: (ctx: TenantContext, fn: () => void) => storage.run(ctx, fn),
  get: () => storage.getStore()
}
