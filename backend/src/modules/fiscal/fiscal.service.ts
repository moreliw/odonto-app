import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { TenantPrismaService } from '../tenancy/tenant-prisma.service'
import { FiscalEnvironmentValue, NuvemFiscalClient, NuvemFiscalError } from './nuvem-fiscal.client'

export type FiscalRequester = { userId: string; email?: string; name?: string; role: string }

export type FiscalSettingsInput = {
  enabled: boolean
  environment: 'PRODUCTION'
  providerMode: 'NATIONAL' | 'MUNICIPAL'
  taxId: string
  municipalRegistration?: string
  stateRegistration?: string
  legalName: string
  tradeName?: string
  email: string
  phone?: string
  postalCode: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  cityCode: string
  simpleNationalOption: number
  simpleNationalTaxRegime: number
  specialTaxRegime: number
  fiscalIncentive: boolean
  rpsSeries: string
  rpsBatch: number
  rpsNumber: number
  defaultNationalTaxCode: string
  defaultMunicipalTaxCode?: string
  defaultCnae?: string
  defaultNbs?: string
  defaultIssRate?: number
  defaultIssWithheld: boolean
}

export type IssueFiscalInvoiceInput = {
  invoiceId: string
  serviceDate: string
  serviceDescription: string
  nationalTaxCode?: string
  municipalTaxCode?: string
  cnae?: string
  nbs?: string
  issRate?: number
  issWithheld?: boolean
  customerDocument?: string
  customerEmail?: string
  customerPhone?: string
  customerPostalCode?: string
  customerStreet?: string
  customerNumber?: string
  customerComplement?: string
  customerNeighborhood?: string
  customerCity?: string
  customerState?: string
  customerCityCode?: string
}

type ProviderNote = Record<string, any>

@Injectable()
export class FiscalService {
  constructor(
    private readonly prismaTenant: TenantPrismaService,
    private readonly nuvem: NuvemFiscalClient
  ) {}

  private get prisma(): any { return this.prismaTenant.getClient() }

  async getSettings() {
    const settings = await this.prisma.fiscalSettings.findUnique({ where: { id: 'default' } })
    return {
      settings: settings ? this.serializeSettings(settings) : null,
      readiness: this.readiness(settings)
    }
  }

