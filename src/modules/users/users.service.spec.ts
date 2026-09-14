import { describe, it, expect, vi } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { UsersService } from './users.service.js'

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    users: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'user-1' }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

describe('UsersService — updateMe (şifre değişikliği doğrulaması)', () => {
  it('mevcut şifre doğru → yeni şifre hash\'lenip kaydedilir', async () => {
    const currentHash = await bcrypt.hash('Demo1234!', 12)
    const prisma = mockPrisma()
    prisma.users.findUniqueOrThrow.mockResolvedValue({ password_hash: currentHash })
    const service = new UsersService(prisma as any)

    await service.updateMe('user-1', { currentPassword: 'Demo1234!', password: 'YeniSifre123!' })

    expect(prisma.users.update).toHaveBeenCalledTimes(1)
    const data = prisma.users.update.mock.calls[0][0].data
    expect(data.password_hash).toBeDefined()
    expect(data.password_hash).not.toBe(currentHash)
  })

  it('mevcut şifre yanlış → UnauthorizedException, şifre değişmez', async () => {
    const currentHash = await bcrypt.hash('Demo1234!', 12)
    const prisma = mockPrisma()
    prisma.users.findUniqueOrThrow.mockResolvedValue({ password_hash: currentHash })
    const service = new UsersService(prisma as any)

    await expect(
      service.updateMe('user-1', { currentPassword: 'YanlisSifre', password: 'YeniSifre123!' })
    ).rejects.toThrow(UnauthorizedException)

    expect(prisma.users.update).not.toHaveBeenCalled()
  })

  it('mevcut şifre hiç girilmeden yeni şifre denenirse → UnauthorizedException', async () => {
    const currentHash = await bcrypt.hash('Demo1234!', 12)
    const prisma = mockPrisma()
    prisma.users.findUniqueOrThrow.mockResolvedValue({ password_hash: currentHash })
    const service = new UsersService(prisma as any)

    await expect(
      service.updateMe('user-1', { password: 'YeniSifre123!' })
    ).rejects.toThrow(UnauthorizedException)

    expect(prisma.users.update).not.toHaveBeenCalled()
  })

  it('şifre değişmeden sadece isim güncellenirse → şifre kontrolü hiç yapılmaz', async () => {
    const prisma = mockPrisma()
    const service = new UsersService(prisma as any)

    await service.updateMe('user-1', { name: 'Yeni İsim' })

    expect(prisma.users.findUniqueOrThrow).not.toHaveBeenCalled()
    expect(prisma.users.update).toHaveBeenCalledTimes(1)
    const data = prisma.users.update.mock.calls[0][0].data
    expect(data.name).toBe('Yeni İsim')
    expect(data.password_hash).toBeUndefined()
  })

  it('password_hash hiç yoksa (legacy view de boş) → UnauthorizedException', async () => {
    const prisma = mockPrisma()
    prisma.users.findUniqueOrThrow.mockResolvedValue({ password_hash: null })
    prisma.$queryRaw.mockResolvedValue([])
    const service = new UsersService(prisma as any)

    await expect(
      service.updateMe('user-1', { currentPassword: 'herhangi-bir-sey', password: 'YeniSifre123!' })
    ).rejects.toThrow(UnauthorizedException)
  })
})
