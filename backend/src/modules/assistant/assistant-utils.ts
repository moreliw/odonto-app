import { BadRequestException } from '@nestjs/common'

export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function parseClinicDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new BadRequestException('Informe data e horário válidos no horário de Brasília.')
  const parsed = new Date(`${value}:00-03:00`)
  if (!Number.isFinite(parsed.getTime()) || localDate(parsed) !== value.slice(0, 10) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14)) > 59) {
    throw new BadRequestException('Data ou horário inválido.')
  }
  return parsed
}

export function weekStart(date = new Date()) {
  const local = parseClinicDate(`${localDate(date)}T00:00`)
  const day = new Date(`${localDate(date)}T12:00:00Z`).getUTCDay()
  local.setUTCDate(local.getUTCDate() - (day + 6) % 7)
  return local
}

export function addMonths(date: Date, months: number) {
  const result = new Date(date)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, last))
  return result
}

export function readJsonObject(content: unknown): Record<string, any> {
  if (typeof content === 'string') {
    try { return readJsonObject(JSON.parse(content)) } catch { return {} }
  }
  return content && typeof content === 'object' && !Array.isArray(content) ? content as Record<string, any> : {}
}