  async saveSettings(requester: FiscalRequester, input: FiscalSettingsInput) {
    this.validateSettings(input)
    const data = {
      ...input,
      environment: 'PRODUCTION' as const,
      taxId: fiscalDocument(input.taxId),
      postalCode: digits(input.postalCode),
      phone: digits(input.phone),
      cityCode: digits(input.cityCode),
      state: input.state.trim().toUpperCase(),
      defaultNationalTaxCode: compactCode(input.defaultNationalTaxCode),
      defaultMunicipalTaxCode: optionalCode(input.defaultMunicipalTaxCode),
      defaultCnae: optionalCode(input.defaultCnae),
      defaultNbs: optionalCode(input.defaultNbs),
      simpleNationalTaxRegime: input.simpleNationalOption === 3 ? input.simpleNationalTaxRegime : 0,
      updatedByName: actor(requester)
    }
    const settings = await this.prisma.fiscalSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data
    })
    return { settings: this.serializeSettings(settings), readiness: this.readiness(settings) }
  }

  async providerStatus() {
    const settings = await this.requireSettings(false)
    const environment: FiscalEnvironmentValue = 'PRODUCTION'
    const status: Record<string, unknown> = { readiness: this.readiness(settings), company: null, certificate: null, nfse: null, city: null }
    if (!this.nuvem.credentialsAvailable(environment)) return status
    const taxId = fiscalDocument(settings.taxId)
    const results = await Promise.allSettled([
      this.nuvem.get(environment, `/empresas/${taxId}`),
      this.nuvem.get(environment, `/empresas/${taxId}/certificado`),
      this.nuvem.get(environment, `/empresas/${taxId}/nfse`),
      this.nuvem.get(environment, `/nfse/cidades/${digits(settings.cityCode)}`)
    ])
    ;['company', 'certificate', 'nfse', 'city'].forEach((key, index) => {
      const result = results[index]
      if (result.status !== 'fulfilled') {
        status[key] = null
        return
      }
      if (key === 'company') status[key] = safeCompany(result.value as ProviderNote)
      else if (key === 'certificate') status[key] = safeCertificate(result.value as ProviderNote)
      else if (key === 'nfse') status[key] = safeNfseConfiguration(result.value as ProviderNote)
      else status[key] = result.value
    })
    return status
  }

  async syncProvider(requester: FiscalRequester, municipalCredentials?: { login?: string; password?: string; token?: string }) {
    const settings = await this.requireSettings(false)
    const environment: FiscalEnvironmentValue = 'PRODUCTION'
    this.ensureProviderCredentials(environment)
    const taxId = fiscalDocument(settings.taxId)
    const company = {
      cpf_cnpj: taxId,
      inscricao_estadual: settings.stateRegistration || undefined,
      inscricao_municipal: settings.municipalRegistration || undefined,
      nome_razao_social: settings.legalName,
      nome_fantasia: settings.tradeName || undefined,
      fone: digits(settings.phone) || undefined,
      email: settings.email,
      endereco: {
        logradouro: settings.street,
        numero: settings.number,
        complemento: settings.complement || undefined,
        bairro: settings.neighborhood,
        codigo_municipio: digits(settings.cityCode),
        cidade: settings.city,
        uf: settings.state,
        codigo_pais: '1058',
        pais: 'Brasil',
        cep: digits(settings.postalCode)
      }
    }

    try {
      let exists = true
      try { await this.nuvem.get(environment, `/empresas/${taxId}`) }
      catch (error) {
        if (error instanceof NuvemFiscalError && error.status === 404) exists = false
        else throw error
      }
      if (exists) await this.nuvem.put(environment, `/empresas/${taxId}`, company)
      else await this.nuvem.post(environment, '/empresas', company)

      const prefeitura = municipalCredentials && (municipalCredentials.login || municipalCredentials.password || municipalCredentials.token)
        ? {
            login: municipalCredentials.login || undefined,
            senha: municipalCredentials.password || undefined,
            token: municipalCredentials.token || undefined
          }
        : undefined
      await this.nuvem.put(environment, `/empresas/${taxId}/nfse`, {
        regTrib: {
          opSimpNac: settings.simpleNationalOption,
          ...(settings.simpleNationalTaxRegime ? { regApTribSN: settings.simpleNationalTaxRegime } : {}),
          regEspTrib: settings.specialTaxRegime
        },
        rps: { lote: settings.rpsBatch, serie: settings.rpsSeries, numero: settings.rpsNumber },
        ...(prefeitura ? { prefeitura } : {}),
        incentivo_fiscal: settings.fiscalIncentive,
        ambiente: providerEnvironment(environment)
      })
      const updated = await this.prisma.fiscalSettings.update({
        where: { id: 'default' },
        data: { providerCompanySyncedAt: new Date(), providerCompanyEnvironment: environment, providerCompanyTaxId: taxId, updatedByName: actor(requester) }
      })
      return { settings: this.serializeSettings(updated), readiness: this.readiness(updated) }
    } catch (error) {
      this.nuvem.providerUnavailable(error)
    }
  }

  async uploadCertificate(requester: FiscalRequester, file: Express.Multer.File, password: string) {
    const settings = await this.requireSettings(false)
    if (!file?.buffer?.length) throw new BadRequestException('Selecione um certificado A1 (.pfx ou .p12).')
    if (!password?.trim()) throw new BadRequestException('Informe a senha do certificado.')
    if (!/\.(pfx|p12)$/i.test(file.originalname || '')) throw new BadRequestException('O certificado deve estar no formato .pfx ou .p12.')
    const environment: FiscalEnvironmentValue = 'PRODUCTION'
    this.ensureProviderCredentials(environment)
    try {
      const certificate = await this.nuvem.put<Record<string, any>>(
        environment,
        `/empresas/${fiscalDocument(settings.taxId)}/certificado`,
        { certificado: file.buffer.toString('base64'), password }
      )
      const updated = await this.prisma.fiscalSettings.update({
        where: { id: 'default' },
        data: {
          certificateExpiresAt: certificate?.not_valid_after ? new Date(certificate.not_valid_after) : null,
          certificateEnvironment: environment,
          certificateTaxId: fiscalDocument(settings.taxId),
          certificateSubject: certificate?.subject_name || certificate?.nome_razao_social || null,
          updatedByName: actor(requester)
        }
      })
      return { certificate: safeCertificate(certificate), settings: this.serializeSettings(updated), readiness: this.readiness(updated) }
    } catch (error) {
      this.nuvem.providerUnavailable(error)
    }
  }

  async list(filters: { search?: string; status?: string; from?: string; to?: string }) {
    const where: any = {}
    const allowedStatuses = new Set(['PROCESSING', 'AUTHORIZED', 'REJECTED', 'ERROR', 'CANCEL_PENDING', 'CANCELLED'])
    if (filters.status && filters.status !== 'ALL') {
      if (!allowedStatuses.has(filters.status)) throw new BadRequestException('Status fiscal inválido.')
      where.status = filters.status
    }
    if (filters.search?.trim()) {
      const search = filters.search.trim()
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerDocument: { contains: fiscalDocument(search) || search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
        { serviceDescription: { contains: search, mode: 'insensitive' } }
      ]
    }
    if (filters.from || filters.to) {
      where.createdAt = {}
      if (filters.from) where.createdAt.gte = startOfDay(filters.from)
      if (filters.to) where.createdAt.lte = endOfDay(filters.to)
    }
    const notes = await this.prisma.fiscalInvoice.findMany({
      where,
      include: {
        invoice: { select: { id: true, description: true, appointmentId: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 8 }
      },
      orderBy: { createdAt: 'desc' },
      take: 300
    })
    return notes.map((note: any) => this.serializeNote(note))
  }

  async eligibleInvoices() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { not: 'CANCELLED' } },
      include: {
        patient: true,
        appointment: { select: { id: true, startTime: true, endTime: true } },
        items: { orderBy: { createdAt: 'asc' } },
        fiscalInvoices: { select: { id: true, status: true, number: true }, orderBy: { createdAt: 'desc' } }
      },
      orderBy: { issuedAt: 'desc' },
      take: 300
    })
    return invoices.map((invoice: any) => {
      const amount = roundMoney(Number(invoice.amount) - Number(invoice.discount || 0))
      const activeFiscalInvoice = invoice.fiscalInvoices.find((item: any) => !['REJECTED', 'CANCELLED'].includes(item.status)) || null
      return {
        id: invoice.id,
        description: invoice.description,
        issuedAt: invoice.issuedAt,
        appointment: invoice.appointment,
        amount,
        patient: patientSnapshot(invoice.patient, {}),
        suggestedServiceDescription: invoice.items.length
          ? invoice.items.map((item: any) => `${item.description} (${item.quantity}x)`).join('; ')
          : invoice.description,
        activeFiscalInvoice
      }
    }).filter((invoice: any) => invoice.amount > 0)
  }

  async issue(requester: FiscalRequester, input: IssueFiscalInvoiceInput) {
    const settings = await this.requireSettings(true)
    const environment: FiscalEnvironmentValue = 'PRODUCTION'
    this.ensureProviderCredentials(environment)
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { patient: true, items: { orderBy: { createdAt: 'asc' } } }
    })
    if (!invoice) throw new NotFoundException('Cobrança não encontrada.')
    if (invoice.status === 'CANCELLED') throw new BadRequestException('Não é possível emitir NFS-e para uma cobrança cancelada.')

    const patient = patientSnapshot(invoice.patient, input)
    this.validateCustomer(patient)
    const amount = roundMoney(Number(invoice.amount) - Number(invoice.discount || 0))
    if (amount <= 0) throw new BadRequestException('O valor líquido da cobrança deve ser maior que zero.')
    const serviceDate = parseServiceDate(input.serviceDate)
    const description = cleanText(input.serviceDescription, 2000)
    if (description.length < 3) throw new BadRequestException('Descreva o serviço prestado.')
    const nationalTaxCode = compactCode(input.nationalTaxCode || settings.defaultNationalTaxCode)
    if (!nationalTaxCode) throw new BadRequestException('Informe o código de tributação nacional do serviço.')
    const municipalTaxCode = optionalCode(input.municipalTaxCode || settings.defaultMunicipalTaxCode)
    const cnae = optionalCode(input.cnae || settings.defaultCnae)
    const nbs = optionalCode(input.nbs || settings.defaultNbs)
    const issRate = input.issRate ?? (settings.defaultIssRate == null ? undefined : Number(settings.defaultIssRate))
    if (issRate !== undefined && (issRate < 0 || issRate > 100)) throw new BadRequestException('A alíquota do ISS deve estar entre 0 e 100%.')
    const issWithheld = input.issWithheld ?? Boolean(settings.defaultIssWithheld)
    const reference = `odonto-${crypto.randomUUID()}`
    const payload = this.buildPayload(settings, reference, {
      serviceDate,
      description,
      amount,
      nationalTaxCode,
      municipalTaxCode,
      cnae,
      nbs,
      issRate,
      issWithheld,
      patient
    })
    const local = await this.prisma.$transaction(async (transaction: any) => {
      // Evita duas emissões simultâneas para a mesma cobrança sem impedir uma
      // nova nota depois de rejeição ou cancelamento fiscal.
      await transaction.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', invoice.id)
      const previous = await transaction.fiscalInvoice.findFirst({
        where: { invoiceId: invoice.id, status: { notIn: ['REJECTED', 'CANCELLED'] } },
        orderBy: { createdAt: 'desc' }
      })
      if (previous) {
        throw new ConflictException({ message: 'Esta cobrança já possui uma emissão fiscal em andamento ou autorizada.', fiscalInvoiceId: previous.id })
      }
      return transaction.fiscalInvoice.create({
        data: {
          invoiceId: invoice.id,
          patientId: invoice.patientId,
          reference,
          environment,
          status: 'PROCESSING',
          serviceDate,
          serviceDescription: description,
          amount,
          nationalTaxCode,
          municipalTaxCode,
          cnae,
          nbs,
          issRate,
          issWithheld,
          customerName: patient.name,
          customerDocument: patient.document,
          customerEmail: patient.email || null,
          customerSnapshot: patient,
          requestPayload: payload,
          createdByName: actor(requester),
          updatedByName: actor(requester),
          events: { create: { action: 'ISSUE_REQUESTED', status: 'PROCESSING', createdByName: actor(requester) } }
        }
      })
    })

    try {
      const response = await this.nuvem.post<ProviderNote>(environment, '/nfse/dps', payload)
      return await this.applyProviderResponse(local.id, response, requester, 'ISSUE_ACCEPTED')
    } catch (error) {
      const rejected = error instanceof NuvemFiscalError && error.status >= 400 && error.status < 500 && error.status !== 429
      const details = error instanceof NuvemFiscalError ? error.details : { message: error instanceof Error ? error.message : 'Falha desconhecida' }
      const message = providerMessage(details) || (error instanceof Error ? error.message : 'Falha ao emitir a NFS-e.')
      await this.prisma.fiscalInvoice.update({
        where: { id: local.id },
        data: {
          status: rejected ? 'REJECTED' : 'ERROR',
          lastMessage: message,
          providerResponse: jsonValue(details),
          events: { create: { action: 'ISSUE_FAILED', status: rejected ? 'REJECTED' : 'ERROR', message, providerResponse: jsonValue(details), createdByName: actor(requester) } }
        }
      })
      this.nuvem.providerUnavailable(error)
    }
  }

  async sync(requester: FiscalRequester, id: string) {
    const note = await this.findNote(id)
    const environment = note.environment as FiscalEnvironmentValue
    this.ensureProviderCredentials(environment)
    try {
      let response: ProviderNote | null = null
      if (note.providerId) {
        response = await this.nuvem.get<ProviderNote>(environment, `/nfse/${note.providerId}`)
      } else {
        const settings = await this.requireSettings(false)
        const query = new URLSearchParams({
          cpf_cnpj: fiscalDocument(settings.taxId),
          ambiente: providerEnvironment(environment),
          referencia: note.reference,
          '$top': '1'
        })
        const result = await this.nuvem.get<{ data?: ProviderNote[] }>(environment, `/nfse?${query}`)
        response = result.data?.[0] || null
      }
      if (!response) throw new NotFoundException('A emissão ainda não foi localizada no provedor fiscal.')
      return await this.applyProviderResponse(note.id, response, requester, 'SYNCED')
    } catch (error) {
      if (error instanceof NotFoundException) throw error
      this.nuvem.providerUnavailable(error)
    }
  }

  async cancel(requester: FiscalRequester, id: string, code: string, reason: string) {
    const note = await this.findNote(id)
    if (!note.providerId) throw new BadRequestException('A NFS-e ainda não possui um identificador no provedor.')
    if (note.status === 'CANCELLED') return this.serializeNote(note)
    if (note.status !== 'AUTHORIZED') throw new BadRequestException('Somente uma NFS-e autorizada pode ser cancelada.')
    const cleanReason = cleanText(reason, 255)
    if (cleanReason.length < 15) throw new BadRequestException('O motivo do cancelamento deve ter pelo menos 15 caracteres.')
    try {
      const response = await this.nuvem.post<ProviderNote>(
        note.environment as FiscalEnvironmentValue,
        `/nfse/${note.providerId}/cancelamento`,
        { codigo: code || '1', motivo: cleanReason }
      )
      const providerStatusValue = String(response?.status || '').toLowerCase()
      const cancelled = ['cancelado', 'cancelada', 'concluido', 'concluida'].includes(providerStatusValue)
      const message = providerMessage(response) || (cancelled ? 'NFS-e cancelada.' : 'Cancelamento enviado ao provedor.')
      const updated = await this.prisma.fiscalInvoice.update({
        where: { id: note.id },
        data: {
          status: cancelled ? 'CANCELLED' : 'CANCEL_PENDING',
          cancelledAt: cancelled ? new Date() : null,
          lastMessage: message,
          updatedByName: actor(requester),
          events: { create: { action: 'CANCEL_REQUESTED', status: cancelled ? 'CANCELLED' : 'CANCEL_PENDING', message, providerResponse: jsonValue(response), createdByName: actor(requester) } }
        },
        include: { invoice: { select: { id: true, description: true, appointmentId: true } }, events: { orderBy: { createdAt: 'desc' }, take: 8 } }
      })
      return this.serializeNote(updated)
    } catch (error) {
      this.nuvem.providerUnavailable(error)
    }
  }

  async download(id: string, kind: 'pdf' | 'xml') {
    const note = await this.findNote(id)
    if (!note.providerId) throw new BadRequestException('Documento ainda indisponível no provedor fiscal.')
    if (!['AUTHORIZED', 'CANCEL_PENDING', 'CANCELLED'].includes(note.status)) {
      throw new BadRequestException('O documento estará disponível após a autorização da NFS-e.')
    }
    try {
      const file = await this.nuvem.download(note.environment as FiscalEnvironmentValue, `/nfse/${note.providerId}/${kind}`)
      return { ...file, filename: `nfse-${note.number || note.id}.${kind}` }
    } catch (error) {
      this.nuvem.providerUnavailable(error)
    }
  }

  private async applyProviderResponse(id: string, response: ProviderNote, requester: FiscalRequester, action: string) {
    const status = mapProviderStatus(response)
    const message = providerMessage(response)
    const updated = await this.prisma.fiscalInvoice.update({
      where: { id },
      data: {
        providerId: response.id || undefined,
        status,
        number: response.numero || undefined,
        verificationCode: response.codigo_verificacao || undefined,
        accessKey: response.chave || response.chave_acesso || undefined,
        publicUrl: response.link_url || undefined,
        issuedAt: response.data_emissao ? new Date(response.data_emissao) : status === 'AUTHORIZED' ? new Date() : undefined,
        cancelledAt: status === 'CANCELLED' ? new Date(response.cancelamento?.data_hora || Date.now()) : undefined,
        lastMessage: message,
        providerResponse: jsonValue(response),
        updatedByName: actor(requester),
        events: { create: { action, status, message, providerResponse: jsonValue(response), createdByName: actor(requester) } }
      },
      include: { invoice: { select: { id: true, description: true, appointmentId: true } }, events: { orderBy: { createdAt: 'desc' }, take: 8 } }
    })
    return this.serializeNote(updated)
  }

  private buildPayload(settings: any, reference: string, data: any) {
    const prestDocument = fiscalDocument(settings.taxId)
    const customerDocument = fiscalDocument(data.patient.document)
    const customerAddress = data.patient.street && data.patient.cityCode && data.patient.postalCode
      ? {
          end: {
            endNac: { cMun: data.patient.cityCode, CEP: data.patient.postalCode },
            xLgr: data.patient.street,
            nro: data.patient.number || 'S/N',
            ...(data.patient.complement ? { xCpl: data.patient.complement } : {}),
            ...(data.patient.neighborhood ? { xBairro: data.patient.neighborhood } : {})
          }
        }
      : {}
    const cServ: Record<string, unknown> = { cTribNac: data.nationalTaxCode, xDescServ: data.description }
    if (data.municipalTaxCode) cServ.cTribMun = data.municipalTaxCode
    if (data.cnae) cServ.CNAE = data.cnae
    if (data.nbs) cServ.cNBS = data.nbs
    const tribMun: Record<string, unknown> = {
      tribISSQN: 1,
      tpRetISSQN: data.issWithheld ? 1 : 2
    }
    if (data.issRate !== undefined && data.issRate !== null) tribMun.pAliq = Number(data.issRate)
    return {
      provedor: settings.providerMode === 'MUNICIPAL' ? 'padrao' : 'nacional',
      ambiente: 'producao',
      referencia: reference,
      infDPS: {
        tpAmb: 1,
        dhEmi: new Date().toISOString(),
        verAplic: 'OdontoApp_1.0',
        dCompet: dateOnly(data.serviceDate),
        tpEmit: 1,
        cLocEmi: digits(settings.cityCode),
        prest: {
          ...(prestDocument.length === 14 ? { CNPJ: prestDocument } : { CPF: prestDocument }),
          ...(settings.municipalRegistration ? { IM: settings.municipalRegistration } : {}),
          regTrib: {
            opSimpNac: settings.simpleNationalOption,
            ...(settings.simpleNationalTaxRegime ? { regApTribSN: settings.simpleNationalTaxRegime } : {}),
            regEspTrib: settings.specialTaxRegime
          }
        },
        toma: {
          ...(customerDocument.length === 14 ? { CNPJ: customerDocument } : { CPF: customerDocument }),
          xNome: data.patient.name,
          ...customerAddress,
          ...(data.patient.phone ? { fone: data.patient.phone } : {}),
          ...(data.patient.email ? { email: data.patient.email } : {})
        },
        serv: {
          locPrest: { cLocPrestacao: digits(settings.cityCode) },
          cServ
        },
        valores: {
          vServPrest: { vServ: data.amount },
          trib: { tribMun, totTrib: { indTotTrib: 0 } }
        }
      }
    }
  }

  private async findNote(id: string) {
    const note = await this.prisma.fiscalInvoice.findUnique({
      where: { id },
      include: { invoice: { select: { id: true, description: true, appointmentId: true } }, events: { orderBy: { createdAt: 'desc' }, take: 8 } }
    })
    if (!note) throw new NotFoundException('NFS-e não encontrada.')
    return note
  }

  private async requireSettings(requireEnabled: boolean) {
    const settings = await this.prisma.fiscalSettings.findUnique({ where: { id: 'default' } })
    if (!settings) throw new BadRequestException('Configure os dados fiscais da clínica antes de emitir uma NFS-e.')
    this.validateSettings(settings)
    if (requireEnabled && !settings.enabled) throw new BadRequestException('A emissão fiscal está desativada nas configurações da clínica.')
    return settings
  }

  private validateSettings(input: Partial<FiscalSettingsInput>) {
    const missing = [
      ['CNPJ/CPF', input.taxId], ['razão social', input.legalName], ['e-mail', input.email],
      ['CEP', input.postalCode], ['logradouro', input.street], ['número', input.number],
      ['bairro', input.neighborhood], ['cidade', input.city], ['UF', input.state],
      ['código IBGE do município', input.cityCode], ['código tributário nacional', input.defaultNationalTaxCode]
    ].filter(([, value]) => !String(value || '').trim()).map(([label]) => label)
    if (missing.length) throw new BadRequestException(`Preencha os dados fiscais obrigatórios: ${missing.join(', ')}.`)
    if (!validCpfCnpj(String(input.taxId))) throw new BadRequestException('Informe um CPF ou CNPJ fiscal válido.')
    if (!/^\d{7}$/.test(digits(input.cityCode))) throw new BadRequestException('O código IBGE do município deve ter 7 dígitos.')
    if (!/^[A-Z]{2}$/.test(String(input.state || '').trim().toUpperCase())) throw new BadRequestException('Informe uma UF válida com 2 letras.')
    if (!/^\d{8}$/.test(digits(input.postalCode))) throw new BadRequestException('Informe um CEP válido com 8 dígitos.')
    if (!compactCode(input.defaultNationalTaxCode)) throw new BadRequestException('Informe o código tributário nacional do serviço.')
    if (Number(input.simpleNationalOption) === 3 && ![1, 2, 3].includes(Number(input.simpleNationalTaxRegime))) {
      throw new BadRequestException('Selecione o regime de apuração da clínica no Simples Nacional.')
    }
    if (Number(input.simpleNationalOption) === 3 && Number(input.simpleNationalTaxRegime) === 1 && Number(input.specialTaxRegime) !== 0) {
      throw new BadRequestException('No regime normal do Simples Nacional, o regime especial deve ser Nenhum.')
    }
    if (Number(input.specialTaxRegime) < 0 || Number(input.specialTaxRegime) > 6) {
      throw new BadRequestException('Selecione um regime especial de tributação válido.')
    }
    if (input.defaultIssRate != null && (Number(input.defaultIssRate) < 0 || Number(input.defaultIssRate) > 100)) {
      throw new BadRequestException('A alíquota padrão do ISS deve estar entre 0 e 100%.')
    }
  }

  private validateCustomer(patient: ReturnType<typeof patientSnapshot>) {
    if (!patient.name?.trim()) throw new BadRequestException('O paciente precisa ter nome para a emissão fiscal.')
    if (!validCpfCnpj(patient.document)) throw new BadRequestException('Cadastre um CPF ou CNPJ válido para o paciente.')
    if (patient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email)) throw new BadRequestException('O e-mail do paciente é inválido.')
    if (patient.cityCode && !/^\d{7}$/.test(patient.cityCode)) throw new BadRequestException('O código IBGE do município do paciente deve ter 7 dígitos.')
  }

  private ensureProviderCredentials(environment: FiscalEnvironmentValue) {
    if (!this.nuvem.credentialsAvailable(environment)) {
      throw new BadRequestException('As credenciais fiscais de produção ainda não foram configuradas no servidor.')
    }
  }

  private readiness(settings: any) {
    const environment: FiscalEnvironmentValue = 'PRODUCTION'
    const currentTaxId = fiscalDocument(settings?.taxId)
    const companySynced = Boolean(settings?.providerCompanySyncedAt && settings?.providerCompanyEnvironment === environment && settings?.providerCompanyTaxId === currentTaxId)
    const certificateConfigured = Boolean(settings?.certificateExpiresAt && settings?.certificateEnvironment === environment && settings?.certificateTaxId === currentTaxId)
    const certificateValid = Boolean(certificateConfigured && new Date(settings.certificateExpiresAt) > new Date())
    return {
      provider: 'NUVEM_FISCAL',
      credentialsConfigured: this.nuvem.credentialsAvailable(environment),
      settingsConfigured: Boolean(settings),
      enabled: Boolean(settings?.enabled),
      companySynced,
      certificateConfigured,
      certificateValid,
      readyToIssue: Boolean(settings?.enabled && companySynced && certificateValid && this.nuvem.credentialsAvailable(environment))
    }
  }

  private serializeSettings(settings: any) {
    return { ...settings, defaultIssRate: settings.defaultIssRate == null ? null : Number(settings.defaultIssRate) }
  }

  private serializeNote(note: any) {
    return {
      ...note,
      amount: Number(note.amount),
      issRate: note.issRate == null ? null : Number(note.issRate),
      requestPayload: undefined,
      providerResponse: undefined,
      customerSnapshot: undefined,
      events: (note.events || []).map((event: any) => ({ ...event, providerResponse: undefined }))
    }
  }
}

