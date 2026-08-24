/**
 * Conteúdo e preços da landing page.
 *
 * Este arquivo é a única fonte de verdade da página comercial: alterar um preço,
 * um recurso ou uma pergunta do FAQ aqui reflete em toda a landing.
 *
 * REGRA DE HONESTIDADE: só entra como recurso disponível (`status: 'ready'`) o que
 * existe de fato no sistema hoje. O que ainda não foi implementado entra como
 * `status: 'soon'` e é renderizado com o selo "Em breve".
 *
 * Os `priceCents` precisam continuar espelhando o PLAN_CATALOG do backend
 * (backend/src/modules/billing/billing.service.ts), senão o valor anunciado
 * diverge do valor cobrado no checkout.
 */

export type PlanCode = 'BASIC' | 'PRO' | 'CLINIC'

export type FeatureStatus = 'ready' | 'soon'

export interface PlanFeature {
  label: string
  status: FeatureStatus
}

export interface PricingPlan {
  code: PlanCode
  name: string
  tagline: string
  /** Mensalidade cheia, em centavos. Espelha o backend. */
  priceCents: number
  /** Limite de dentistas do plano. `null` = ilimitado. Precisa bater com PLAN_LIMITS do backend. */
  dentistLimit: number | null
  /** Texto curto do limite, exibido em destaque no card. */
  limitLabel: string
  highlight?: boolean
  highlightLabel?: string
  /**
   * Os poucos itens que realmente decidem a escolha do plano. O card mostra só isso —
   * a lista exaustiva vive na tabela comparativa (COMPARISON_GROUPS) logo abaixo, para
   * quem quiser conferir item a item.
   */
  highlights: PlanFeature[]
}

/** Desconto aplicado no ciclo anual (10%). */
export const ANNUAL_DISCOUNT = 0.1

/**
 * A cobrança anual é criada no backend com `recurring: { interval: 'year' }`
 * (ver backend/src/modules/billing/billing.service.ts). Em produção, os Price IDs
 * anuais precisam estar configurados nas variáveis STRIPE_PRICE_*_YEARLY — sem
 * isso o checkout anual falha em vez de cobrar o valor errado. Se for preciso
 * desativar a venda anual temporariamente, volte esta flag para `false`: o
 * toggle passa a mostrar o selo "Em breve" e o checkout cai para mensal.
 */
export const ANNUAL_BILLING_ENABLED = true

export const PRICING_PLANS: PricingPlan[] = [
  {
    code: 'BASIC',
    name: 'Essencial',
    tagline: 'Para o dentista que atende sozinho e quer sair da agenda de papel.',
    priceCents: 12900,
    dentistLimit: 1,
    limitLabel: '1 dentista',
    highlights: [
      { label: 'Agenda, pacientes e prontuário digital', status: 'ready' },
      { label: 'Pacientes e agendamentos ilimitados', status: 'ready' },
      { label: 'Cobranças e receita do mês', status: 'ready' },
      { label: 'Anexo de exames e documentos', status: 'ready' },
      { label: 'Suporte por e-mail', status: 'ready' }
    ]
  },
  {
    code: 'PRO',
    name: 'Profissional',
    tagline: 'Para o consultório que já divide a agenda entre alguns profissionais.',
    priceCents: 27900,
    dentistLimit: 3,
    limitLabel: 'Até 3 dentistas',
    highlight: true,
    highlightLabel: 'Mais escolhido',
    highlights: [
      { label: 'Tudo do Essencial', status: 'ready' },
      { label: 'Até 3 dentistas com login próprio', status: 'ready' },
      { label: 'Recepção e secretária sem custo extra', status: 'ready' },
      { label: 'Perfis de administrador e equipe', status: 'ready' },
      { label: 'Suporte prioritário e ajuda na migração', status: 'ready' }
    ]
  },
  {
    code: 'CLINIC',
    name: 'Clínica',
    tagline: 'Para clínicas com vários profissionais e volume alto de atendimento.',
    priceCents: 44900,
    dentistLimit: null,
    limitLabel: 'Dentistas ilimitados',
    highlights: [
      { label: 'Tudo do Profissional', status: 'ready' },
      { label: 'Dentistas e usuários ilimitados', status: 'ready' },
      { label: 'Sem custo adicional por profissional', status: 'ready' },
      { label: 'Armazenamento ampliado de arquivos', status: 'ready' },
      { label: 'Onboarding acompanhado e atendimento prioritário', status: 'ready' }
    ]
  }
]

