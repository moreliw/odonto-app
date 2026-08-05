import { Plan } from '@prisma/client-master'

/**
 * Quantos dentistas cada plano permite. `null` = ilimitado.
 *
 * Precisa continuar espelhando o `dentistLimit` de PRICING_PLANS em
 * frontend/src/app/config/landing.config.ts — é o número anunciado na landing.
 *
 * Só o papel DENTIST conta no limite. ADMIN e USER (recepção, secretária,
 * auxiliar) são ilimitados em todos os planos.
 */
export const DENTIST_LIMIT_BY_PLAN: Record<Plan, number | null> = {
  FREE: 1,
  BASIC: 1,
  PRO: 3,
  CLINIC: null
}

export const PLAN_LABEL: Record<Plan, string> = {
  FREE: 'Teste Gratuito',
  BASIC: 'Essencial',
  PRO: 'Profissional',
  CLINIC: 'Clínica'
}

/** Plano sugerido para quem estourou o limite atual. */
export function nextPlanAfter(plan: Plan): Plan | null {
  if (plan === 'FREE' || plan === 'BASIC') return 'PRO'
  if (plan === 'PRO') return 'CLINIC'
  return null
}