function actor(requester: FiscalRequester) { return requester?.name?.trim() || requester?.email?.trim() || 'Sistema' }
function digits(value: unknown) { return String(value || '').replace(/\D/g, '') }
function fiscalDocument(value: unknown) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '') }
function cleanText(value: unknown, max: number) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max) }
function compactCode(value: unknown) { return String(value || '').replace(/[^0-9A-Za-z]/g, '').trim() }
function optionalCode(value: unknown) { const result = compactCode(value); return result || null }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100 }
function providerEnvironment(_value: FiscalEnvironmentValue) { return 'producao' }
function dateOnly(value: string | Date) { const date = value instanceof Date ? value : new Date(value); return date.toISOString().slice(0, 10) }
function parseServiceDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new BadRequestException('Informe uma data de competência válida.')
  const date = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Informe uma data de competência válida.')
  return date
}
function startOfDay(value: string) { const date = new Date(`${value}T00:00:00.000`); if (Number.isNaN(date.getTime())) throw new BadRequestException('Período inválido.'); return date }
function endOfDay(value: string) { const date = new Date(`${value}T23:59:59.999`); if (Number.isNaN(date.getTime())) throw new BadRequestException('Período inválido.'); return date }
function jsonValue(value: unknown): any { return value == null ? undefined : JSON.parse(JSON.stringify(value)) }

