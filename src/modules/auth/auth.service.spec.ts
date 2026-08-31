import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnauthorizedException, ConflictException } from '@nestjs/common'
import { AuthService } from './auth.service.js'

// ── Mock helpers ───────────────────────────────────────────────────────────

const HASHED = '$2b$12$hashed.password.placeholder' // bcrypt hash placeholder

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    users: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    companies: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn().mockImplementation((cb: any) => cb({
      companies: { create: vi.fn().mockResolvedValue({ id: 'comp-new', name: 'Test Co', type: 'buyer' }) },
      users: { create: vi.fn().mockResolvedValue({ id: 'user-new', email: 'new@test.com', name: 'Test', role: 'admin', password_hash: HASHED }) },
    })),
    ...overrides,
  }
}

function mockJwt() {
  return {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
    verify: vi.fn().mockReturnValue({
      sub: 'user-1', email: 'test@test.com', name: 'Test',
      companyId: 'comp-1', role: 'admin', companyType: 'buyer',
    }),
  }
}

function mockConfig(values: Record<string, string> = {}) {
  return {
    get: vi.fn((key: string) => values[key] ?? 'test-secret'),
  }
}

// ── login ──────────────────────────────────────────────────────────────────

describe('AuthService — login', () => {
  it('kullanıcı bulunamadı → UnauthorizedException', async () => {
    const prisma = mockPrisma()
    prisma.users.findFirst.mockResolvedValue(null)
    const service = new AuthService(prisma as any, mockJwt() as any, mockConfig() as any)

    await expect(service.login({ email: 'ghost@test.com', password: '123' }))
      .rejects.toThrow(UnauthorizedException)
  })

  it('yanlış şifre → UnauthorizedException', async () => {
    // bcrypt gerçek bir hash beklediğinden, geçersiz hash kullan
    const prisma = mockPrisma()
    prisma.users.findFirst.mockResolvedValue({
      id: 'user-1', email: 'ali@test.com', name: 'Ali', role: 'admin',
      company_id: 'comp-1', password_hash: 'invalid-hash',
      companies: { type: 'seller' },
    })
    const service = new AuthService(prisma as any, mockJwt() as any, mockConfig() as any)

    await expect(service.login({ email: 'ali@test.com', password: 'WrongPassword' }))
      .rejects.toThrow(UnauthorizedException)
  })

  it('bcrypt hash yoksa auth_users_view çeker ve kaydet', async () => {
    const prisma = mockPrisma()
    // password_hash null → geçiş dönemi yolu
    prisma.users.findFirst.mockResolvedValue({
      id: 'user-1', email: 'ali@test.com', name: 'Ali', role: 'admin',
      company_id: 'comp-1', password_hash: null,
      companies: { type: 'seller' },
    })
    // auth_users_view boş → kimlik bilgisi yok
    prisma.$queryRaw.mockResolvedValue([])
    const service = new AuthService(prisma as any, mockJwt() as any, mockConfig() as any)

    await expect(service.login({ email: 'ali@test.com', password: 'anything' }))
      .rejects.toThrow(UnauthorizedException)
  })

  it('geçerli şifre → access_token + refresh_token döner', async () => {
    const bcrypt = await import('bcrypt')
    const hash = await bcrypt.hash('Demo1234!', 12)

    const prisma = mockPrisma()
    prisma.users.findFirst.mockResolvedValue({
      id: 'user-1', email: 'ali@test.com', name: 'Ali', role: 'admin',
      company_id: 'comp-1', password_hash: hash,
      companies: { type: 'seller' },
    })
    const service = new AuthService(prisma as any, mockJwt() as any, mockConfig() as any)
    const result = await service.login({ email: 'ali@test.com', password: 'Demo1234!' })

    expect(result).toHaveProperty('access_token')
    expect(result).toHaveProperty('refresh_token')
    expect(result.user.email).toBe('ali@test.com')
  })
})

// ── signup ─────────────────────────────────────────────────────────────────

describe('AuthService — signup', () => {
  it('mevcut email → ConflictException', async () => {
    const prisma = mockPrisma()
    prisma.users.findFirst.mockResolvedValue({ id: 'existing' })
    const service = new AuthService(prisma as any, mockJwt() as any, mockConfig() as any)

    await expect(service.signup({
      email: 'taken@test.com', password: 'Pass1234!', name: 'Test',
      companyName: 'Co', companyType: 'buyer',
    })).rejects.toThrow(ConflictException)
  })

  it('yeni kullanıcı → access_token + refresh_token döner', async () => {
    const prisma = mockPrisma()
    prisma.users.findFirst.mockResolvedValue(null)
    const service = new AuthService(prisma as any, mockJwt() as any, mockConfig() as any)

    const result = await service.signup({
      email: 'new@test.com', password: 'Pass1234!', name: 'New User',
      companyName: 'New Co', companyType: 'buyer',
    })

    expect(result).toHaveProperty('access_token')
    expect(result).toHaveProperty('refresh_token')
    expect(result.user.role).toBe('admin')
  })
})

// ── refresh ────────────────────────────────────────────────────────────────

describe('AuthService — refresh', () => {
  it('geçersiz token → UnauthorizedException', async () => {
    const jwt = mockJwt()
    jwt.verify.mockImplementation(() => { throw new Error('invalid') })
    const service = new AuthService(mockPrisma() as any, jwt as any, mockConfig() as any)

    expect(() => service.refresh('bad.token')).toThrow(UnauthorizedException)
  })

  it('geçerli token → yeni access_token', () => {
    const service = new AuthService(mockPrisma() as any, mockJwt() as any, mockConfig() as any)
    const result = service.refresh('valid.refresh.token')
    expect(result).toHaveProperty('access_token')
  })
})
