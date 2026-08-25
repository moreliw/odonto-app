'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function workspaceModule(name) {
  try {
    return require(path.join('/app/node_modules', name))
  } catch {
    return require(path.join(__dirname, '..', 'backend', 'node_modules', name))
  }
}

const { PrismaClient: MasterClient } = workspaceModule('@prisma/client-master')
const { PrismaClient: TenantClient } = workspaceModule('@prisma/client-tenant')

const TARGET_DB = 'tenant_clinica-teste-whatsapp'
const TARGET_SLUG = 'clinica-teste-whatsapp'
const TARGET_ADMIN_USERNAME = 'admintestewhatsapp20260811'
const CLINIC_NAME = 'Clínica Lumina Odontologia'
const AUDIT_ADMIN = 'Marina Albuquerque'
const APP_TIME_ZONE = 'America/Sao_Paulo'

function id() {
  return crypto.randomUUID()
}

function dateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const value = type => Number(parts.find(part => part.type === type)?.value)
  return { year: value('year'), month: value('month'), day: value('day') }
}

const today = dateParts()

// O Brasil não adota horário de verão em 2026. A soma de três horas converte
// um horário de Brasília para UTC e mantém a agenda visualmente previsível.
function localDate(year, month, day, hour = 9, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0, 0))
}

function todayAt(hour, minute = 0, dayOffset = 0) {
  return localDate(today.year, today.month, today.day + dayOffset, hour, minute)
}

function monthAt(monthOffset, day, hour = 10, minute = 0) {
  const base = new Date(Date.UTC(today.year, today.month - 1 + monthOffset, 1))
  return localDate(base.getUTCFullYear(), base.getUTCMonth() + 1, day, hour, minute)
}

function addMinutes(value, minutes) {
  return new Date(value.getTime() + minutes * 60_000)
}

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')
}

const patientNames = [
  'Ana Clara Ribeiro', 'Bruno Ferreira Lopes', 'Carolina Mendes Azevedo', 'Daniel Costa Freitas',
  'Eduarda Martins Rocha', 'Felipe Almeida Nunes', 'Gabriela Souza Lima', 'Henrique Cardoso Reis',
  'Isabela Moreira Campos', 'João Pedro Barros', 'Karen Oliveira Duarte', 'Lucas Teixeira Prado',
  'Mariana Alves Faria', 'Nicolas Santana Moura', 'Olívia Gonçalves Pires', 'Paulo Henrique Castro',
  'Renata Ribeiro Matos', 'Samuel Vieira Correia', 'Talita Barbosa Melo', 'Vinícius Araújo Dias',
  'Beatriz Neves Monteiro', 'Caio Figueiredo Paiva', 'Débora Vasconcelos', 'Enzo Tavares Brito',
  'Fernanda Cavalcante', 'Gustavo Martins Leal', 'Helena Nascimento', 'Igor Melo Xavier',
  'Júlia Andrade Pinho', 'Leandro Gomes Silva', 'Marcela Carvalho Reis', 'Natália Peixoto Sales',
  'Otávio Mendes Castro', 'Patrícia Amaral Borges', 'Rafael Souza Gama', 'Sabrina Costa Almeida',
  'Thiago Moreira Lins', 'Valentina Ribeiro Luz', 'Wagner Pires Duarte', 'Yasmin Freitas Nogueira',
  'Alice Moura Coutinho', 'Bernardo Vieira Lopes', 'Camila Torres Azevedo', 'Davi Monteiro Braga',
  'Elisa Cardoso Martins', 'Fernando Lima Reis', 'Giovana Prado Nunes', 'Heitor Oliveira Matos'
]

