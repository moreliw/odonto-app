import type { TenantContext } from './modules/tenancy/request-context'

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext
    }
  }
}

export {}
