/** Normaliza telefones brasileiros e internacionais para o formato E.164 usado pelo wa.me. */
export function normalizeWhatsappPhone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const explicitCountryCode = trimmed.startsWith('+') || trimmed.startsWith('00')
  let digits = trimmed.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!explicitCountryCode && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`
  if (digits.length < 8 || digits.length > 15) return null

  return `+${digits}`
}

/** Link oficial do WhatsApp que abre o app ou o WhatsApp Web com a mensagem preenchida. */
export function buildWhatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