const professions = [
  'Arquiteta', 'Engenheiro civil', 'Administradora', 'Professor', 'Designer', 'Analista de sistemas',
  'Nutricionista', 'Empresário', 'Advogada', 'Fotógrafo', 'Fisioterapeuta', 'Contadora'
]
const neighborhoods = ['Praia do Canto', 'Jardim Camburi', 'Mata da Praia', 'Bento Ferreira', 'Itapuã', 'Praia da Costa']
const streets = ['Rua das Acácias', 'Avenida das Palmeiras', 'Rua do Horizonte', 'Alameda dos Ipês', 'Rua das Orquídeas', 'Avenida Central']

function patientRows() {
  return patientNames.map((name, index) => {
    const monthOffset = -Math.floor(index / 8)
    const createdAt = monthAt(monthOffset, 3 + (index * 3) % 23, 9 + index % 7)
    const birthYear = 1963 + (index * 7) % 43
    const feminine = /a$|Olívia|Beatriz|Débora|Yasmin|Karen|Talita|Júlia|Carol|Isabela|Renata|Patrícia|Sabrina|Valentina|Alice|Camila|Elisa|Giovana|Helena|Natália|Marcela|Fernanda|Eduarda|Mariana|Gabriela/.test(name)
    const city = index % 4 === 0 ? 'Vila Velha' : 'Vitória'
    const state = 'ES'
    return {
      id: id(),
      name,
      email: `${slug(name)}@lumina.odonto`,
      phone: `+552790000${String(index + 1).padStart(4, '0')}`,
      whatsapp: `+552790000${String(index + 1).padStart(4, '0')}`,
      birthDate: localDate(birthYear, 1 + index % 12, 2 + (index * 5) % 25),
      document: `000.000.${String(100 + index).padStart(3, '0')}-${String((index * 7) % 99).padStart(2, '0')}`,
      gender: feminine ? 'Feminino' : 'Masculino',
      postalCode: `290${String(10 + index % 70).padStart(2, '0')}-000`,
      address: streets[index % streets.length],
      addressNumber: String(80 + index * 11),
      addressComplement: index % 5 === 0 ? `Apto ${201 + index}` : null,
      neighborhood: neighborhoods[index % neighborhoods.length],
      city,
      state,
      profession: professions[index % professions.length],
      insuranceName: index % 4 === 0 ? 'Particular' : index % 4 === 1 ? 'Odonto Saúde' : index % 4 === 2 ? 'Dental Mais' : 'Sorriso Card',
      insuranceNumber: index % 4 === 0 ? null : `LM-${today.year}-${String(12000 + index).padStart(5, '0')}`,
      bloodType: ['A+', 'O+', 'B+', 'A-', 'O-'][index % 5],
      allergies: index % 11 === 0 ? 'Alergia a dipirona' : index % 13 === 0 ? 'Sensibilidade a látex' : null,
      medications: index % 9 === 0 ? 'Losartana 50 mg' : null,
      preexistingConditions: index % 9 === 0 ? 'Hipertensão controlada' : null,
      medicalNotes: index % 8 === 0 ? 'Paciente orientado a informar qualquer alteração medicamentosa.' : null,
      notes: index % 7 === 0 ? 'Prefere atendimento no período da manhã.' : null,
      createdByName: index % 3 === 0 ? 'Camila Rocha' : AUDIT_ADMIN,
      updatedByName: AUDIT_ADMIN,
      createdAt,
      updatedAt: addMinutes(createdAt, 45 + index * 3)
    }
  })
}

