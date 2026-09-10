import { Injectable } from '@nestjs/common'
import { randomBytes } from 'crypto'

interface ResetEntry {
  email: string
  expiresAt: number
}

const RESET_TTL_MS = 15 * 60 * 1000

@Injectable()
export class ResetTokenStore {
  private readonly store = new Map<string, ResetEntry>()

  generate(email: string): string {
    const now = Date.now()
    for (const [token, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(token)
    }
    const token = randomBytes(32).toString('hex')
    this.store.set(token, { email: email.toLowerCase(), expiresAt: now + RESET_TTL_MS })
    return token
  }

  consume(token: string): string | null {
    const entry = this.store.get(token)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(token)
      return null
    }
    this.store.delete(token)
    return entry.email
  }
}
