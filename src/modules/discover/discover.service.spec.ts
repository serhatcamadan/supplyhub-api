import { describe, it, expect, vi } from 'vitest'
import { DiscoverService } from './discover.service.js'

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    products: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    order_items: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as any
}

describe('DiscoverService.getPriceIndex', () => {
  it('averages the starting price of other active sellers in the same category', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        { name: 'Zeytinyağı', category: 'Yağlar', price_tiers: [{ min_qty: 10, max_qty: null, price: 185 }] },
      ])
      .mockResolvedValueOnce([
        { category: 'Yağlar', price_tiers: [{ min_qty: 10, max_qty: null, price: 165 }] },
        { category: 'Yağlar', price_tiers: [{ min_qty: 10, max_qty: null, price: 175 }] },
      ])
    const prisma = mockPrisma({ products: { findMany } })
    const service = new DiscoverService(prisma)

    const result = await service.getPriceIndex('company-seller')

    expect(result).toEqual([{ product: 'Zeytinyağı', category: 'Yağlar', myPrice: 185, marketPrice: 170 }])
  })

  it('omits categories with no other active sellers instead of fabricating a market price', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        { name: 'Zeytinyağı', category: 'Yağlar', price_tiers: [{ min_qty: 10, max_qty: null, price: 185 }] },
      ])
      .mockResolvedValueOnce([])
    const prisma = mockPrisma({ products: { findMany } })
    const service = new DiscoverService(prisma)

    const result = await service.getPriceIndex('company-seller')

    expect(result).toEqual([])
  })

  it('returns an empty list when the seller has no active products', async () => {
    const prisma = mockPrisma()
    const service = new DiscoverService(prisma)

    const result = await service.getPriceIndex('company-seller')

    expect(result).toEqual([])
  })
})

describe('DiscoverService.getTrends', () => {
  const DAY_MS = 86_400_000

  it('excludes categories with no revenue in the prior window (no divide-by-zero, no fabricated growth)', async () => {
    const items = [
      {
        quantity: 10,
        unit_price: 100,
        orders: { created_at: new Date(Date.now() - 5 * DAY_MS), buyer_id: 'buyer-1' },
        products: { category: 'Yağlar' },
      },
    ]
    const prisma = mockPrisma({ order_items: { findMany: vi.fn().mockResolvedValue(items) } })
    const service = new DiscoverService(prisma)

    const result = await service.getTrends('company-seller')

    expect(result).toEqual([])
  })

  it('computes real growth % and buyer count when both windows have revenue', async () => {
    const items = [
      {
        quantity: 10,
        unit_price: 100,
        orders: { created_at: new Date(Date.now() - 5 * DAY_MS), buyer_id: 'buyer-1' },
        products: { category: 'Yağlar' },
      },
      {
        quantity: 5,
        unit_price: 100,
        orders: { created_at: new Date(Date.now() - 45 * DAY_MS), buyer_id: 'buyer-2' },
        products: { category: 'Yağlar' },
      },
    ]
    const prisma = mockPrisma({ order_items: { findMany: vi.fn().mockResolvedValue(items) } })
    const service = new DiscoverService(prisma)

    const result = await service.getTrends('company-seller')

    expect(result).toEqual([{ category: 'Yağlar', growth: 100, demandPct: 100, buyerCount: 1 }])
  })
})

describe('DiscoverService.getRecommendations', () => {
  it('excludes categories the seller already sells in and ranks by distinct buyer count', async () => {
    const prisma = mockPrisma({
      products: { findMany: vi.fn().mockResolvedValue([{ category: 'Yağlar' }]) },
      order_items: {
        findMany: vi.fn().mockResolvedValue([
          { orders: { buyer_id: 'buyer-1' }, products: { category: 'Yağlar' } },
          { orders: { buyer_id: 'buyer-1' }, products: { category: 'Tahıllar' } },
          { orders: { buyer_id: 'buyer-2' }, products: { category: 'Tahıllar' } },
          { orders: { buyer_id: 'buyer-1' }, products: { category: 'Doğal Ürünler' } },
        ]),
      },
    })
    const service = new DiscoverService(prisma)

    const result = await service.getRecommendations('company-seller')

    expect(result).toEqual([
      { category: 'Tahıllar', buyerCount: 2 },
      { category: 'Doğal Ürünler', buyerCount: 1 },
    ])
  })

  it('returns an empty list when there is no demand outside the seller\'s own categories', async () => {
    const prisma = mockPrisma()
    const service = new DiscoverService(prisma)

    const result = await service.getRecommendations('company-seller')

    expect(result).toEqual([])
  })
})