const serviceCatalog = [
  ['Avaliação e diagnóstico', 'Consultas', 180, 40, 'Avaliação clínica completa e planejamento inicial.'],
  ['Profilaxia e aplicação de flúor', 'Prevenção', 280, 50, 'Limpeza profissional, polimento e orientação preventiva.'],
  ['Restauração em resina', 'Dentística', 420, 60, 'Restauração estética em resina fotopolimerizável.'],
  ['Clareamento dental', 'Estética', 1650, 60, 'Clareamento supervisionado com protocolo personalizado.'],
  ['Tratamento endodôntico', 'Endodontia', 1850, 90, 'Tratamento de canal com instrumentação mecanizada.'],
  ['Coroa em porcelana', 'Prótese', 2400, 90, 'Coroa unitária estética em cerâmica.'],
  ['Implante unitário', 'Implantodontia', 4800, 90, 'Instalação de implante e acompanhamento cirúrgico.'],
  ['Manutenção ortodôntica', 'Ortodontia', 220, 30, 'Acompanhamento e ativação mensal do aparelho.'],
  ['Faceta em porcelana', 'Estética', 2100, 90, 'Faceta cerâmica personalizada por elemento.'],
  ['Extração simples', 'Cirurgia', 550, 60, 'Exodontia simples com acompanhamento pós-operatório.']
].map(([name, category, price, durationMinutes, description]) => ({
  id: id(), name, category, price, durationMinutes, description, active: true,
  createdByName: AUDIT_ADMIN, updatedByName: AUDIT_ADMIN, createdAt: monthAt(-5, 2), updatedAt: monthAt(-1, 5)
}))

function appointmentRows(patients, dentists) {
  const rows = []
  const historicalByPatient = new Map()

  patients.forEach((patient, index) => {
    // Mantém atividade forte no mês atual para a dashboard e distribui o
    // restante do histórico de forma natural pelos meses anteriores.
    const monthOffset = index < 24 ? 0 : -Math.ceil((index - 23) / 6)
    const startTime = monthOffset === 0
      ? todayAt(8 + index % 8, index % 2 ? 30 : 0, -(2 + index % 18))
      : monthAt(monthOffset, 5 + (index * 4) % 21, 8 + index % 9, index % 2 ? 30 : 0)
    const status = index % 12 === 0 ? 'CANCELLED' : 'COMPLETED'
    const appointment = {
      id: id(), patientId: patient.id, dentistId: dentists[index % dentists.length].id, dentistName: null,
      startTime, endTime: addMinutes(startTime, [40, 50, 60, 90][index % 4]), status,
      notes: status === 'CANCELLED' ? 'Reagendamento solicitado pelo paciente.' : ['Avaliação e plano preventivo.', 'Procedimento realizado sem intercorrências.', 'Retorno programado conforme plano clínico.'][index % 3],
      confirmationStatus: status === 'CANCELLED' ? 'DECLINED' : 'CONFIRMED',
      confirmationSentAt: addMinutes(startTime, -24 * 60), confirmationRespondedAt: addMinutes(startTime, -22 * 60),
      createdByName: index % 4 === 0 ? 'Camila Rocha' : AUDIT_ADMIN, updatedByName: dentists[index % dentists.length].name,
      createdAt: addMinutes(startTime, -14 * 24 * 60), updatedAt: addMinutes(startTime, 70)
    }
    rows.push(appointment)
    historicalByPatient.set(patient.id, appointment)
  })

  const todaySlots = [
    [8, 0, 50, 'COMPLETED', 'CONFIRMED'], [9, 0, 50, 'COMPLETED', 'CONFIRMED'],
    [10, 0, 60, 'COMPLETED', 'CONFIRMED'], [11, 0, 60, 'SCHEDULED', 'CONFIRMED'],
    [12, 15, 45, 'SCHEDULED', 'CONFIRMED'], [13, 30, 60, 'SCHEDULED', 'PENDING'],
    [14, 30, 50, 'SCHEDULED', 'CONFIRMED'], [15, 30, 60, 'SCHEDULED', 'PENDING'],
    [16, 30, 50, 'SCHEDULED', 'CONFIRMED'], [17, 30, 40, 'SCHEDULED', 'PENDING']
  ]
  todaySlots.forEach(([hour, minute, duration, status, confirmationStatus], index) => {
    const startTime = todayAt(hour, minute)
    rows.push({
      id: id(), patientId: patients[index].id, dentistId: dentists[index % dentists.length].id, dentistName: null,
      startTime, endTime: addMinutes(startTime, duration), status, confirmationStatus,
      notes: ['Consulta preventiva', 'Restauração estética', 'Avaliação de retorno', 'Clareamento supervisionado', 'Manutenção ortodôntica'][index % 5],
      confirmationSentAt: addMinutes(startTime, -24 * 60), confirmationRespondedAt: confirmationStatus === 'CONFIRMED' ? addMinutes(startTime, -20 * 60) : null,
      createdByName: 'Camila Rocha', updatedByName: AUDIT_ADMIN,
      createdAt: todayAt(9, 0, -12 - index), updatedAt: todayAt(8, 0, -1)
    })
  })

  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    ;[9, 13, 16].forEach((hour, slot) => {
      const index = 10 + (dayOffset - 1) * 3 + slot
      const startTime = todayAt(hour, slot === 1 ? 30 : 0, dayOffset)
      rows.push({
        id: id(), patientId: patients[index % patients.length].id, dentistId: dentists[(dayOffset + slot) % dentists.length].id, dentistName: null,
        startTime, endTime: addMinutes(startTime, slot === 1 ? 60 : 50), status: 'SCHEDULED',
        confirmationStatus: (dayOffset + slot) % 3 === 0 ? 'PENDING' : 'CONFIRMED',
        notes: ['Avaliação clínica', 'Procedimento restaurador', 'Acompanhamento do tratamento'][slot],
        confirmationSentAt: dayOffset <= 2 ? todayAt(10, 0, -1) : null,
        confirmationRespondedAt: (dayOffset + slot) % 3 === 0 ? null : todayAt(12, 0, -1),
        createdByName: slot === 0 ? AUDIT_ADMIN : 'Juliana Freitas', updatedByName: AUDIT_ADMIN,
        createdAt: todayAt(10, 0, -(10 - dayOffset)), updatedAt: todayAt(11, 0, -1)
      })
    })
  }

  return { rows, historicalByPatient }
}