export const PRICING_NOTES: string[] = [
  'Teste grátis por 7 dias',
  'Sem cobrança automática durante o teste',
  'Cancelamento simples, quando quiser',
  'Troque de plano a qualquer momento'
]

/** Linhas da tabela comparativa de planos. */
export interface ComparisonRow {
  label: string
  basic: string | boolean
  pro: string | boolean
  clinic: string | boolean
  soon?: boolean
}

export const COMPARISON_GROUPS: { title: string; rows: ComparisonRow[] }[] = [
  {
    title: 'Limites',
    rows: [
      { label: 'Dentistas', basic: '1', pro: 'Até 3', clinic: 'Ilimitado' },
      { label: 'Recepção e secretária', basic: '—', pro: 'Incluído', clinic: 'Incluído' },
      { label: 'Pacientes cadastrados', basic: 'Ilimitado', pro: 'Ilimitado', clinic: 'Ilimitado' },
      { label: 'Agendamentos', basic: 'Ilimitado', pro: 'Ilimitado', clinic: 'Ilimitado' }
    ]
  },
  {
    title: 'Agenda e pacientes',
    rows: [
      { label: 'Agenda com status do atendimento', basic: true, pro: true, clinic: true },
      { label: 'Ficha completa do paciente', basic: true, pro: true, clinic: true },
      { label: 'Prontuário digital com evolução', basic: true, pro: true, clinic: true },
      { label: 'Anexo de exames e imagens', basic: true, pro: true, clinic: true },
      { label: 'Agenda separada por profissional', basic: false, pro: true, clinic: true, soon: true }
    ]
  },
  {
    title: 'Financeiro',
    rows: [
      { label: 'Cobranças por paciente', basic: true, pro: true, clinic: true },
      { label: 'Painel de receita e pendências', basic: true, pro: true, clinic: true },
      { label: 'Planos de tratamento e orçamentos', basic: false, pro: true, clinic: true, soon: true },
      { label: 'Gestão de comissões', basic: false, pro: false, clinic: true, soon: true }
    ]
  },
  {
    title: 'Equipe e segurança',
    rows: [
      { label: 'Perfis de acesso', basic: '—', pro: 'Admin e equipe', clinic: 'Admin e equipe' },
      { label: 'Banco de dados exclusivo', basic: true, pro: true, clinic: true },
      { label: 'Backup automático diário', basic: true, pro: true, clinic: true },
      { label: 'Suporte', basic: 'E-mail', pro: 'Prioritário', clinic: 'Prioritário' }
    ]
  }
]

/* ─────────────────────────────────────────────────────────────
   Faixa de confiança (logo abaixo do hero)
   ───────────────────────────────────────────────────────────── */

/* A faixa de confiança virou a grade bento no template da landing: os mesmos
   argumentos aparecem lá em quatro blocos, sem a lista de seis itens que
   competia com o restante da dobra. */

/* ─────────────────────────────────────────────────────────────
   Problema x Solução
   ───────────────────────────────────────────────────────────── */

export const PROBLEMS: string[] = [
  'Agenda desorganizada e conflitos de horário',
  'Informações do paciente espalhadas em vários lugares',
  'Dificuldade para acompanhar quem já pagou',
  'Pouca visibilidade sobre o desempenho da clínica',
  'Tempo perdido com tarefas repetitivas',
  'Falta de histórico centralizado dos atendimentos'
]

export const SOLUTIONS: string[] = [
  'Agenda organizada com status de cada atendimento',
  'Ficha do paciente completa e sempre à mão',
  'Prontuário digital com histórico de evolução',
  'Documentos, exames e imagens anexados ao paciente',
  'Cobranças e recebimentos controlados por paciente',
  'Painel com os números da clínica em tempo real'
]

/* ─────────────────────────────────────────────────────────────
   Tabs de apresentação do produto
   ───────────────────────────────────────────────────────────── */

export type ProductTabId = 'overview' | 'agenda' | 'patients' | 'records' | 'finance'

export interface ProductTab {
  id: ProductTabId
  label: string
  title: string
  description: string
  outcomes: string[]
}

