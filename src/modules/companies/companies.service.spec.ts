import { describe, it, expect, vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { CompaniesService } from './companies.service.js'

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    companies: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    orders: {
      count: vi.fn().mockResolvedValue(0),
    },
    ...overrides,
  } as any
}

describe('CompaniesService.findOne', () => {
  it('throws NotFoundException when company does not exist', async () => {
    const prisma = mockPrisma()
    const service = new CompaniesService(prisma)

    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException)
  })

  it('computes delivery_rate as delivered/total percentage when the company has orders as seller', async () => {
    const prisma = mockPrisma({
      companies: {
        findUnique: vi.fn().mockResolvedValue({ id: 'seller-1', name: 'FreshFarm', type: 'seller' }),
        update: vi.fn(),
      },
      orders: {
        count: vi.fn()
          .mockResolvedValueOnce(4) // total
          .mockResolvedValueOnce(3), // delivered
      },
    })
    const service = new CompaniesService(prisma)

    const result = await service.findOne('seller-1')

    expect(result.delivery_rate).toBe(75)
    expect(prisma.orders.count).toHaveBeenCalledWith({ where: { seller_id: 'seller-1' } })
    expect(prisma.orders.count).toHaveBeenCalledWith({ where: { seller_id: 'seller-1', status: 'delivered' } })
  })

  it('returns null delivery_rate when the company has no orders as seller (e.g. a buyer company)', async () => {
    const prisma = mockPrisma({
      companies: {
        findUnique: vi.fn().mockResolvedValue({ id: 'buyer-1', name: 'Güneş Pazarı', type: 'buyer' }),
        update: vi.fn(),
      },
      orders: {
        count: vi.fn().mockResolvedValue(0),
      },
    })
    const service = new CompaniesService(prisma)

    const result = await service.findOne('buyer-1')

    expect(result.delivery_rate).toBeNull()
  })
})
