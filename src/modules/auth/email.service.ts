import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)

  constructor(private readonly config: ConfigService) {}

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST')

    if (!host) {
      // Development fallback: kodu console'a yaz
      this.logger.log(`[OTP - DEV] ${email} → ${code}`)
      return
    }

    const transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: (this.config.get<number>('SMTP_PORT') ?? 587) === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    })

    const from = this.config.get<string>('EMAIL_FROM') ?? 'SupplyHub <noreply@supplyhub.com>'

    await transporter.sendMail({
      from,
      to: email,
      subject: 'SupplyHub — E-posta Doğrulama Kodunuz',
      text: [
        `Merhaba,`,
        ``,
        `SupplyHub hesabınızı doğrulamak için aşağıdaki kodu kullanın:`,
        ``,
        `  ${code}`,
        ``,
        `Bu kod 10 dakika geçerlidir. Kodu siz talep etmediyseniz bu e-postayı yok sayabilirsiniz.`,
        ``,
        `— SupplyHub Ekibi`,
      ].join('\n'),
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#022448">E-posta Doğrulama</h2>
          <p>SupplyHub hesabınızı doğrulamak için aşağıdaki kodu girin:</p>
          <div style="background:#f0f4ff;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
            <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#022448">${code}</span>
          </div>
          <p style="color:#666;font-size:14px">Bu kod <strong>10 dakika</strong> geçerlidir.</p>
          <p style="color:#666;font-size:14px">Kodu siz talep etmediyseniz bu e-postayı yok sayabilirsiniz.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#999;font-size:12px">© SupplyHub — B2B Tedarik Platformu</p>
        </div>
      `,
    })
  }
}
