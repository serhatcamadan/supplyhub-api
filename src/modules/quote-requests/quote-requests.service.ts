import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'
import type { CreateQuoteRequestDto } from './dto/create-quote-request.dto.js'
import type { RespondQuoteRequestDto } from './dto/respond-quote-request.dto.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

const QUOTE_INCLUDE = {
  products: {
    include: {
      companies: { select: { id: true, name: true, type: true } },
    },
  },
  companies: { select: { id: true, name: true, type: true } },
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeQuoteRequest(raw: any) {
  return {
    id: raw.id,
    buyer_id: raw.buyer_id,
    product_id: raw.product_id,
    quantity: raw.quantity,
    buyer_note: raw.buyer_note,
    status: raw.status,
    seller_response_price: raw.seller_response_price !== null
      ? Number(raw.seller_response_price)
      : null,
    seller_message: raw.seller_message,
    created_at: raw.created_at,
    buyer: raw.companies,
    product: raw.products,
  }
}

@Injectable()
export class QuoteRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: JwtPayload) {
    const where =
      user.companyType === 'buyer'
        ? { buyer_id: user.companyId }
        : { products: { seller_id: user.companyId } }

    const rows = await this.prisma.quote_requests.findMany({
      where,
      include: QUOTE_INCLUDE,
      orderBy: { created_at: 'desc' },
    })
    return rows.map(normalizeQuoteRequest)
  }

  async findOne(id: string, user: JwtPayload) {
    const raw = await this.prisma.quote_requests.findUnique({
      where: { id },
      include: QUOTE_INCLUDE,
    })
    if (!raw) throw new NotFoundException(`QuoteRequest ${id} not found`)
    const qr = normalizeQuoteRequest(raw)
    this.assertAccess(qr, user)
    return qr
  }

  async create(dto: CreateQuoteRequestDto, user: JwtPayload) {
    const raw = await this.prisma.quote_requests.create({
      data: {
        buyer_id: user.companyId,
        product_id: dto.productId,
        quantity: dto.quantity,
        buyer_note: dto.buyer_note ?? null,
        status: 'pending',
      },
      include: QUOTE_INCLUDE,
    })
    return normalizeQuoteRequest(raw)
  }

  async respond(id: string, dto: RespondQuoteRequestDto, user: JwtPayload) {
    const qr = await this.findOne(id, user)
    if (qr.product.companies.id !== user.companyId) throw new ForbiddenException()
    const raw = await this.prisma.quote_requests.update({
      where: { id },
      data: {
        seller_response_price: dto.seller_response_price,
        seller_message: dto.seller_message ?? null,
        status: 'responded',
      },
      include: QUOTE_INCLUDE,
    })
    return normalizeQuoteRequest(raw)
  }

  async updateStatus(id: string, status: 'accepted' | 'declined', user: JwtPayload) {
    const qr = await this.findOne(id, user)
    if (qr.buyer_id !== user.companyId) throw new ForbiddenException()
    const raw = await this.prisma.quote_requests.update({
      where: { id },
      data: { status },
      include: QUOTE_INCLUDE,
    })
    return normalizeQuoteRequest(raw)
  }

  async sellerDecline(id: string, user: JwtPayload) {
    const qr = await this.findOne(id, user)
    if (qr.product.companies.id !== user.companyId) throw new ForbiddenException()
    const raw = await this.prisma.quote_requests.update({
      where: { id },
      data: { status: 'declined' },
      include: QUOTE_INCLUDE,
    })
    return normalizeQuoteRequest(raw)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private assertAccess(qr: { buyer_id: string; product: { companies: { id: string } } }, user: JwtPayload) {
    const isBuyer = qr.buyer_id === user.companyId
    const isSeller = qr.product.companies.id === user.companyId
    if (!isBuyer && !isSeller) throw new ForbiddenException()
  }
}