function recordRows(patients, appointments, dentists) {
  const rows = []
  const addRecord = (patient, content, createdAt, professional) => rows.push({
    id: id(), patientId: patient.id, content: { ...content, schemaVersion: 2 },
    createdByName: professional || AUDIT_ADMIN, updatedByName: professional || AUDIT_ADMIN,
    createdAt, updatedAt: addMinutes(createdAt, 12)
  })

  patients.slice(0, 16).forEach((patient, index) => {
    addRecord(patient, {
      type: 'ANAMNESIS', title: 'Anamnese', chiefComplaint: ['Sensibilidade ao frio', 'Avaliação preventiva', 'Melhora da estética do sorriso', 'Dor ocasional ao mastigar'][index % 4],
      currentHistory: 'Queixa de início gradual, sem episódios de urgência. Busca acompanhamento preventivo e resolução planejada.',
      medicalHistory: index % 9 === 0 ? 'Hipertensão controlada e acompanhada regularmente.' : 'Sem alterações sistêmicas relevantes relatadas.',
      dentalHistory: 'Realiza acompanhamento odontológico periódico e relata boa adaptação aos tratamentos anteriores.',
      allergies: patient.allergies || 'Nega alergias conhecidas', medications: patient.medications || 'Não utiliza medicação contínua',
      surgeries: 'Nega cirurgias recentes', observations: 'Informações confirmadas pelo paciente na consulta.',
      hasAllergies: Boolean(patient.allergies), usesMedications: Boolean(patient.medications), hasDiabetes: false,
      hasHypertension: Boolean(patient.preexistingConditions), hasHeartCondition: false, hasBleedingRisk: false,
      hasInfectiousDisease: false, isPregnant: false, smoker: false, anesthesiaReaction: false, informationConfirmed: true
    }, addMinutes(appointments.get(patient.id).startTime, -40), dentists[index % dentists.length].name)
  })

  patients.slice(0, 24).forEach((patient, index) => {
    const appointment = appointments.get(patient.id)
    if (appointment.status === 'CANCELLED') return
    const professional = dentists[index % dentists.length].name
    addRecord(patient, {
      type: 'EVOLUTION', title: ['Evolução clínica', 'Consulta preventiva', 'Retorno de acompanhamento'][index % 3],
      clinicalDate: appointment.startTime.toISOString(), appointmentId: appointment.id,
      subjective: ['Paciente relata melhora da sensibilidade desde a última orientação.', 'Sem queixas agudas. Compareceu para acompanhamento preventivo.', 'Paciente satisfeito com a evolução estética e funcional.'][index % 3],
      objective: 'Tecidos periodontais com aspecto saudável. Higiene oral satisfatória e oclusão estável.',
      assessment: ['Condição clínica estável.', 'Necessidade restauradora localizada.', 'Evolução favorável do tratamento.'][index % 3],
      plan: 'Manter acompanhamento periódico e reforçar higiene oral domiciliar.',
      procedure: ['Profilaxia, polimento e orientação de higiene.', 'Avaliação clínica e registro fotográfico.', 'Ajuste oclusal e acompanhamento.'][index % 3],
      technique: 'Protocolo clínico convencional com isolamento relativo.', materials: 'Materiais descartáveis e instrumentais esterilizados.',
      guidance: 'Orientado sobre higiene interdental e retorno preventivo em seis meses.', intercurrences: 'Sem intercorrências.',
      nextVisit: 'Retorno conforme plano de tratamento.', teeth: index % 3 === 0 ? ['16'] : [], surfaces: index % 3 === 0 ? ['O/I'] : []
    }, addMinutes(appointment.startTime, 35), professional)
  })

  patients.slice(0, 12).forEach((patient, index) => {
    const findings = [
      { id: `finding-${index}-1`, teeth: [index % 2 ? '16' : '26'], status: index % 3 === 0 ? 'CARIES' : 'RESTORATION', surfaces: ['O/I'], note: index % 3 === 0 ? 'Lesão inicial com indicação restauradora.' : 'Restauração em bom estado clínico.' },
      { id: `finding-${index}-2`, teeth: [index % 2 ? '36' : '46'], status: index % 4 === 0 ? 'WATCH' : 'HEALTHY', surfaces: [], note: index % 4 === 0 ? 'Sulco pigmentado em acompanhamento.' : 'Elemento hígido.' }
    ]
    const entries = findings.map(finding => ({ tooth: finding.teeth[0], status: finding.status, statuses: [finding.status], surfaces: finding.surfaces, note: finding.note }))
    addRecord(patient, { type: 'ODONTOGRAM', title: 'Odontograma clínico', dentition: 'PERMANENT', findings, entries, notes: 'Exame clínico realizado com boa colaboração do paciente.' }, addMinutes(appointments.get(patient.id).startTime, 20), dentists[index % dentists.length].name)
  })

  patients.slice(0, 10).forEach((patient, index) => {
    const service = serviceCatalog[2 + index % 7]
    const status = ['IN_PROGRESS', 'APPROVED', 'PLANNED', 'COMPLETED'][index % 4]
    addRecord(patient, {
      type: 'TREATMENT', title: service.name, procedure: service.name, tooth: ['16', '26', '11', '21', '36'][index % 5],
      professionalId: dentists[index % dentists.length].id, professionalName: dentists[index % dentists.length].name,
      clinicalDate: appointments.get(patient.id).startTime.toISOString().slice(0, 10), value: service.price, status,
      notes: status === 'COMPLETED' ? 'Tratamento concluído com resultado clínico satisfatório.' : 'Etapas e orientações apresentadas ao paciente.'
    }, addMinutes(appointments.get(patient.id).startTime, 25), dentists[index % dentists.length].name)
  })

  patients.slice(0, 6).forEach((patient, index) => {
    addRecord(patient, {
      type: 'TREATMENT_PLAN', title: ['Reabilitação estética anterior', 'Plano preventivo e restaurador', 'Reabilitação funcional'][index % 3],
      status: ['APPROVED', 'IN_PROGRESS', 'PROPOSED'][index % 3], diagnosis: 'Alterações estéticas e funcionais localizadas, sem sinais de urgência.',
      objectives: 'Restabelecer saúde, função e harmonia do sorriso.', alternatives: 'Opções conservadoras e reabilitadoras discutidas com o paciente.',
      procedures: 'Adequação do meio bucal, tratamento restaurador e acompanhamento preventivo.',
      risksBenefits: 'Benefícios, limitações e cuidados pós-operatórios explicados.', estimate: `R$ ${(3200 + index * 850).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      patientDecision: index % 3 === 2 ? 'Aguardando decisão do paciente.' : 'Plano aceito pelo paciente.', notes: 'Valores sujeitos à confirmação após exames complementares.',
      teeth: index % 2 ? ['11', '21'] : ['16', '26']
    }, addMinutes(appointments.get(patient.id).startTime, 28), dentists[index % dentists.length].name)
  })

  return rows
}

function invoiceRows(patients, appointmentMap, dentists) {
  const invoices = []
  const items = []
  const payments = []
  patients.slice(0, 38).forEach((patient, index) => {
    const service = serviceCatalog[index % serviceCatalog.length]
    const invoiceId = id()
    const appointment = appointmentMap.get(patient.id)
    const issuedAt = appointment.startTime
    let status = 'PAID'
    if (index % 9 === 7) status = 'PARTIAL'
    if (index % 9 === 8) status = 'PENDING'
    const dueDate = status === 'PENDING' && index % 2 === 0 ? todayAt(0, 0, -8) : addMinutes(issuedAt, 7 * 24 * 60)
    const dentist = dentists[index % dentists.length]
    invoices.push({
      id: invoiceId, patientId: patient.id, appointmentId: appointment.id, dentistId: dentist.id, dentistName: null,
      description: service.name, amount: service.price, discount: 0, status, issuedAt, dueDate,
      notes: status === 'PENDING' ? 'Cobrança aguardando pagamento.' : 'Lançamento vinculado ao atendimento.',
      createdByName: index % 4 === 0 ? 'Camila Rocha' : AUDIT_ADMIN, updatedByName: AUDIT_ADMIN,
      createdAt: issuedAt, updatedAt: addMinutes(issuedAt, 20)
    })
    items.push({ id: id(), invoiceId, serviceId: service.id, description: service.name, quantity: 1, unitPrice: service.price, total: service.price, createdAt: issuedAt })
    if (status === 'PAID' || status === 'PARTIAL') {
      payments.push({
        id: id(), invoiceId, amount: status === 'PARTIAL' ? Math.round(service.price * 0.45 * 100) / 100 : service.price,
        paidAt: addMinutes(issuedAt, index % 3 === 0 ? 0 : 24 * 60), method: ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH'][index % 4],
        notes: status === 'PARTIAL' ? 'Entrada do tratamento.' : 'Pagamento confirmado.', createdAt: addMinutes(issuedAt, 5)
      })
    }
  })
  return { invoices, items, payments }
}

function expenseRows() {
  const definitions = [
    ['Aluguel da clínica', 'Estrutura', 'Imobiliária Horizonte', 4200, 'PAID', 'BANK_TRANSFER'],
    ['Laboratório de prótese', 'Laboratório', 'Cerâmica Design Lab', 2800, 'PAID', 'PIX'],
    ['Materiais odontológicos', 'Insumos', 'Dental Supply ES', 1900, 'PAID', 'BOLETO'],
    ['Folha da equipe de apoio', 'Equipe', 'Equipe Lumina', 5200, 'PAID', 'BANK_TRANSFER'],
    ['Marketing e conteúdo', 'Marketing', 'Estúdio Norte', 1200, 'PAID', 'PIX'],
    ['Software e telefonia', 'Tecnologia', 'Serviços digitais', 450, 'PAID', 'CREDIT_CARD'],
    ['Manutenção preventiva dos equipamentos', 'Equipamentos', 'OdontoTech Assistência', 980, 'PENDING', null]
  ]
  return definitions.map(([description, category, supplier, amount, status, paymentMethod], index) => {
    const issuedAt = todayAt(9, 0, -(22 - index * 3))
    return {
      id: id(), description, category, supplier, amount, status, issuedAt, dueDate: addMinutes(issuedAt, 5 * 24 * 60),
      paidAt: status === 'PAID' ? addMinutes(issuedAt, 2 * 24 * 60) : null, paymentMethod, recurring: index < 2,
      notes: status === 'PAID' ? 'Pagamento conciliado.' : 'Programado para pagamento.',
      createdByName: AUDIT_ADMIN, updatedByName: AUDIT_ADMIN, createdAt: issuedAt, updatedAt: addMinutes(issuedAt, 15)
    }
  })
}

async function main() {
  if (!process.env.MASTER_DATABASE_URL) throw new Error('MASTER_DATABASE_URL não configurada.')
  const master = new MasterClient()
  const tenantMeta = await master.tenant.findFirst({ where: { dbName: TARGET_DB, slug: TARGET_SLUG } })
  if (!tenantMeta) throw new Error('Clínica de demonstração alvo não encontrada. Carga cancelada.')

  const tenantUrl = new URL(process.env.MASTER_DATABASE_URL)
  tenantUrl.pathname = `/${TARGET_DB}`
  const tenant = new TenantClient({ datasources: { db: { url: tenantUrl.toString() } } })

  const admin = await tenant.user.findFirst({ where: { username: TARGET_ADMIN_USERNAME, role: 'ADMIN' } })
  if (!admin?.passwordHash) throw new Error('Administrador esperado não encontrado. Carga cancelada.')

  const logoPath = process.env.DEMO_LOGO_PATH
  const logoData = logoPath && fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null
  const publicUrl = (process.env.PUBLIC_APP_URL || 'https://odontoapp.morelidev.com').replace(/\/$/, '')

  const patients = patientRows()
  const professionals = [
    { id: id(), username: 'dra.helena.costa', email: 'helena.costa@lumina.odonto', name: 'Dra. Helena Costa', role: 'DENTIST' },
    { id: id(), username: 'dr.rafael.mendes', email: 'rafael.mendes@lumina.odonto', name: 'Dr. Rafael Mendes', role: 'DENTIST' },
    { id: id(), username: 'dra.beatriz.lima', email: 'beatriz.lima@lumina.odonto', name: 'Dra. Beatriz Lima', role: 'DENTIST' },
    { id: id(), username: 'dr.lucas.andrade', email: 'lucas.andrade@lumina.odonto', name: 'Dr. Lucas Andrade', role: 'DENTIST' }
  ]
  const support = [
    { id: id(), username: 'camila.rocha', email: 'camila.rocha@lumina.odonto', name: 'Camila Rocha', role: 'USER' },
    { id: id(), username: 'juliana.freitas', email: 'juliana.freitas@lumina.odonto', name: 'Juliana Freitas', role: 'USER' }
  ]
  const appointmentData = appointmentRows(patients, professionals)
  const recordData = recordRows(patients, appointmentData.historicalByPatient, professionals)
  const financialData = invoiceRows(patients, appointmentData.historicalByPatient, professionals)

  await tenant.$transaction(async tx => {
    await tx.invoicePayment.deleteMany()
    await tx.invoiceItem.deleteMany()
    await tx.invoice.deleteMany()
    await tx.expense.deleteMany()
    await tx.record.deleteMany()
    await tx.appointment.deleteMany()
    await tx.file.deleteMany()
    await tx.patient.deleteMany()
    await tx.clinicService.deleteMany()
    await tx.user.deleteMany({ where: { id: { not: admin.id } } })

    await tx.user.update({
      where: { id: admin.id },
      data: { name: AUDIT_ADMIN, email: 'marina.albuquerque@lumina.odonto', createdByName: 'Sistema', updatedByName: AUDIT_ADMIN, accessOverrides: null }
    })
    await tx.user.createMany({
      data: [...professionals, ...support].map(user => ({
        ...user, passwordHash: admin.passwordHash, active: true, createdByName: AUDIT_ADMIN, updatedByName: AUDIT_ADMIN,
        createdAt: monthAt(-5, 2), updatedAt: monthAt(0, 3)
      }))
    })

    await tx.roleAccessPolicy.upsert({
      where: { role: 'USER' },
      update: { permissions: JSON.stringify(['DASHBOARD_VIEW', 'APPOINTMENTS_VIEW', 'APPOINTMENTS_MANAGE', 'PATIENTS_VIEW', 'PATIENTS_MANAGE', 'RECORDS_VIEW', 'RECORDS_MANAGE', 'FINANCE_VIEW', 'FINANCE_MANAGE']), updatedByName: AUDIT_ADMIN },
      create: { role: 'USER', permissions: JSON.stringify(['DASHBOARD_VIEW', 'APPOINTMENTS_VIEW', 'APPOINTMENTS_MANAGE', 'PATIENTS_VIEW', 'PATIENTS_MANAGE', 'RECORDS_VIEW', 'RECORDS_MANAGE', 'FINANCE_VIEW', 'FINANCE_MANAGE']), updatedByName: AUDIT_ADMIN }
    })
    await tx.roleAccessPolicy.upsert({
      where: { role: 'DENTIST' },
      update: { permissions: JSON.stringify(['DASHBOARD_VIEW', 'APPOINTMENTS_VIEW', 'PATIENTS_VIEW', 'RECORDS_VIEW', 'RECORDS_MANAGE']), updatedByName: AUDIT_ADMIN },
      create: { role: 'DENTIST', permissions: JSON.stringify(['DASHBOARD_VIEW', 'APPOINTMENTS_VIEW', 'PATIENTS_VIEW', 'RECORDS_VIEW', 'RECORDS_MANAGE']), updatedByName: AUDIT_ADMIN }
    })

    await tx.clinicService.createMany({ data: serviceCatalog })
    await tx.patient.createMany({ data: patients })
    await tx.appointment.createMany({ data: appointmentData.rows })
    await tx.record.createMany({ data: recordData })
    await tx.invoice.createMany({ data: financialData.invoices })
    await tx.invoiceItem.createMany({ data: financialData.items })
    await tx.invoicePayment.createMany({ data: financialData.payments })
    await tx.expense.createMany({ data: expenseRows() })
  }, { maxWait: 20_000, timeout: 120_000 })

  await master.tenant.update({
    where: { id: tenantMeta.id },
    data: {
      name: CLINIC_NAME,
      primaryColor: '#2563EB',
      internalNotes: 'Base de demonstração para apresentações, vídeos e materiais de marketing. Todos os dados clínicos são fictícios.',
      ...(logoData ? {
        logoData,
        logoContentType: 'image/png',
        logoKey: null,
        logoUrl: `${publicUrl}/api/public/branding/logo/${tenantMeta.id}?v=${Date.now()}`
      } : {})
    }
  })
  await master.loginIdentity.updateMany({
    where: { tenantId: tenantMeta.id },
    data: { email: 'marina.albuquerque@lumina.odonto' }
  })

  const counts = await Promise.all([
    tenant.user.count(), tenant.patient.count(), tenant.appointment.count(), tenant.record.count(),
    tenant.clinicService.count(), tenant.invoice.count(), tenant.invoicePayment.count(), tenant.expense.count()
  ])
  console.log(JSON.stringify({
    clinic: CLINIC_NAME,
    target: TARGET_DB,
    users: counts[0], patients: counts[1], appointments: counts[2], records: counts[3],
    services: counts[4], invoices: counts[5], payments: counts[6], expenses: counts[7]
  }))

  await tenant.$disconnect()
  await master.$disconnect()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
