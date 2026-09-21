import { describe, it, expect, vi } from 'vitest'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
import { ProductsService } from './products.service.js'

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    seller_id: 'company-seller',
    name: 'Organik Zeytinyağı',
    status: 'active',
    ...overrides,
  }
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    products: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(makeProduct()),
      update: vi.fn().mockResolvedValue(makeProduct()),
    },
    reviews: {
      groupBy: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } }),
    },
    product_price_history: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as any
}

describe('ProductsService.findAll', () => {
  it('attaches null avg_rating and 0 review_count when a product has no reviews', async () => {
    const prisma = mockPrisma({
      products: { findMany: vi.fn().mockResolvedValue([makeProduct()]) },
    })
    const service = new ProductsService(prisma)

    const result = await service.findAll()

    expect(result[0]).toMatchObject({ avg_rating: null, review_count: 0 })
  })

  it('attaches the real average rating rounded to one decimal', async () => {
    const prisma = mockPrisma({
      products: { findMany: vi.fn().mockResolvedValue([makeProduct()]) },
      reviews: {
        groupBy: vi.fn().mockResolvedValue([
          { product_id: 'prod-1', _avg: { rating: 4.333333 }, _count: { rating: 3 } },
        ]),
      },
    })
    const service = new ProductsService(prisma)

    const result = await service.findAll()

    expect(result[0]).toMatchObject({ avg_rating: 4.3, review_count: 3 })
  })
})

describe('ProductsService.findOne', () => {
  it('throws NotFoundException when the product does not exist', async () => {
    const prisma = mockPrisma()
    const service = new ProductsService(prisma)

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException)
  })

  it('attaches aggregated rating stats to a single product', async () => {
    const prisma = mockPrisma({
      products: { findUnique: vi.fn().mockResolvedValue(makeProduct()) },
      reviews: {
        aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 5 }, _count: { rating: 1 } }),
      },
    })
    const service = new ProductsService(prisma)

    const result = await service.findOne('prod-1')

    expect(result).toMatchObject({ avg_rating: 5, review_count: 1 })
  })
})

describe('ProductsService.create', () => {
  it('records an initial price history snapshot using the lowest-tier price', async () => {
    const prisma = mockPrisma({
      products: { create: vi.fn().mockResolvedValue(makeProduct({ id: 'prod-1' })) },
    })
    const service = new ProductsService(prisma)

    await service.create(
      {
        name: 'Organik Zeytinyağı',
        category: 'Yağlar',
        min_order_qty: 10,
        price_tiers: [
          { min_qty: 50, max_qty: null, price: 150 },
          { min_qty: 10, max_qty: 49, price: 185 },
        ],
      } as any,
      'company-seller',
    )

    expect(prisma.product_price_history.create).toHaveBeenCalledWith({
      data: { product_id: 'prod-1', price: 185 },
    })
  })

  it('does not record a snapshot when price_tiers is empty', async () => {
    const prisma = mockPrisma({
      products: { create: vi.fn().mockResolvedValue(makeProduct({ id: 'prod-1' })) },
    })
    const service = new ProductsService(prisma)

    await service.create(
      { name: 'X', category: 'Y', min_order_qty: 1, price_tiers: [] } as any,
      'company-seller',
    )

    expect(prisma.product_price_history.create).not.toHaveBeenCalled()
  })
})

