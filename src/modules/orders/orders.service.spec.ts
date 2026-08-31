import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { OrdersService } from './orders.service.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

// ── Helpers ────────────────────────────────────────────────────────────────

const sellerUser: JwtPayload = {
  sub: 'user-seller', email: 'ali@freshfarm.com', name: 'Ali',
  companyId: 'company-seller', role: 'admin', companyType: 'seller',
}
const buyerAdmin: JwtPayload = {
  sub: 'user-buyer', email: 'ayse@buyer.com', name: 'Ayşe',
  companyId: 'company-buyer', role: 'admin', companyType: 'buyer',
}
const buyerStaff: JwtPayload = {
  sub: 'user-staff', email: 'fatma@buyer.com', name: 'Fatma',
  companyId: 'company-buyer', role: 'staff', companyType: 'buyer',
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    orders: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    products: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  }
}

function makeProduct(overrides = {}) {
  return {
    id: 'prod-1',
    seller_id: 'company-seller',
    name: 'Organik Zeytinyağı',
    price_tiers: [
      { min_qty: 10, max_qty: 49,   price: 185 },
      { min_qty: 50, max_qty: 199,  price: 165 },
      { min_qty: 200, max_qty: null, price: 145 },
    ],
    ...overrides,
  }
}

function makeOrderRaw(overrides = {}) {
  return {
    id: 'order-1',
    buyer_id: 'company-buyer',
    seller_id: 'company-seller',
    status: 'pending',
    total: 0,
    needs_approval: false,
    approved_by: null,
    created_by: 'user-buyer',
    created_at: new Date().toISOString(),
    companies_orders_buyer_idTocompanies: { id: 'company-buyer', name: 'Güneş Market', type: 'buyer' },
    companies_orders_seller_idTocompanies: { id: 'company-seller', name: 'FreshFarm', type: 'seller' },
    users_orders_created_byTousers: { id: 'user-buyer', name: 'Ayşe', role: 'admin' },
    users_orders_approved_byTousers: null,
    order_items: [],
    ...overrides,
  }
}

// ── getUnitPrice (via create) ──────────────────────────────────────────────

describe('OrdersService — fiyat hesaplama (getUnitPrice)', () => {
  it('tier 1: qty=10 → 185 TRY/adet', async () => {
    const product = makeProduct()
    const prisma = mockPrisma()
    prisma.products.findMany.mockResolvedValue([product])
    const rawOrder = makeOrderRaw({ total: 1850, order_items: [{ id: 'i1', order_id: 'order-1', product_id: 'prod-1', quantity: 10, unit_price: 185, products: { id: 'prod-1', name: 'Organik Zeytinyağı', image_url: null } }] })
    prisma.orders.create.mockResolvedValue(rawOrder)

    const service = new OrdersService(prisma as any)
    const result = await service.create({ sellerId: 'company-seller', items: [{ productId: 'prod-1', quantity: 10 }] }, buyerAdmin)

    expect(result.total).toBe(1850) // 10 × 185
  })

  it('tier 2: qty=50 → 165 TRY/adet', async () => {
    const product = makeProduct()
    const prisma = mockPrisma()
    prisma.products.findMany.mockResolvedValue([product])
    const rawOrder = makeOrderRaw({ total: 8250, order_items: [{ id: 'i1', order_id: 'order-1', product_id: 'prod-1', quantity: 50, unit_price: 165, products: { id: 'prod-1', name: 'Organik Zeytinyağı', image_url: null } }] })
    prisma.orders.create.mockResolvedValue(rawOrder)

    const service = new OrdersService(prisma as any)
    const result = await service.create({ sellerId: 'company-seller', items: [{ productId: 'prod-1', quantity: 50 }] }, buyerAdmin)

    expect(result.total).toBe(8250) // 50 × 165
  })

  it('tier 3: qty=200 → 145 TRY/adet (açık uçlu tier)', async () => {
    const product = makeProduct()
    const prisma = mockPrisma()
    prisma.products.findMany.mockResolvedValue([product])
    const rawOrder = makeOrderRaw({ total: 29000, order_items: [] })
    prisma.orders.create.mockResolvedValue(rawOrder)

    const service = new OrdersService(prisma as any)
    await service.create({ sellerId: 'company-seller', items: [{ productId: 'prod-1', quantity: 200 }] }, buyerAdmin)

    const createCall = prisma.orders.create.mock.calls[0][0]
    expect(createCall.data.order_items.create[0].unit_price).toBe(145)
    expect(createCall.data.total).toBe(29000) // 200 × 145
  })

  it('qty < min_order_qty → BadRequestException', async () => {
    const product = makeProduct() // min_qty ilk tier 10
    const prisma = mockPrisma()
    prisma.products.findMany.mockResolvedValue([product])

    const service = new OrdersService(prisma as any)
    await expect(
      service.create({ sellerId: 'company-seller', items: [{ productId: 'prod-1', quantity: 5 }] }, buyerAdmin)
    ).rejects.toThrow(BadRequestException)
  })

  it('bilinmeyen product_id → NotFoundException', async () => {
    const prisma = mockPrisma()
    prisma.products.findMany.mockResolvedValue([]) // boş

    const service = new OrdersService(prisma as any)
    await expect(
      service.create({ sellerId: 'company-seller', items: [{ productId: 'nonexistent', quantity: 10 }] }, buyerAdmin)
    ).rejects.toThrow(NotFoundException)
  })
})

