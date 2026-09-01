import { Injectable } from '@nestjs/common'

interface OtpEntry {
  code: string
  expiresAt: number
  createdAt: number
  attempts: number
}

const OTP_TTL_MS     = 10 * 60 * 1000  // 10 dakika
const RESEND_BLOCK_MS = 60 * 1000       // 60 saniye (frontend cooldown ile eşleşir)
const MAX_ATTEMPTS   = 5

@Injectable()
export class OtpStore {
  private readonly store = new Map<string, OtpEntry>()

  generate(email: string): string {
    const now = Date.now()
    // Süresi dolmuş kayıtları temizle
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
    const code = Math.floor(100_000 + Math.random() * 900_000).toString()
    this.store.set(email.toLowerCase(), {
      code,
      expiresAt: now + OTP_TTL_MS,
      createdAt: now,
      attempts: 0,
    })
    return code
  }

  // true → geçerli ve tüketildi; false → geçersiz/süresi dolmuş
  consume(email: string, code: string): boolean {
    const key = email.toLowerCase()
    const entry = this.store.get(key)
    if (!entry) return false

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return false
    }

    entry.attempts++
    if (entry.attempts > MAX_ATTEMPTS) {
      this.store.delete(key)
      return false
    }

    if (entry.code !== code.trim()) return false

    this.store.delete(key)
    return true
  }

  // 60 saniye içinde tekrar istek atıldıysa true (spam koruması)
  isRateLimited(email: string): boolean {
    const entry = this.store.get(email.toLowerCase())
    if (!entry) return false
    return Date.now() - entry.createdAt < RESEND_BLOCK_MS
  }
}
