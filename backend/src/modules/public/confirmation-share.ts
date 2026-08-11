function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function safeColor(value?: string | null) {
  return /^#[\da-f]{6}$/i.test(value || '') ? value! : '#2563eb'
}

export function renderConfirmationSharePage(input: {
  clinicName: string
  primaryColor?: string | null
  logoUrl: string
  shareUrl: string
  confirmationUrl: string
}) {
  const clinicName = escapeHtml(input.clinicName)
  const description = escapeHtml(`Confirme sua consulta com a ${input.clinicName}.`)
  const logoUrl = escapeHtml(input.logoUrl)
  const shareUrl = escapeHtml(input.shareUrl)
  const confirmationUrl = escapeHtml(input.confirmationUrl)
  const color = safeColor(input.primaryColor)

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${clinicName} | Confirmação de consulta</title>
    <meta name="description" content="${description}" />
    <meta property="og:site_name" content="${clinicName}" />
    <meta property="og:title" content="${clinicName}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:image:alt" content="Logo da ${clinicName}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${clinicName}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${logoUrl}" />
    <meta http-equiv="refresh" content="0;url=${confirmationUrl}" />
    <style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif}.card{width:min(420px,100%);padding:32px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 18px 45px rgba(15,23,42,.08)}img{width:76px;height:76px;border-radius:18px;object-fit:cover;margin-bottom:16px}h1{font-size:22px;margin:0 0 8px}p{margin:0 0 22px;color:#64748b;line-height:1.5}a{display:inline-block;padding:12px 18px;border-radius:10px;background:${color};color:#fff;text-decoration:none;font-weight:700}
    </style>
  </head>
  <body>
    <main class="card">
      <img src="${logoUrl}" alt="" />
      <h1>${clinicName}</h1>
      <p>Abrindo a confirmação da sua consulta…</p>
      <a href="${confirmationUrl}">Continuar</a>
    </main>
  </body>
</html>`
}
