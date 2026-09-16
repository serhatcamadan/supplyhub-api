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
        findUnique: vi.fn().mockResolvedValue({
          id: 'seller-1', name: 'FreshFarm', type: 'seller',
          free_shipping_threshold: 10000, shipping_fee: 450,
        }),
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
        findUnique: vi.fn().mockResolvedValue({
          id: 'buyer-1', name: 'Güneş Pazarı', type: 'buyer',
          free_shipping_threshold: 10000, shipping_fee: 450,
        }),
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

  it('returns shipping settings as plain numbers, not Decimal objects', async () => {
    const prisma = mockPrisma({
      companies: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'seller-1', name: 'FreshFarm', type: 'seller',
          free_shipping_threshold: 9500, shipping_fee: 350,
        }),
        update: vi.fn(),
      },
    })
    const service = new CompaniesService(prisma)

    const result = await service.findOne('seller-1')

    expect(result.free_shipping_threshold).toBe(9500)
    expect(result.shipping_fee).toBe(350)
  })
})

describe('CompaniesService.updateMy', () => {
  it('updates the shipping settings when provided', async () => {
    const prisma = mockPrisma({
      companies: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({
          id: 'seller-1', name: 'FreshFarm', type: 'seller', industry: null,
          free_shipping_threshold: 5000, shipping_fee: 250,
        }),
      },
    })
    const service = new CompaniesService(prisma)

    const result = await service.updateMy('seller-1', { free_shipping_threshold: 5000, shipping_fee: 250 })

    expect(prisma.companies.update).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      data: { free_shipping_threshold: 5000, shipping_fee: 250 },
      select: expect.objectContaining({ free_shipping_threshold: true, shipping_fee: true }),
    })
    expect(result.free_shipping_threshold).toBe(5000)
    expect(result.shipping_fee).toBe(250)
  })

  it('does not touch shipping settings when not provided', async () => {
    const prisma = mockPrisma({
      companies: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({
          id: 'seller-1', name: 'New Name', type: 'seller', industry: null,
          free_shipping_threshold: 10000, shipping_fee: 450,
        }),
      },
    })
    const service = new CompaniesService(prisma)

    await service.updateMy('seller-1', { name: 'New Name' })

    expect(prisma.companies.update).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      data: { name: 'New Name' },
      select: expect.any(Object),
    })
  })
})
