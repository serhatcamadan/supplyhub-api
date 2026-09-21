import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import type { CreateAuctionDto } from './dto/create-auction.dto.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

const AUCTION_INCLUDE = {
  products: {
    include: {
      companies: { select: { id: true, name: true, type: true } },
    },
  },
  companies: { select: { id: true, name: true, type: true } }, // current highest bidder
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAuction(raw: any) {
  return {
    id: raw.id,
    product_id: raw.product_id,
    starting_price: Number(raw.starting_price),
    current_price: Number(raw.current_price),
    current_bidder_id: raw.current_bidder_id,
    bid_count: raw.bid_count,
    status: raw.status,
    ends_at: raw.ends_at,
    created_at: raw.created_at,
    current_bidder: raw.companies ?? null,
    product: raw.products,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBid(raw: any) {
  return {
    id: raw.id,
    auction_id: raw.auction_id,
    bidder_id: raw.bidder_id,
    amount: Number(raw.amount),
    created_at: raw.created_at,
    bidder: raw.companies ?? undefined,
  }
}

@Injectable()
export class AuctionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(status = 'active') {
    const rows = await this.prisma.auctions.findMany({
      where: { status },
      include: AUCTION_INCLUDE,
      orderBy: { ends_at: 'asc' },
    })
    return rows.map(normalizeAuction)
  }

  async findOne(id: string) {
    const raw = await this.prisma.auctions.findUnique({ where: { id }, include: AUCTION_INCLUDE })
    if (!raw) throw new NotFoundException(`Auction ${id} not found`)
    return normalizeAuction(raw)
  }

  async findBids(auctionId: string) {
    const rows = await this.prisma.bids.findMany({
      where: { auction_id: auctionId },
      include: { companies: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
      take: 50,
    })
    return rows.map(normalizeBid)
  }

  async findMine(user: JwtPayload) {
    const rows = await this.prisma.auctions.findMany({
      where: { products: { seller_id: user.companyId } },
      include: AUCTION_INCLUDE,
      orderBy: { created_at: 'desc' },
    })
    return rows.map(normalizeAuction)
  }

  async create(dto: CreateAuctionDto, user: JwtPayload) {
    const product = await this.prisma.products.findUnique({ where: { id: dto.productId } })
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found`)
    if (product.seller_id !== user.companyId) throw new ForbiddenException()
    if (product.status !== 'active') {
      throw new BadRequestException('Only active products can be auctioned')
    }
    if (new Date(dto.ends_at) <= new Date()) {
      throw new BadRequestException('ends_at must be in the future')
    }

    const existing = await this.prisma.auctions.findFirst({
      where: { product_id: dto.productId, status: 'active' },
    })
    if (existing) throw new ConflictException('This product already has an active auction')

    const raw = await this.prisma.auctions.create({
      data: {
        product_id: dto.productId,
        starting_price: dto.starting_price,
        current_price: dto.starting_price,
        status: 'active',
        ends_at: new Date(dto.ends_at),
      },
      include: AUCTION_INCLUDE,
    })
    return normalizeAuction(raw)
  }

  async cancel(id: string, user: JwtPayload) {
    const auction = await this.findOne(id)
    if (auction.product.companies.id !== user.companyId) throw new ForbiddenException()
    if (auction.status !== 'active') throw new BadRequestException('Auction is not active')

    const raw = await this.prisma.auctions.update({ where: { id }, data: { status: 'cancelled' }, include: AUCTION_INCLUDE })
    const updated = normalizeAuction(raw)

    if (auction.current_bidder_id) {
      await this.notifications.create(auction.current_bidder_id, {
        category: 'auction',
        type: 'auction_cancelled',
        data: { auctionId: id, productName: updated.product.name },
        action_href: `/buyer/auctions/${id}`,
      })
    }

    return updated
  }

  /**
   * Concurrency-safe bid placement. The `findUnique` read below is a cheap, fast-fail
   * validation pass (friendly error messages) — it is NOT the correctness boundary.
   * The correctness boundary is the `updateMany` with a `WHERE current_price < amount`
   * guard: Postgres serializes concurrent writes to that row, so exactly one concurrent
   * bid can ever see `count === 1`; every other simultaneous bid sees `count === 0` and
   * is told to retry against the real current price. No app-level lock needed.
   */
  async placeBid(id: string, amount: number, user: JwtPayload) {
    if (user.companyType !== 'buyer') {
      throw new ForbiddenException('Only buyers can place bids')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const raw = await tx.auctions.findUnique({ where: { id }, include: AUCTION_INCLUDE })
      if (!raw) throw new NotFoundException(`Auction ${id} not found`)
      const auction = normalizeAuction(raw)

      if (auction.product.companies.id === user.companyId) {
        throw new ForbiddenException('Sellers cannot bid on their own auction')
      }
      if (auction.status !== 'active' || new Date(auction.ends_at) <= new Date()) {
        throw new BadRequestException('This auction is no longer active')
      }
      if (amount <= auction.current_price) {
        throw new BadRequestException(
          `Bid must exceed the current price of ${auction.current_price}`,
        )
      }

      const updateResult = await tx.auctions.updateMany({
        where: { id, status: 'active', current_price: { lt: amount } },
        data: { current_price: amount, current_bidder_id: user.companyId, bid_count: { increment: 1 } },
      })

      if (updateResult.count === 0) {
        const fresh = await tx.auctions.findUnique({ where: { id }, select: { current_price: true } })
        throw new ConflictException({
          code: 'stale_price',
          message: 'Someone placed a higher bid first',
          currentPrice: fresh ? Number(fresh.current_price) : auction.current_price,
        })
      }

      const bidRaw = await tx.bids.create({
        data: { auction_id: id, bidder_id: user.companyId, amount },
        include: { companies: { select: { id: true, name: true } } },
      })

      // Re-fetch so the returned `current_bidder` (joined company name/type) reflects the
      // bidder who just won this round, not whoever held it before — the in-memory `auction`
      // object above is a pre-bid snapshot and would otherwise be stale (wrong name, or a
      // stale `null` on the very first bid).
      const freshAuction = await tx.auctions.findUnique({ where: { id }, include: AUCTION_INCLUDE })

      return {
        auction: normalizeAuction(freshAuction),
        bid: normalizeBid(bidRaw),
        previousBidderId: auction.current_bidder_id,
      }
    })

    if (result.previousBidderId && result.previousBidderId !== user.companyId) {
      await this.notifications.create(result.previousBidderId, {
        category: 'auction',
        type: 'auction_outbid',
        data: { auctionId: id, productName: result.auction.product.name, newPrice: result.auction.current_price },
        action_href: `/buyer/auctions/${id}`,
      })
    }

    return result
  }

  /** Used only by AuctionsSweepService — finds+ends auctions whose ends_at has passed. */
  async endExpiredAuctions() {
    const expired = await this.prisma.auctions.findMany({
      where: { status: 'active', ends_at: { lte: new Date() } },
      include: AUCTION_INCLUDE,
    })
    if (expired.length === 0) return []

    await this.prisma.auctions.updateMany({
      where: { id: { in: expired.map((a) => a.id) } },
      data: { status: 'ended' },
    })

    return expired.map(normalizeAuction)
  }
}
