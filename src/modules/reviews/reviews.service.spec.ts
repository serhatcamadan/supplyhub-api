import { describe, it, expect, vi } from 'vitest'
import { NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common'
import { ReviewsService } from './reviews.service.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

const buyerUser: JwtPayload = {
  sub: 'user-buyer', email: 'ayse@buyer.com', name: 'Ayşe',
  companyId: 'company-buyer', role: 'admin', companyType: 'buyer',
}
const otherBuyerUser: JwtPayload = {
  sub: 'user-other', email: 'kemal@lezzet.com', name: 'Kemal',
  companyId: 'company-buyer-2', role: 'admin', companyType: 'buyer',
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    buyer_id: 'company-buyer',
    seller_id: 'company-seller',
    status: 'delivered',
    order_items: [{ id: 'item-1', order_id: 'order-1', product_id: 'prod-1', quantity: 5, unit_price: 100 }],
    ...overrides,
  }
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    orders: {
      findUnique: vi.fn().mockResolvedValue(makeOrder()),
    },
    reviews: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'review-1', ...data })),
    },
    ...overrides,
  } as any
}

describe('ReviewsService.create', () => {
  it('creates a review for a delivered order containing the product', async () => {
    const prisma = mockPrisma()
    const service = new ReviewsService(prisma)

    const result = await service.create({ order_id: 'order-1', product_id: 'prod-1', rating: 5 }, buyerUser)

    expect(result).toMatchObject({ order_id: 'order-1', product_id: 'prod-1', buyer_id: 'company-buyer', rating: 5 })
  })

  it('throws NotFoundException when the order does not exist', async () => {
    const prisma = mockPrisma({ orders: { findUnique: vi.fn().mockResolvedValue(null) } })
    const service = new ReviewsService(prisma)

    await expect(
      service.create({ order_id: 'missing', product_id: 'prod-1', rating: 5 }, buyerUser),
    ).rejects.toThrow(NotFoundException)
  })

  it('throws ForbiddenException when the order does not belong to the requesting buyer', async () => {
    const prisma = mockPrisma()
    const service = new ReviewsService(prisma)

    await expect(
      service.create({ order_id: 'order-1', product_id: 'prod-1', rating: 5 }, otherBuyerUser),
    ).rejects.toThrow(ForbiddenException)
  })

  it('throws BadRequestException when the order is not delivered yet', async () => {
    const prisma = mockPrisma({
      orders: { findUnique: vi.fn().mockResolvedValue(makeOrder({ status: 'shipped' })) },
    })
    const service = new ReviewsService(prisma)

    await expect(
      service.create({ order_id: 'order-1', product_id: 'prod-1', rating: 5 }, buyerUser),
    ).rejects.toThrow(BadRequestException)
  })

  it('throws BadRequestException when the product was not part of the order', async () => {
    const prisma = mockPrisma()
    const service = new ReviewsService(prisma)

    await expect(
      service.create({ order_id: 'order-1', product_id: 'prod-unrelated', rating: 5 }, buyerUser),
    ).rejects.toThrow(BadRequestException)
  })

  it('throws ConflictException when the product was already reviewed for this order', async () => {
    const prisma = mockPrisma({
      reviews: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing-review' }),
        create: vi.fn(),
      },
    })
    const service = new ReviewsService(prisma)

    await expect(
      service.create({ order_id: 'order-1', product_id: 'prod-1', rating: 5 }, buyerUser),
    ).rejects.toThrow(ConflictException)
  })
})
