import { describe, it, expect, vi } from 'vitest'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
import { QuoteRequestsService } from './quote-requests.service.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

// ── Helpers ────────────────────────────────────────────────────────────────

const sellerUser: JwtPayload = {
  sub: 'user-seller', email: 'ali@freshfarm.com', name: 'Ali',
  companyId: 'company-seller', role: 'admin', companyType: 'seller',
}
const buyerUser: JwtPayload = {
  sub: 'user-buyer', email: 'ayse@buyer.com', name: 'Ayşe',
  companyId: 'company-buyer', role: 'admin', companyType: 'buyer',
}
const otherUser: JwtPayload = {
  sub: 'user-other', email: 'kemal@other.com', name: 'Kemal',
  companyId: 'company-other', role: 'admin', companyType: 'buyer',
}

function makeRawQR(overrides = {}) {
  return {
    id: 'qr-1',
    buyer_id: 'company-buyer',
    product_id: 'prod-1',
    quantity: 100,
    buyer_note: 'Test',
    status: 'pending',
    seller_response_price: null,
    seller_message: null,
    created_at: new Date().toISOString(),
    companies: { id: 'company-buyer', name: 'Güneş Market', type: 'buyer' },
    products: {
      id: 'prod-1', name: 'Zeytinyağı', category: 'Yağlar',
      min_order_qty: 10, price_tiers: [], status: 'active',
      image_url: null, seller_id: 'company-seller',
      companies: { id: 'company-seller', name: 'FreshFarm', type: 'seller' },
    },
    ...overrides,
  }
}

function mockPrisma() {
  return {
    quote_requests: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
}

// ── findOne erişim kontrolü ────────────────────────────────────────────────

describe('QuoteRequestsService — findOne', () => {
  it('bulunamayan teklif → NotFoundException', async () => {
    const prisma = mockPrisma()
    const service = new QuoteRequestsService(prisma as any)

    await expect(service.findOne('qr-x', buyerUser)).rejects.toThrow(NotFoundException)
  })

  it('ilgili buyer erişebilir', async () => {
    const prisma = mockPrisma()
    prisma.quote_requests.findUnique.mockResolvedValue(makeRawQR())
    const service = new QuoteRequestsService(prisma as any)

    const result = await service.findOne('qr-1', buyerUser)
    expect(result.id).toBe('qr-1')
  })

  it('satıcı erişebilir', async () => {
    const prisma = mockPrisma()
    prisma.quote_requests.findUnique.mockResolvedValue(makeRawQR())
    const service = new QuoteRequestsService(prisma as any)

    const result = await service.findOne('qr-1', sellerUser)
    expect(result.id).toBe('qr-1')
  })

  it('ilgisiz şirket → ForbiddenException', async () => {
    const prisma = mockPrisma()
    prisma.quote_requests.findUnique.mockResolvedValue(makeRawQR())
    const service = new QuoteRequestsService(prisma as any)

    await expect(service.findOne('qr-1', otherUser)).rejects.toThrow(ForbiddenException)
  })
})

// ── respond ────────────────────────────────────────────────────────────────

describe('QuoteRequestsService — respond', () => {
  it('doğru seller yanıt verebilir', async () => {
    const rawQR = makeRawQR()
    const respondedRaw = { ...rawQR, status: 'responded', seller_response_price: 170 }
    const prisma = mockPrisma()
    prisma.quote_requests.findUnique.mockResolvedValue(rawQR)
    prisma.quote_requests.update.mockResolvedValue(respondedRaw)
    const service = new QuoteRequestsService(prisma as any)

    const result = await service.respond('qr-1', { seller_response_price: 170, seller_message: 'Uygun fiyat.' }, sellerUser)
    expect(result.status).toBe('responded')
    expect(result.seller_response_price).toBe(170)
  })

  it('buyer respond → ForbiddenException', async () => {
    const prisma = mockPrisma()
    prisma.quote_requests.findUnique.mockResolvedValue(makeRawQR())
    const service = new QuoteRequestsService(prisma as any)

    await expect(
      service.respond('qr-1', { seller_response_price: 170 }, buyerUser)
    ).rejects.toThrow(ForbiddenException)
  })
})

// ── sellerDecline ─────────────────────────────────────────────────────────

describe('QuoteRequestsService — sellerDecline', () => {
  it('doğru seller reddedebilir → status declined', async () => {
    const rawQR = makeRawQR()
    const declinedRaw = { ...rawQR, status: 'declined' }
    const prisma = mockPrisma()
    prisma.quote_requests.findUnique.mockResolvedValue(rawQR)
    prisma.quote_requests.update.mockResolvedValue(declinedRaw)
    const service = new QuoteRequestsService(prisma as any)

    const result = await service.sellerDecline('qr-1', sellerUser)
    expect(result.status).toBe('declined')
  })

  it('buyer sellerDecline → ForbiddenException', async () => {
    const prisma = mockPrisma()
    prisma.quote_requests.findUnique.mockResolvedValue(makeRawQR())
    const service = new QuoteRequestsService(prisma as any)

    await expect(service.sellerDecline('qr-1', buyerUser)).rejects.toThrow(ForbiddenException)
  })
})

// ── create ────────────────────────────────────────────────────────────────

describe('QuoteRequestsService — create', () => {
  it('buyer teklif talebi oluşturur — buyer_id JWT payloaddan alınır', async () => {
    const rawQR = makeRawQR()
    const prisma = mockPrisma()
    prisma.quote_requests.create.mockResolvedValue(rawQR)
    const service = new QuoteRequestsService(prisma as any)

    await service.create({ productId: 'prod-1', quantity: 100 }, buyerUser)

    const createCall = prisma.quote_requests.create.mock.calls[0][0]
    expect(createCall.data.buyer_id).toBe('company-buyer')
    expect(createCall.data.status).toBe('pending')
  })
})

// ── updateStatus (buyer accept/decline) ──────────────────────────────────

describe('QuoteRequestsService — updateStatus', () => {
  it('buyer kendi teklifini accept edebilir', async () => {
    const rawQR = makeRawQR()
    const acceptedRaw = { ...rawQR, status: 'accepted' }
    const prisma = mockPrisma()
    prisma.quote_requests.findUnique.mockResolvedValue(rawQR)
    prisma.quote_requests.update.mockResolvedValue(acceptedRaw)
    const service = new QuoteRequestsService(prisma as any)

    const result = await service.updateStatus('qr-1', 'accepted', buyerUser)
    expect(result.status).toBe('accepted')
  })

  it('seller updateStatus → ForbiddenException (buyer işlemi)', async () => {
    const prisma = mockPrisma()
    prisma.quote_requests.findUnique.mockResolvedValue(makeRawQR())
    const service = new QuoteRequestsService(prisma as any)

    await expect(service.updateStatus('qr-1', 'accepted', sellerUser)).rejects.toThrow(ForbiddenException)
  })
})
