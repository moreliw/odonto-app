import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common'

export type FiscalEnvironmentValue = 'SANDBOX' | 'PRODUCTION'

type TokenCache = { accessToken: string; expiresAt: number }

export class NuvemFiscalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message)
  }
}

@Injectable()
export class NuvemFiscalClient {
  private readonly tokens = new Map<FiscalEnvironmentValue, TokenCache>()

  credentialsAvailable(environment: FiscalEnvironmentValue) {
    if (environment !== 'PRODUCTION') return false
    return Boolean(this.credentials(environment).clientId && this.credentials(environment).clientSecret)
  }

  async get<T>(environment: FiscalEnvironmentValue, path: string) {
    return this.request<T>(environment, path, { method: 'GET' })
  }

  async post<T>(environment: FiscalEnvironmentValue, path: string, body?: unknown) {
    return this.request<T>(environment, path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  }

  async put<T>(environment: FiscalEnvironmentValue, path: string, body: unknown) {
    return this.request<T>(environment, path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  }

  async download(environment: FiscalEnvironmentValue, path: string) {
    const response = await this.authorizedFetch(environment, path, { method: 'GET' })
    if (!response.ok) await this.throwProviderError(response)
    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || 'application/octet-stream'
    }
  }

  providerUnavailable(error: unknown): never {
    if (error instanceof NuvemFiscalError) {
      throw new BadGatewayException({
        message: error.message,
        providerStatus: error.status
      })
    }
    if (error instanceof ServiceUnavailableException || error instanceof BadGatewayException) throw error
    throw new BadGatewayException('Não foi possível comunicar com o provedor fiscal. Tente novamente em instantes.')
  }

  private async request<T>(environment: FiscalEnvironmentValue, path: string, init: RequestInit) {
    try {
      const response = await this.authorizedFetch(environment, path, init)
      if (!response.ok) await this.throwProviderError(response)
      if (response.status === 204) return undefined as T
      return (await response.json()) as T
    } catch (error) {
      if (error instanceof NuvemFiscalError || error instanceof ServiceUnavailableException) throw error
      throw new ServiceUnavailableException('O provedor fiscal não respondeu dentro do tempo esperado.')
    }
  }

  private async authorizedFetch(environment: FiscalEnvironmentValue, path: string, init: RequestInit, retry = true): Promise<Response> {
    const token = await this.token(environment)
    const response = await fetch(`${this.baseUrl(environment)}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000)
    })
    if (response.status === 401 && retry) {
      this.tokens.delete(environment)
      return this.authorizedFetch(environment, path, init, false)
    }
    return response
  }

  private async token(environment: FiscalEnvironmentValue) {
    const cached = this.tokens.get(environment)
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken

    const credentials = this.credentials(environment)
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new ServiceUnavailableException('A integração fiscal de produção ainda não foi configurada no servidor.')
    }

    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: 'empresa nfse'
    })
    let response: Response
    try {
      response = await fetch('https://auth.nuvemfiscal.com.br/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: form,
        signal: AbortSignal.timeout(20_000)
      })
    } catch {
      throw new ServiceUnavailableException('Não foi possível autenticar no provedor fiscal.')
    }
    if (!response.ok) await this.throwProviderError(response)
    const result = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!result.access_token) throw new ServiceUnavailableException('O provedor fiscal não retornou um token válido.')
    this.tokens.set(environment, {
      accessToken: result.access_token,
      expiresAt: Date.now() + Math.max(60, Number(result.expires_in || 3600)) * 1000
    })
    return result.access_token
  }

  private credentials(environment: FiscalEnvironmentValue) {
    if (environment !== 'PRODUCTION') return { clientId: '', clientSecret: '' }
    return {
      clientId: process.env.NUVEM_FISCAL_PRODUCTION_CLIENT_ID || '',
      clientSecret: process.env.NUVEM_FISCAL_PRODUCTION_CLIENT_SECRET || ''
    }
  }

  private baseUrl(environment: FiscalEnvironmentValue) {
    if (environment !== 'PRODUCTION') {
      throw new ServiceUnavailableException('O ambiente de testes foi desativado. A emissão fiscal opera somente em produção.')
    }
    return 'https://api.nuvemfiscal.com.br'
  }

  private async throwProviderError(response: Response): Promise<never> {
    const raw = await response.text()
    let details: unknown = raw
    try { details = raw ? JSON.parse(raw) : undefined } catch { /* resposta não JSON */ }
    const message = this.extractMessage(details) || `O provedor fiscal recusou a operação (${response.status}).`
    throw new NuvemFiscalError(message, response.status, details)
  }

  private extractMessage(value: unknown): string | null {
    if (!value || typeof value !== 'object') return typeof value === 'string' && value.trim() ? value.trim() : null
    const object = value as Record<string, unknown>
    for (const key of ['message', 'mensagem', 'detail', 'descricao', 'error_description', 'error']) {
      if (typeof object[key] === 'string' && object[key]) return String(object[key])
    }
    if (Array.isArray(object.mensagens) && object.mensagens.length) {
      return object.mensagens
        .map(item => this.extractMessage(item))
        .filter(Boolean)
        .join(' · ') || null
    }
    return null
  }
}