describe('ProductsService.update', () => {
  it('records a new price history snapshot when the starting price changes', async () => {
    const prisma = mockPrisma({
      products: {
        findUnique: vi.fn().mockResolvedValue(
          makeProduct({ seller_id: 'company-seller', price_tiers: [{ min_qty: 10, max_qty: null, price: 185 }] }),
        ),
        update: vi.fn().mockResolvedValue(makeProduct()),
      },
    })
    const service = new ProductsService(prisma)

    await service.update(
      'prod-1',
      { price_tiers: [{ min_qty: 10, max_qty: null, price: 165 }] } as any,
      'company-seller',
    )

    expect(prisma.product_price_history.create).toHaveBeenCalledWith({
      data: { product_id: 'prod-1', price: 165 },
    })
  })

  it('does not record a snapshot when the starting price is unchanged', async () => {
    const prisma = mockPrisma({
      products: {
        findUnique: vi.fn().mockResolvedValue(
          makeProduct({ seller_id: 'company-seller', price_tiers: [{ min_qty: 10, max_qty: null, price: 185 }] }),
        ),
        update: vi.fn().mockResolvedValue(makeProduct()),
      },
    })
    const service = new ProductsService(prisma)

    await service.update(
      'prod-1',
      { price_tiers: [{ min_qty: 10, max_qty: null, price: 185 }] } as any,
      'company-seller',
    )

    expect(prisma.product_price_history.create).not.toHaveBeenCalled()
  })

  it('does not record a snapshot when price_tiers is not part of the update', async () => {
    const prisma = mockPrisma({
      products: {
        findUnique: vi.fn().mockResolvedValue(
          makeProduct({ seller_id: 'company-seller', price_tiers: [{ min_qty: 10, max_qty: null, price: 185 }] }),
        ),
        update: vi.fn().mockResolvedValue(makeProduct()),
      },
    })
    const service = new ProductsService(prisma)

    await service.update('prod-1', { name: 'Yeni ad' } as any, 'company-seller')

    expect(prisma.product_price_history.create).not.toHaveBeenCalled()
  })
})

describe('ProductsService.getPriceHistory', () => {
  it('returns price points as plain numbers, ordered by recorded_at', async () => {
    const prisma = mockPrisma({
      products: { findUnique: vi.fn().mockResolvedValue(makeProduct({ status: 'active' })) },
      product_price_history: {
        findMany: vi.fn().mockResolvedValue([
          { price: 185, recorded_at: new Date('2026-01-01') },
          { price: 165, recorded_at: new Date('2026-02-01') },
        ]),
      },
    })
    const service = new ProductsService(prisma)

    const result = await service.getPriceHistory('prod-1')

    expect(result).toEqual([
      { price: 185, recorded_at: new Date('2026-01-01') },
      { price: 165, recorded_at: new Date('2026-02-01') },
    ])
    expect(prisma.product_price_history.findMany).toHaveBeenCalledWith({
      where: { product_id: 'prod-1' },
      orderBy: { recorded_at: 'asc' },
    })
  })

  it('throws NotFoundException for a draft product (no owner check available on the public route)', async () => {
    const prisma = mockPrisma({
      products: { findUnique: vi.fn().mockResolvedValue(makeProduct({ status: 'draft' })) },
    })
    const service = new ProductsService(prisma)

    await expect(service.getPriceHistory('prod-1')).rejects.toThrow(NotFoundException)
    expect(prisma.product_price_history.findMany).not.toHaveBeenCalled()
  })
})

describe('ProductsService.findPublic', () => {
  it('returns an active product', async () => {
    const prisma = mockPrisma({
      products: { findUnique: vi.fn().mockResolvedValue(makeProduct({ status: 'active' })) },
    })
    const service = new ProductsService(prisma)

    const result = await service.findPublic('prod-1')
    expect(result.id).toBe('prod-1')
  })

  it('throws NotFoundException for a draft product — draft/unpublished products are not publicly visible', async () => {
    const prisma = mockPrisma({
      products: { findUnique: vi.fn().mockResolvedValue(makeProduct({ status: 'draft' })) },
    })
    const service = new ProductsService(prisma)

    await expect(service.findPublic('prod-1')).rejects.toThrow(NotFoundException)
  })
})

describe('ProductsService.findOwn', () => {
  it("returns the product when the caller is its seller, even if it's a draft", async () => {
    const prisma = mockPrisma({
      products: { findUnique: vi.fn().mockResolvedValue(makeProduct({ status: 'draft', seller_id: 'company-seller' })) },
    })
    const service = new ProductsService(prisma)

    const result = await service.findOwn('prod-1', 'company-seller')
    expect(result.id).toBe('prod-1')
  })

  it("throws ForbiddenException when the caller is not the product's seller", async () => {
    const prisma = mockPrisma({
      products: { findUnique: vi.fn().mockResolvedValue(makeProduct({ status: 'draft', seller_id: 'company-seller' })) },
    })
    const service = new ProductsService(prisma)

    await expect(service.findOwn('prod-1', 'company-other')).rejects.toThrow(ForbiddenException)
  })
})
