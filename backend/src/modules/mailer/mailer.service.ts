import { Injectable } from '@nestjs/common'
import nodemailer = require('nodemailer')

@Injectable()
export class MailerService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  })

  async send(to: string, subject: string, html: string) {
    if (!process.env.SMTP_HOST) return
    await this.transporter.sendMail({ from: process.env.SMTP_FROM || 'no-reply@meudominio.com', to, subject, html })
  }
}