export const PRODUCT_TABS: ProductTab[] = [
  {
    id: 'overview',
    label: 'Visão geral',
    title: 'Os números da clínica em uma só tela',
    description:
      'Ao entrar no sistema você vê o essencial do dia: pacientes cadastrados, consultas de hoje, receita do mês e a situação das cobranças.',
    outcomes: [
      'Saiba quantos atendimentos tem hoje antes de abrir a agenda',
      'Acompanhe a receita do mês sem montar planilha',
      'Veja rapidamente quantas cobranças seguem pendentes'
    ]
  },
  {
    id: 'agenda',
    label: 'Agenda',
    title: 'Agenda organizada, sem conflito de horário',
    description:
      'Cadastre os atendimentos com horário de início e fim, acompanhe o status de cada um e registre observações da consulta.',
    outcomes: [
      'Marque, edite ou cancele um atendimento em poucos cliques',
      'Diferencie agendado, concluído e cancelado de forma visual',
      'Registre observações que ficam junto do agendamento'
    ]
  },
  {
    id: 'patients',
    label: 'Pacientes',
    title: 'A ficha completa de cada paciente',
    description:
      'Nome, contato, documento e data de nascimento reunidos em um cadastro único, ligado ao histórico de atendimentos e cobranças.',
    outcomes: [
      'Encontre qualquer paciente pela busca',
      'Tenha telefone e e-mail sempre atualizados',
      'Acesse o histórico do paciente sem procurar em papéis'
    ]
  },
  {
    id: 'records',
    label: 'Prontuário',
    title: 'Prontuário digital com histórico de evolução',
    description:
      'Cada atendimento gera um registro no prontuário do paciente, com a evolução em ordem cronológica e anexos quando necessário.',
    outcomes: [
      'Consulte a evolução do tratamento por data',
      'Anexe exames, documentos e imagens ao paciente',
      'Mantenha o histórico clínico centralizado e legível'
    ]
  },
  {
    id: 'finance',
    label: 'Financeiro',
    title: 'Controle do que foi cobrado e do que entrou',
    description:
      'Registre as cobranças de cada paciente, acompanhe o que está pago, pendente ou cancelado e veja a receita consolidada do mês.',
    outcomes: [
      'Saiba exatamente quem está com pagamento em aberto',
      'Acompanhe a receita do mês no painel',
      'Vincule cada cobrança ao paciente correspondente'
    ]
  }
]

/* ─────────────────────────────────────────────────────────────
   Blocos de funcionalidades (texto + visual alternados)
   ───────────────────────────────────────────────────────────── */

export interface FeatureBlock {
  eyebrow: string
  title: string
  description: string
  items: PlanFeature[]
  visual: ProductTabId
}

export const FEATURE_BLOCKS: FeatureBlock[] = [
  {
    eyebrow: 'Agenda',
    title: 'Cada horário no lugar certo',
    description:
      'A agenda concentra os atendimentos da clínica com horário, paciente e status. O que já foi atendido, o que está marcado e o que foi cancelado ficam claros na mesma lista.',
    visual: 'agenda',
    items: [
      { label: 'Horário de início e término por atendimento', status: 'ready' },
      { label: 'Status: agendado, concluído e cancelado', status: 'ready' },
      { label: 'Observações vinculadas ao agendamento', status: 'ready' },
      { label: 'Vínculo direto com a ficha do paciente', status: 'ready' },
      { label: 'Agenda separada por profissional', status: 'soon' },
      { label: 'Bloqueio de horários e confirmação automática', status: 'soon' }
    ]
  },
  {
    eyebrow: 'Pacientes e prontuário',
    title: 'O histórico do paciente sempre acessível',
    description:
      'Cadastro, atendimentos, evolução clínica e documentos ficam reunidos na mesma ficha — sem pastas de papel e sem procurar informação em vários sistemas.',
    visual: 'records',
    items: [
      { label: 'Cadastro com contato, documento e nascimento', status: 'ready' },
      { label: 'Prontuário com evolução por data', status: 'ready' },
      { label: 'Upload de exames, imagens e documentos', status: 'ready' },
      { label: 'Histórico de atendimentos do paciente', status: 'ready' },
      { label: 'Odontograma interativo', status: 'soon' },
      { label: 'Importação de pacientes de outro sistema', status: 'soon' }
    ]
  },
  {
    eyebrow: 'Financeiro',
    title: 'Previsibilidade sem planilha paralela',
    description:
      'As cobranças ficam ligadas ao paciente que as originou. Você acompanha o que foi pago, o que está em aberto e quanto a clínica faturou no mês.',
    visual: 'finance',
    items: [
      { label: 'Cobranças por paciente com valor e data', status: 'ready' },
      { label: 'Situação: pendente, pago e cancelado', status: 'ready' },
      { label: 'Receita do mês consolidada no painel', status: 'ready' },
      { label: 'Visão da quantidade de cobranças em aberto', status: 'ready' },
      { label: 'Lançamento de despesas e fluxo de caixa', status: 'soon' },
      { label: 'Planos de tratamento e orçamentos', status: 'soon' }
    ]
  },
  {
    eyebrow: 'Equipe e acesso',
    title: 'Cada pessoa com o acesso adequado',
    description:
      'Cadastre a equipe da clínica com perfis distintos de acesso. Os dados de cada clínica ficam em um banco separado, sem contato com os de outra.',
    visual: 'overview',
    items: [
      { label: 'Vários usuários na mesma clínica', status: 'ready' },
      { label: 'Perfis de administrador e equipe', status: 'ready' },
      { label: 'Sessão protegida por token com expiração', status: 'ready' },
      { label: 'Dados isolados por clínica', status: 'ready' },
      { label: 'Permissões detalhadas por módulo', status: 'soon' },
      { label: 'Comissões e relatório de produtividade', status: 'soon' }
    ]
  }
]

