import { describe, it, expect, vi } from 'vitest'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { NotificationsService } from './notifications.service.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

const sellerUser: JwtPayload = {
  sub: 'user-seller', email: 'ali@freshfarm.com', name: 'Ali',
  companyId: 'company-seller', role: 'admin', companyType: 'seller',
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    notifications: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  }
}

describe('NotificationsService — findAll', () => {
  it('sadece kullanıcının şirketine ait bildirimleri getirir', async () => {
    const prisma = mockPrisma()
    const service = new NotificationsService(prisma as any)

    await service.findAll(sellerUser)

    expect(prisma.notifications.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { company_id: 'company-seller' } }),
    )
  })
})

describe('NotificationsService — markRead', () => {
  it('bulunamayan bildirim → NotFoundException', async () => {
    const prisma = mockPrisma()
    prisma.notifications.findUnique.mockResolvedValue(null)
    const service = new NotificationsService(prisma as any)

    await expect(service.markRead('n-1', sellerUser)).rejects.toThrow(NotFoundException)
  })

  it('başka şirketin bildirimi → ForbiddenException', async () => {
    const prisma = mockPrisma()
    prisma.notifications.findUnique.mockResolvedValue({ id: 'n-1', company_id: 'company-other' })
    const service = new NotificationsService(prisma as any)

    await expect(service.markRead('n-1', sellerUser)).rejects.toThrow(ForbiddenException)
  })

  it('kendi şirketinin bildirimi → read: true olarak güncellenir', async () => {
    const prisma = mockPrisma()
    prisma.notifications.findUnique.mockResolvedValue({ id: 'n-1', company_id: 'company-seller' })
    prisma.notifications.update.mockResolvedValue({ id: 'n-1', company_id: 'company-seller', read: true })
    const service = new NotificationsService(prisma as any)

    const result = await service.markRead('n-1', sellerUser)

    expect(result.read).toBe(true)
    expect(prisma.notifications.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { read: true },
    })
  })
})

describe('NotificationsService — markAllRead', () => {
  it('sadece kullanıcının şirketindeki okunmamışları günceller', async () => {
    const prisma = mockPrisma()
    const service = new NotificationsService(prisma as any)

    await service.markAllRead(sellerUser)

    expect(prisma.notifications.updateMany).toHaveBeenCalledWith({
      where: { company_id: 'company-seller', read: false },
      data: { read: true },
    })
  })
})

describe('NotificationsService — create', () => {
  it('company_id + category + type + data ile bildirim oluşturur', async () => {
    const prisma = mockPrisma()
    const service = new NotificationsService(prisma as any)

    await service.create('company-seller', {
      category: 'order',
      type: 'order_created',
      data: { orderId: 'order-1' },
      action_href: '/seller/orders',
    })

    expect(prisma.notifications.create).toHaveBeenCalledWith({
      data: {
        company_id: 'company-seller',
        category: 'order',
        type: 'order_created',
        data: { orderId: 'order-1' },
        action_href: '/seller/orders',
      },
    })
  })
})