function patientSnapshot(patient: any, overrides: Partial<IssueFiscalInvoiceInput>) {
  return {
    name: cleanText(patient?.name, 500),
    document: fiscalDocument(overrides.customerDocument || patient?.document),
    email: cleanText(overrides.customerEmail ?? patient?.email, 320) || null,
    phone: digits(overrides.customerPhone ?? patient?.phone ?? patient?.whatsapp) || null,
    postalCode: digits(overrides.customerPostalCode ?? patient?.postalCode) || null,
    street: cleanText(overrides.customerStreet ?? patient?.address, 255) || null,
    number: cleanText(overrides.customerNumber ?? patient?.addressNumber, 60) || null,
    complement: cleanText(overrides.customerComplement ?? patient?.addressComplement, 120) || null,
    neighborhood: cleanText(overrides.customerNeighborhood ?? patient?.neighborhood, 120) || null,
    city: cleanText(overrides.customerCity ?? patient?.city, 120) || null,
    state: cleanText(overrides.customerState ?? patient?.state, 2).toUpperCase() || null,
    cityCode: digits(overrides.customerCityCode) || null
  }
}

function mapProviderStatus(response: ProviderNote) {
  const cancellation = String(response?.cancelamento?.status || '').toLowerCase()
  if (['cancelada', 'cancelado', 'concluida', 'concluido'].includes(cancellation)) return 'CANCELLED'
  if (['pendente', 'processando', 'cancelando'].includes(cancellation)) return 'CANCEL_PENDING'
  const raw = String(response?.status || '').toLowerCase()
  if (['autorizada', 'autorizado'].includes(raw)) return 'AUTHORIZED'
  if (['cancelada', 'cancelado'].includes(raw)) return 'CANCELLED'
  if (['cancelando', 'cancelamento_pendente'].includes(raw)) return 'CANCEL_PENDING'
  if (['rejeitada', 'rejeitado', 'negada', 'negado'].includes(raw)) return 'REJECTED'
  if (['erro', 'falha'].includes(raw)) return 'ERROR'
  return 'PROCESSING'
}

function providerMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value : null
  const object = value as Record<string, any>
  const messages = Array.isArray(object.mensagens) ? object.mensagens : []
  const cancellationMessages = Array.isArray(object.cancelamento?.mensagens) ? object.cancelamento.mensagens : []
  const joined = [...messages, ...cancellationMessages]
    .map(item => item?.descricao || item?.mensagem || item?.message)
    .filter(Boolean)
    .join(' · ')
  return joined || object.mensagem || object.message || object.motivo_status || null
}

function safeCertificate(value: Record<string, any>) {
  return value ? {
    id: value.id,
    serialNumber: value.serial_number,
    issuerName: value.issuer_name,
    validFrom: value.not_valid_before,
    validUntil: value.not_valid_after,
    subjectName: value.subject_name,
    taxId: value.cpf_cnpj,
    legalName: value.nome_razao_social
  } : null
}

function safeCompany(value: Record<string, any>) {
  return value ? {
    taxId: value.cpf_cnpj,
    legalName: value.nome_razao_social,
    tradeName: value.nome_fantasia,
    municipalRegistration: value.inscricao_municipal,
    updatedAt: value.updated_at
  } : null
}

function safeNfseConfiguration(value: Record<string, any>) {
  return value ? {
    environment: value.ambiente,
    taxRegime: value.regTrib,
    rps: value.rps,
    municipalCredentialsConfigured: Boolean(
      value.prefeitura && (value.prefeitura.login || value.prefeitura.senha || value.prefeitura.token)
    )
  } : null
}

function validCpfCnpj(value: string) {
  const number = fiscalDocument(value)
  if (![11, 14].includes(number.length) || /^(.)\1+$/.test(number)) return false
  if (number.length === 11 && !/^\d{11}$/.test(number)) return false
  if (number.length === 14 && !/^[A-Z0-9]{12}\d{2}$/.test(number)) return false
  const calculate = (base: string, weights: number[]) => {
    // O CNPJ alfanumérico usa o valor ASCII do caractere menos 48; para os
    // CNPJs numéricos o cálculo permanece idêntico ao formato anterior.
    const sum = base.split('').reduce((total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index], 0)
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }
  if (number.length === 11) {
    const d1 = calculate(number.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
    const d2 = calculate(number.slice(0, 9) + d1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
    return number.endsWith(`${d1}${d2}`)
  }
  const d1 = calculate(number.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = calculate(number.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return number.endsWith(`${d1}${d2}`)
}