/** Automações — nenhuma implementada ainda; a seção inteira é "Em breve". */
export const AUTOMATION_ITEMS: PlanFeature[] = [
  { label: 'Lembrete de consulta por e-mail', status: 'soon' },
  { label: 'Confirmação automática de agendamento', status: 'soon' },
  { label: 'Integração com WhatsApp', status: 'ready' },
  { label: 'Mensagem de aniversário', status: 'soon' },
  { label: 'Aviso de retorno programado', status: 'soon' },
  { label: 'Pesquisa de satisfação pós-atendimento', status: 'soon' }
]

/* ─────────────────────────────────────────────────────────────
   Benefícios
   ───────────────────────────────────────────────────────────── */

export interface Benefit {
  title: string
  description: string
  icon: string
}

export const BENEFITS: Benefit[] = [
  {
    icon: 'clock',
    title: 'Reduza tarefas administrativas',
    description: 'Cadastro, agenda e cobranças em um só fluxo — menos retrabalho e menos anotação solta.'
  },
  {
    icon: 'layers',
    title: 'Tenha informações centralizadas',
    description: 'Todo o histórico do paciente em um lugar só, acessível por quem precisa, quando precisa.'
  },
  {
    icon: 'chart',
    title: 'Acompanhe a saúde financeira',
    description: 'Receita do mês e cobranças em aberto sempre visíveis, sem depender de planilha.'
  },
  {
    icon: 'heart',
    title: 'Ofereça uma experiência melhor',
    description: 'Atendimento mais ágil quando a equipe encontra a informação do paciente na hora.'
  }
]

/* ─────────────────────────────────────────────────────────────
   Como funciona
   ───────────────────────────────────────────────────────────── */

export interface Step {
  number: string
  title: string
  description: string
}

export const STEPS: Step[] = [
  { number: '1', title: 'Crie sua conta', description: 'Informe os dados da clínica e escolha um plano. A conta é criada na hora.' },
  { number: '2', title: 'Configure sua clínica', description: 'Cadastre a equipe e os primeiros pacientes com o apoio do nosso suporte.' },
  { number: '3', title: 'Comece a atender', description: 'Monte a agenda, registre os atendimentos e acompanhe os números da clínica.' }
]

/* ─────────────────────────────────────────────────────────────
   Segurança — apenas afirmações verificáveis no sistema
   ───────────────────────────────────────────────────────────── */

export interface SecurityItem {
  title: string
  description: string
}

