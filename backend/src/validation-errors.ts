import { BadRequestException, ValidationError } from '@nestjs/common'

/**
 * Erro de validação em português e mapeado por campo.
 *
 * O padrão do class-validator devolve `message` como um array de frases em inglês
 * ("adminEmail must be an email"), que o frontend só conseguia exibir como um bloco
 * único de texto técnico. Aqui a resposta vira:
 *
 *   { statusCode: 400, message: "<primeiro erro, legível>", errors: { campo: "mensagem" } }
 *
 * `message` continua sendo o que as telas antigas já liam; `errors` é o que permite
 * destacar o campo exato no formulário.
 */

/** Nome legível de cada campo, usado para montar mensagens genéricas. */
const FIELD_LABELS: Record<string, string> = {
  clinicName: 'O nome da clínica',
  adminName: 'O nome do responsável',
  adminEmail: 'O e-mail',
  adminPassword: 'A senha',
  subdomain: 'O endereço da clínica',
  plan: 'O plano',
  billingInterval: 'O ciclo de cobrança',
  identifier: 'O usuário',
  password: 'A senha',
  name: 'O nome',
  email: 'O e-mail',
  phone: 'O telefone',
  document: 'O documento',
  patientId: 'O paciente',
  dentistId: 'O dentista',
  dentistName: 'O nome do dentista',
  startTime: 'A data de início',
  endTime: 'A data de término',
  status: 'O status',
  notes: 'As observações',
  amountCents: 'O valor',
  role: 'O perfil de acesso',
  whatsappNumber: 'O número de WhatsApp'
}

function labelFor(field: string) {
  return FIELD_LABELS[field] || `O campo "${field}"`
}

/**
 * Mensagens padrão do class-validator sempre começam com o nome da propriedade
 * ("adminEmail must be an email"). Uma mensagem escrita à mão no DTO nunca começa
 * assim — então esse prefixo é o que distingue "traduzir" de "já está pronto".
 */
function isDefaultMessage(field: string, message: string) {
  return message.startsWith(`${field} `)
}

function translate(field: string, constraint: string, message: string) {
  if (!isDefaultMessage(field, message)) return message

  const label = labelFor(field)
  const amount = message.match(/\d+/)?.[0]

  switch (constraint) {
    case 'isNotEmpty':
    case 'isDefined':
      return `${label} é obrigatório.`
    case 'isEmail':
      return 'Informe um e-mail válido.'
    case 'minLength':
      return `${label} deve ter no mínimo ${amount} caracteres.`
    case 'maxLength':
      return `${label} deve ter no máximo ${amount} caracteres.`
    case 'min':
      return `${label} deve ser no mínimo ${amount}.`
    case 'max':
      return `${label} deve ser no máximo ${amount}.`
    case 'isString':
    case 'isNumber':
    case 'isInt':
    case 'isBoolean':
      return `${label} está em um formato inválido.`
    case 'isDateString':
      return `${label} deve ser uma data válida.`
    case 'isEnum':
    case 'isIn':
      return `${label} tem um valor não permitido.`
    case 'matches':
      return `${label} tem um formato inválido.`
    case 'isUrl':
      return `${label} deve ser um endereço válido.`
    default:
      return `${label} é inválido.`
  }
}

/** Achata erros aninhados (`endereco.cidade`) preservando o caminho completo do campo. */
function flatten(errors: ValidationError[], parent = ''): { field: string; message: string }[] {
  const flat: { field: string; message: string }[] = []
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property
    for (const [constraint, message] of Object.entries(error.constraints || {})) {
      flat.push({ field, message: translate(error.property, constraint, message) })
    }
    if (error.children?.length) flat.push(...flatten(error.children, field))
  }
  return flat
}

export function validationExceptionFactory(errors: ValidationError[]) {
  const flat = flatten(errors)
  const fieldErrors: Record<string, string> = {}
  // Um campo pode falhar em várias regras ao mesmo tempo (ex.: vazio e curto demais).
  // Só a primeira é exibida — é a que o usuário precisa resolver primeiro.
  for (const { field, message } of flat) {
    if (!fieldErrors[field]) fieldErrors[field] = message
  }

  return new BadRequestException({
    statusCode: 400,
    message: flat[0]?.message || 'Verifique os dados enviados.',
    errors: fieldErrors
  })
}