// ── needs_approval eşiği ───────────────────────────────────────────────────

describe('OrdersService — needs_approval (10.000 TRY eşiği)', () => {
  it('total ≤ 10.000 → needs_approval: false', async () => {
    const product = makeProduct()
    const prisma = mockPrisma()
    prisma.products.findMany.mockResolvedValue([product])
    prisma.orders.create.mockResolvedValue(makeOrderRaw({ needs_approval: false }))

    const service = new OrdersService(prisma as any)
    await service.create({ sellerId: 'company-seller', items: [{ productId: 'prod-1', quantity: 10 }] }, buyerAdmin)

    const createCall = prisma.orders.create.mock.calls[0][0]
    expect(createCall.data.needs_approval).toBe(false) // 10 × 185 = 1.850 ≤ 10.000
  })

  it('total > 10.000 → needs_approval: true', async () => {
    const product = makeProduct()
    const prisma = mockPrisma()
    prisma.products.findMany.mockResolvedValue([product])
    prisma.orders.create.mockResolvedValue(makeOrderRaw({ needs_approval: true }))

    const service = new OrdersService(prisma as any)
    await service.create({ sellerId: 'company-seller', items: [{ productId: 'prod-1', quantity: 200 }] }, buyerAdmin)

    const createCall = prisma.orders.create.mock.calls[0][0]
    expect(createCall.data.needs_approval).toBe(true) // 200 × 145 = 29.000 > 10.000
  })
})

// ── approve / reject erişim kontrolü ─────────────────────────────────────

describe('OrdersService — approve/reject RBAC', () => {
  it('staff kullanıcı approve → ForbiddenException', async () => {
    const rawOrder = makeOrderRaw()
    const prisma = mockPrisma()
    prisma.orders.findUnique.mockResolvedValue(rawOrder)

    const service = new OrdersService(prisma as any)
    await expect(service.approve('order-1', buyerStaff)).rejects.toThrow(ForbiddenException)
  })

  it('başka şirketin siparişini approve → ForbiddenException', async () => {
    const rawOrder = makeOrderRaw({ buyer_id: 'company-other' }) // farklı buyer
    const prisma = mockPrisma()
    prisma.orders.findUnique.mockResolvedValue(rawOrder)

    const service = new OrdersService(prisma as any)
    await expect(service.approve('order-1', buyerAdmin)).rejects.toThrow(ForbiddenException)
  })

  it('seller updateStatus → başarılı', async () => {
    const rawOrder = makeOrderRaw({ status: 'confirmed' })
    const prisma = mockPrisma()
    prisma.orders.findUnique.mockResolvedValue(makeOrderRaw())
    prisma.orders.update.mockResolvedValue(rawOrder)

    const service = new OrdersService(prisma as any)
    const result = await service.updateStatus('order-1', 'confirmed', sellerUser)
    expect(result.status).toBe('confirmed')
  })

  it('buyer updateStatus → ForbiddenException (sadece seller yapabilir)', async () => {
    const prisma = mockPrisma()
    prisma.orders.findUnique.mockResolvedValue(makeOrderRaw())

    const service = new OrdersService(prisma as any)
    await expect(service.updateStatus('order-1', 'confirmed', buyerAdmin)).rejects.toThrow(ForbiddenException)
  })
})

// ── findOne erişim kontrolü ────────────────────────────────────────────────

describe('OrdersService — findOne', () => {
  it('bulunamayan sipariş → NotFoundException', async () => {
    const prisma = mockPrisma()
    prisma.orders.findUnique.mockResolvedValue(null)

    const service = new OrdersService(prisma as any)
    await expect(service.findOne('order-x', buyerAdmin)).rejects.toThrow(NotFoundException)
  })

  it('ilgisiz şirket → ForbiddenException', async () => {
    const prisma = mockPrisma()
    prisma.orders.findUnique.mockResolvedValue(makeOrderRaw({
      buyer_id: 'company-other',
      seller_id: 'company-other-seller',
    }))

    const service = new OrdersService(prisma as any)
    await expect(service.findOne('order-1', buyerAdmin)).rejects.toThrow(ForbiddenException)
  })
})
