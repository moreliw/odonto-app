const http = require('http')

const now = new Date()
const at = (hour, minute, duration = 30) => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute)
  const end = new Date(start.getTime() + duration * 60_000)
  return { startTime: start.toISOString(), endTime: end.toISOString() }
}

const appointments = [
  ['1', 'Sandra Menegardo', 'Bruna Travisani', 8, 0, 'COMPLETED', 'CONFIRMED'],
  ['2', 'Marcele Scheidegger', 'Bruna Travisani', 8, 30, 'COMPLETED', 'CONFIRMED'],
  ['3', 'Carlos Alberto Benevides', 'Bruna Travisani', 8, 30, 'SCHEDULED', 'CONFIRMED'],
  ['4', 'Laureci Dalmolin', 'Bruna Travisani', 9, 0, 'SCHEDULED', 'CONFIRMED'],
  ['5', 'Pedro Angelo', 'Bruna Travisani', 10, 0, 'SCHEDULED', 'PENDING'],
  ['6', 'Margarida Menegardo Angelo', 'Bruna Travisani', 11, 30, 'SCHEDULED', 'CONFIRMED'],
  ['7', 'Naelson Afonso de Oliveira Melo', 'Marcelo Louzada', 13, 30, 'SCHEDULED', 'PENDING'],
  ['8', 'Roberto Martins Mozer', 'Marcelo Louzada', 15, 0, 'SCHEDULED', 'CONFIRMED'],
  ['9', 'Luyza Andrade Mariano', 'Bianca Cordeiro', 16, 0, 'CANCELLED', 'DECLINED'],
  ['10', 'Nilcimar Koppe', 'Bianca Cordeiro', 16, 30, 'SCHEDULED', 'PENDING']
].map(([id, patientName, dentistName, hour, minute, status, confirmationStatus]) => ({
  id,
  patientName,
  dentistId: `dentist-${dentistName}`,
  dentistName,
  status,
  confirmationStatus,
  ...at(hour, minute, 30)
}))

const metrics = {
  patientCount: 148,
  appointmentsToday: appointments.length,
  appointmentsNextSevenDays: 21,
  pendingConfirmations: 14,
  unassignedAppointments: 2,
  completedThisMonth: 15,
  newPatientsThisMonth: 28,
  canViewFinancial: true,
  billedThisMonth: 48750,
  revenueThisMonth: 45120,
  expensesThisMonth: 12340,
  netThisMonth: 32780,
  invoicesStatus: { pending: 8, partial: 3, paid: 15, cancelled: 2 },
  monthlyPatients: [
    { label: 'mar./2026', count: 31 },
    { label: 'abr./2026', count: 46 },
    { label: 'mai./2026', count: 58 },
    { label: 'jun./2026', count: 92 },
    { label: 'jul./2026', count: 100 },
    { label: 'ago./2026', count: 148 }
  ],
  todayAppointments: appointments
}

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
  res.end(JSON.stringify(body))
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  if (req.url === '/api/public/login' && req.method === 'POST') {
    return send(res, 200, {
      accessToken: 'visual-test-token',
      refreshToken: 'visual-test-refresh',
      tenant: 'visual-test',
      user: { id: 'support-1', email: 'support@visual.test', name: 'Eduarda Menegardo', role: 'USER' }
    })
  }
  if (req.url === '/api/dashboard/metrics') return send(res, 200, metrics)
  if (req.url?.startsWith('/api/appointments/') && req.method === 'PUT') return send(res, 200, {})
  if (req.url === '/api/health') return send(res, 200, { ok: true })
  return send(res, 200, [])
}).listen(3000, '127.0.0.1')
