import { describe, it, expect, vi } from 'vitest'
import { NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common'
import { AuctionsService } from './auctions.service.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

// ── Helpers ────────────────────────────────────────────────────────────────

const sellerUser: JwtPayload = {
  sub: 'user-seller', email: 'ali@freshfarm.com', name: 'Ali',
  companyId: 'company-seller', role: 'admin', companyType: 'seller',
}
const buyerA: JwtPayload = {
  sub: 'user-buyer-a', email: 'ayse@buyer.com', name: 'Ayşe',
  companyId: 'company-buyer-a', role: 'admin', companyType: 'buyer',
}
const buyerB: JwtPayload = {
  sub: 'user-buyer-b', email: 'kemal@buyer.com', name: 'Kemal',
  companyId: 'company-buyer-b', role: 'admin', companyType: 'buyer',
}

function mockNotifications() {
  return { create: vi.fn().mockResolvedValue(undefined) }
}

function makeProduct(overrides = {}) {
  return {
    id: 'prod-1', name: 'Zeytinyağı', status: 'active', seller_id: 'company-seller',
    companies: { id: 'company-seller', name: 'FreshFarm', type: 'seller' },
    ...overrides,
  }
}

function makeRawAuction(overrides = {}) {
  return {
    id: 'auction-1',
    product_id: 'prod-1',
    starting_price: 100,
    current_price: 100,
    current_bidder_id: null,
    bid_count: 0,
    status: 'active',
    ends_at: new Date(Date.now() + 60_000).toISOString(),
    created_at: new Date().toISOString(),
    companies: null, // current bidder
    products: makeProduct(),
    ...overrides,
  }
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const prisma: any = {
    auctions: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    bids: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    products: {
      findUnique: vi.fn().mockResolvedValue(makeProduct()),
    },
    ...overrides,
  }
  prisma.$transaction = vi.fn().mockImplementation((cb: any) => cb(prisma))
  return prisma
}

// ── create() — ownership + validation ───────────────────────────────────────

describe('AuctionsService.create', () => {
  it('başka satıcının ürünü için oluşturulamaz → ForbiddenException', async () => {
    const prisma = mockPrisma({ products: { findUnique: vi.fn().mockResolvedValue(makeProduct({ seller_id: 'company-other' })) } })
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(
      service.create({ productId: 'prod-1', starting_price: 100, ends_at: new Date(Date.now() + 60_000).toISOString() }, sellerUser),
    ).rejects.toThrow(ForbiddenException)
  })

  it('draft üründen ihale açılamaz → BadRequestException', async () => {
    const prisma = mockPrisma({ products: { findUnique: vi.fn().mockResolvedValue(makeProduct({ status: 'draft' })) } })
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(
      service.create({ productId: 'prod-1', starting_price: 100, ends_at: new Date(Date.now() + 60_000).toISOString() }, sellerUser),
    ).rejects.toThrow(BadRequestException)
  })

  it('geçmiş bir ends_at ile oluşturulamaz → BadRequestException', async () => {
    const prisma = mockPrisma()
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(
      service.create({ productId: 'prod-1', starting_price: 100, ends_at: new Date(Date.now() - 60_000).toISOString() }, sellerUser),
    ).rejects.toThrow(BadRequestException)
  })

  it('ürünün zaten aktif bir ihalesi varsa → ConflictException', async () => {
    const prisma = mockPrisma({ auctions: { findFirst: vi.fn().mockResolvedValue(makeRawAuction()) } })
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(
      service.create({ productId: 'prod-1', starting_price: 100, ends_at: new Date(Date.now() + 60_000).toISOString() }, sellerUser),
    ).rejects.toThrow(ConflictException)
  })
})

// ── cancel() — ownership ────────────────────────────────────────────────────

describe('AuctionsService.cancel', () => {
  it('başka satıcı iptal edemez → ForbiddenException', async () => {
    const prisma = mockPrisma({ auctions: { findUnique: vi.fn().mockResolvedValue(makeRawAuction()) } })
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(service.cancel('auction-1', { ...sellerUser, companyId: 'company-other' })).rejects.toThrow(ForbiddenException)
  })

  it('aktif olmayan ihale tekrar iptal edilemez → BadRequestException', async () => {
    const prisma = mockPrisma({ auctions: { findUnique: vi.fn().mockResolvedValue(makeRawAuction({ status: 'ended' })) } })
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(service.cancel('auction-1', sellerUser)).rejects.toThrow(BadRequestException)
  })

  it('mevcut teklif sahibi varsa iptal bildirimi ona gider', async () => {
    const raw = makeRawAuction({ current_bidder_id: 'company-buyer-a' })
    const prisma = mockPrisma({
      auctions: {
        findUnique: vi.fn().mockResolvedValue(raw),
        update: vi.fn().mockResolvedValue({ ...raw, status: 'cancelled' }),
      },
    })
    const notifications = mockNotifications()
    const service = new AuctionsService(prisma, notifications as any)

    await service.cancel('auction-1', sellerUser)

    expect(notifications.create).toHaveBeenCalledWith('company-buyer-a', expect.objectContaining({ category: 'auction', type: 'auction_cancelled' }))
  })
})

// ── placeBid() — the concurrency-critical path ──────────────────────────────

describe('AuctionsService.placeBid', () => {
  it('seller kendi ihalesine teklif veremez → ForbiddenException', async () => {
    const prisma = mockPrisma({ auctions: { findUnique: vi.fn().mockResolvedValue(makeRawAuction()) } })
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(service.placeBid('auction-1', 150, sellerUser)).rejects.toThrow(ForbiddenException)
  })

  it('seller olmayan (buyer dışı) kullanıcı teklif veremez → ForbiddenException', async () => {
    const prisma = mockPrisma()
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(service.placeBid('auction-1', 150, sellerUser)).rejects.toThrow(ForbiddenException)
  })

  it('süresi dolmuş ihaleye teklif verilemez → BadRequestException', async () => {
    const prisma = mockPrisma({ auctions: { findUnique: vi.fn().mockResolvedValue(makeRawAuction({ ends_at: new Date(Date.now() - 1000).toISOString() })) } })
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(service.placeBid('auction-1', 150, buyerA)).rejects.toThrow(BadRequestException)
  })

  it('güncel fiyatı aşmayan teklif reddedilir, updateMany hiç çağrılmaz', async () => {
    const prisma = mockPrisma({
      auctions: {
        findUnique: vi.fn().mockResolvedValue(makeRawAuction({ current_price: 100 })),
        updateMany: vi.fn(),
      },
    })
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(service.placeBid('auction-1', 100, buyerA)).rejects.toThrow(BadRequestException)
    expect(prisma.auctions.updateMany).not.toHaveBeenCalled()
  })

  it('YARIŞI KAYBEDEN teklif: updateMany count=0 → ConflictException, bid satırı hiç yazılmaz', async () => {
    const raw = makeRawAuction({ current_price: 100 })
    const prisma = mockPrisma({
      auctions: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(raw) // ilk okuma (fast-fail validasyon)
          .mockResolvedValueOnce({ current_price: 130 }), // yarış kaybedilince "fresh" re-read
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    })
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(service.placeBid('auction-1', 110, buyerA)).rejects.toThrow(ConflictException)
    expect(prisma.bids.create).not.toHaveBeenCalled()
  })

  it('YARIŞI KAZANAN teklif: updateMany count=1 → bid satırı doğru alanlarla yazılır, dönen auction taze veriyi yansıtır', async () => {
    const raw = makeRawAuction({ current_price: 100 })
    const freshAfterBid = makeRawAuction({
      current_price: 110,
      current_bidder_id: 'company-buyer-a',
      bid_count: 1,
      companies: { id: 'company-buyer-a', name: 'Ayşe Co', type: 'buyer' },
    })
    const prisma = mockPrisma({
      auctions: {
        findUnique: vi.fn().mockResolvedValueOnce(raw).mockResolvedValueOnce(freshAfterBid),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      bids: { create: vi.fn().mockResolvedValue({ id: 'bid-1', auction_id: 'auction-1', bidder_id: 'company-buyer-a', amount: 110, created_at: new Date().toISOString(), companies: { id: 'company-buyer-a', name: 'Ayşe Co' } }) },
    })
    const service = new AuctionsService(prisma, mockNotifications() as any)

    const result = await service.placeBid('auction-1', 110, buyerA)

    expect(prisma.bids.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { auction_id: 'auction-1', bidder_id: 'company-buyer-a', amount: 110 },
    }))
    expect(result.auction.current_price).toBe(110)
    expect(result.auction.current_bidder_id).toBe('company-buyer-a')
    expect(result.auction.current_bidder).toEqual({ id: 'company-buyer-a', name: 'Ayşe Co', type: 'buyer' })
  })

  it('önceki teklif sahibi outbid bildirimi alır, yeni teklif sahibi almaz', async () => {
    const raw = makeRawAuction({ current_price: 100, current_bidder_id: 'company-buyer-a' })
    const prisma = mockPrisma({
      auctions: { findUnique: vi.fn().mockResolvedValue(raw), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      bids: { create: vi.fn().mockResolvedValue({ id: 'bid-2', auction_id: 'auction-1', bidder_id: 'company-buyer-b', amount: 120, created_at: new Date().toISOString(), companies: null }) },
    })
    const notifications = mockNotifications()
    const service = new AuctionsService(prisma, notifications as any)

    await service.placeBid('auction-1', 120, buyerB)

    expect(notifications.create).toHaveBeenCalledWith('company-buyer-a', expect.objectContaining({ category: 'auction', type: 'auction_outbid' }))
    expect(notifications.create).not.toHaveBeenCalledWith('company-buyer-b', expect.anything())
  })

  it('ilk teklifte (önceki teklif sahibi yok) hiç bildirim gitmez', async () => {
    const raw = makeRawAuction({ current_price: 100, current_bidder_id: null })
    const prisma = mockPrisma({
      auctions: { findUnique: vi.fn().mockResolvedValue(raw), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      bids: { create: vi.fn().mockResolvedValue({ id: 'bid-1', auction_id: 'auction-1', bidder_id: 'company-buyer-a', amount: 110, created_at: new Date().toISOString(), companies: null }) },
    })
    const notifications = mockNotifications()
    const service = new AuctionsService(prisma, notifications as any)

    await service.placeBid('auction-1', 110, buyerA)

    expect(notifications.create).not.toHaveBeenCalled()
  })
})

// ── findOne ──────────────────────────────────────────────────────────────

describe('AuctionsService.findOne', () => {
  it('bulunamayan ihale → NotFoundException', async () => {
    const prisma = mockPrisma()
    const service = new AuctionsService(prisma, mockNotifications() as any)

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException)
  })
})
