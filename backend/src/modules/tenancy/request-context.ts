import { AsyncLocalStorage } from 'async_hooks'

export type TenantContext = {
  subdomain: string
  slug: string
  dbName: string
  connectionString: string
}

const storage = new AsyncLocalStorage<TenantContext>()

export const RequestContext = {
  run: (ctx: TenantContext, fn: () => void) => storage.run(ctx, fn),
  get: () => storage.getStore()
}
