import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)

  constructor(private readonly config: ConfigService) {}

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')

    if (!apiKey) {
      // Development fallback: kodu console'a yaz
      this.logger.log(`[OTP - DEV] ${email} → ${code}`)
      return
    }

    const from = this.config.get<string>('EMAIL_FROM') ?? 'SupplyHub <onboarding@resend.dev>'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
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
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const body = await res.text()
      this.logger.error(`[Email] Resend API hatası: ${res.status} ${body}`)
      throw new InternalServerErrorException('E-posta gönderilemedi')
    }
  }

  async sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')

    if (!apiKey) {
      this.logger.log(`[RESET - DEV] ${email} → ${resetLink}`)
      return
    }

    const from = this.config.get<string>('EMAIL_FROM') ?? 'SupplyHub <onboarding@resend.dev>'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'SupplyHub — Şifre Sıfırlama',
        text: [
          `Merhaba,`,
          ``,
          `SupplyHub hesabınızın şifresini sıfırlamak için aşağıdaki bağlantıya tıklayın:`,
          ``,
          `  ${resetLink}`,
          ``,
          `Bu bağlantı 15 dakika geçerlidir. Talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.`,
          ``,
          `— SupplyHub Ekibi`,
        ].join('\n'),
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#022448">Şifre Sıfırlama</h2>
            <p>SupplyHub hesabınızın şifresini sıfırlamak için aşağıdaki butona tıklayın:</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${resetLink}" style="background:#022448;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px">
                Şifremi Sıfırla
              </a>
            </div>
            <p style="color:#666;font-size:14px">Bu bağlantı <strong>15 dakika</strong> geçerlidir.</p>
            <p style="color:#666;font-size:14px">Talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
            <p style="color:#999;font-size:12px">© SupplyHub — B2B Tedarik Platformu</p>
          </div>
        `,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const body = await res.text()
      this.logger.error(`[Email] Resend API hatası: ${res.status} ${body}`)
      throw new InternalServerErrorException('E-posta gönderilemedi')
    }
  }
}