export const SECURITY_ITEMS: SecurityItem[] = [
  {
    title: 'Conexão criptografada',
    description: 'Todo o tráfego entre o seu navegador e o sistema usa HTTPS com certificado válido e HSTS.'
  },
  {
    title: 'Dados isolados por clínica',
    description: 'Cada clínica tem o seu próprio banco de dados. Uma clínica nunca acessa os dados de outra.'
  },
  {
    title: 'Senhas com hash forte',
    description: 'As senhas são armazenadas com Argon2 e nunca ficam salvas em texto legível.'
  },
  {
    title: 'Controle de acesso por perfil',
    description: 'O acesso é autenticado por token com expiração e separado entre administrador e equipe.'
  },
  {
    title: 'Armazenamento dedicado de arquivos',
    description: 'Exames e documentos ficam em armazenamento de objetos com envio autorizado por link temporário.'
  },
  {
    title: 'Boas práticas de LGPD',
    description: 'O tratamento dos dados segue os princípios da LGPD, com termos de uso e política de privacidade públicos.'
  }
]

/* ─────────────────────────────────────────────────────────────
   Para quem é
   ───────────────────────────────────────────────────────────── */

export interface Audience {
  title: string
  description: string
}

export const AUDIENCES: Audience[] = [
  { title: 'Dentista autônomo', description: 'Organize sozinho a sua agenda, os pacientes e os recebimentos.' },
  { title: 'Consultório com equipe', description: 'Compartilhe a operação com recepção e outros profissionais.' },
  { title: 'Clínica com vários profissionais', description: 'Centralize o atendimento de todos em uma única base.' }
]

/* ─────────────────────────────────────────────────────────────
   FAQ — respostas fiéis ao funcionamento real do produto
   ───────────────────────────────────────────────────────────── */

export interface Faq {
  question: string
  answer: string
}

export const FAQS: Faq[] = [
  {
    question: 'Preciso instalar alguma coisa?',
    answer:
      'Não. O OdontoApp funciona inteiramente no navegador. Basta acessar o endereço da sua clínica e entrar com o seu usuário.'
  },
  {
    question: 'Posso acessar pelo celular?',
    answer:
      'Sim. A interface se adapta a celular, tablet e computador. Não existe aplicativo para instalar — o acesso é pelo navegador.'
  },
  {
    question: 'O período de teste exige cartão de crédito?',
    answer:
      'Não pedimos cartão para iniciar o teste e não há cobrança automática durante o período gratuito. A cobrança só começa quando você contrata um plano.'
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim. Não há fidelidade nem multa. Ao cancelar, a assinatura deixa de ser renovada e o acesso permanece até o fim do período já pago.'
  },
  {
    question: 'Quantos dentistas posso cadastrar em cada plano?',
    answer:
      'O Essencial atende 1 dentista. O Profissional vai até 3 dentistas. O plano Clínica não tem limite. Em todos eles, recepção e secretária entram como usuários de apoio e não contam no limite de dentistas.'
  },
  {
    question: 'O que acontece se eu passar do limite de dentistas do meu plano?',
    answer:
      'O sistema avisa na hora de cadastrar o novo profissional e não deixa concluir. O responsável pode trocar para o plano seguinte em Plano e assinatura, sem perder nada do que já existe.'
  },
  {
    question: 'Meus dados estarão protegidos?',
    answer:
      'Cada clínica tem um banco de dados separado, o acesso é feito por conexão criptografada e as senhas são guardadas com hash Argon2. Os arquivos ficam em armazenamento dedicado.'
  },
  {
    question: 'É possível importar meus pacientes de outro sistema?',
    answer:
      'A importação automática ainda está em desenvolvimento. Hoje o cadastro é feito pela tela de pacientes e a nossa equipe pode orientar você nessa etapa inicial.'
  },
  {
    question: 'Existe suporte durante a configuração?',
    answer:
      'Sim. Você fala com uma pessoa da nossa equipe por e-mail durante a implantação, para configurar a clínica e tirar dúvidas dos primeiros dias.'
  },
  {
    question: 'Posso mudar de plano depois?',
    answer:
      'Pode. O responsável pela clínica gerencia upgrades, forma de pagamento, faturas e cancelamento em Plano e assinatura, sem perder os dados já cadastrados.'
  },
  {
    question: 'O sistema tem treinamento?',
    answer:
      'O sistema foi desenhado para ser usado sem treinamento formal. Durante a implantação orientamos a equipe nas telas principais: agenda, pacientes, prontuário e financeiro.'
  }
]

/* ─────────────────────────────────────────────────────────────
   Contato e rodapé
   ───────────────────────────────────────────────────────────── */

export const CONTACT_EMAIL = 'contato@odontoapp.com'
