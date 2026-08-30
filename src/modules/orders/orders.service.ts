import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'
import type { CreateOrderDto } from './dto/create-order.dto.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'
import type { Prisma } from '@prisma/client'

const SPENDING_LIMIT = 10_000

interface PriceTier {
  min_qty: number
  max_qty: number | null
  price: number
}

function getUnitPrice(quantity: number, tiers: PriceTier[]): number | null {
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty)
  for (const tier of sorted) {
    if (quantity >= tier.min_qty) {
      if (tier.max_qty === null || quantity <= tier.max_qty) {
        return tier.price
      }
    }
  }
  return null
}

const ORDER_INCLUDE = {
  order_items: {
    include: {
      products: { select: { id: true, name: true, image_url: true } },
    },
  },
  companies_orders_buyer_idTocompanies: { select: { id: true, name: true, type: true } },
  companies_orders_seller_idTocompanies: { select: { id: true, name: true, type: true } },
  users_orders_created_byTousers: { select: { id: true, name: true, role: true } },
  users_orders_approved_byTousers: { select: { id: true, name: true } },
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeOrder(raw: any) {
  return {
    id: raw.id,
    buyer_id: raw.buyer_id,
    seller_id: raw.seller_id,
    status: raw.status,
    total: Number(raw.total),
    needs_approval: raw.needs_approval,
    approved_by: raw.approved_by,
    created_by: raw.created_by,
    created_at: raw.created_at,
    buyer: raw.companies_orders_buyer_idTocompanies,
    seller: raw.companies_orders_seller_idTocompanies,
    created_by_user: raw.users_orders_created_byTousers,
    approved_by_user: raw.users_orders_approved_byTousers,
    items: (raw.order_items ?? []).map((item: any) => ({
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      product: item.products,
    })),
  }
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: JwtPayload) {
    const where: Prisma.ordersWhereInput =
      user.companyType === 'buyer'
        ? { buyer_id: user.companyId }
        : { seller_id: user.companyId }

    const rows = await this.prisma.orders.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { created_at: 'desc' },
    })
    return rows.map(normalizeOrder)
  }

  async findOne(id: string, user: JwtPayload) {
    const raw = await this.prisma.orders.findUnique({ where: { id }, include: ORDER_INCLUDE })
    if (!raw) throw new NotFoundException(`Order ${id} not found`)
    const order = normalizeOrder(raw)
    if (order.buyer_id !== user.companyId && order.seller_id !== user.companyId) {
      throw new ForbiddenException()
    }
    return order
  }

  async create(dto: CreateOrderDto, user: JwtPayload) {
    const productIds = dto.items.map((i) => i.productId)
    const products = await this.prisma.products.findMany({ where: { id: { in: productIds } } })
    const productMap = new Map(products.map((p) => [p.id, p]))

    let total = 0
    const itemsData = dto.items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`)

      const tiers = product.price_tiers as unknown as PriceTier[]
      const unitPrice = getUnitPrice(item.quantity, tiers)
      if (unitPrice === null) {
        throw new BadRequestException(
          `Quantity ${item.quantity} is below minimum for product ${product.name}`,
        )
      }
      total += unitPrice * item.quantity
      return { productId: item.productId, quantity: item.quantity, unitPrice }
    })

    const raw = await this.prisma.orders.create({
      data: {
        buyer_id: user.companyId,
        seller_id: dto.sellerId,
        created_by: user.sub,
        total,
        needs_approval: total > SPENDING_LIMIT,
        status: 'pending',
        order_items: {
          create: itemsData.map((i) => ({
            product_id: i.productId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          })),
        },
      },
      include: ORDER_INCLUDE,
    })
    return normalizeOrder(raw)
  }

  async updateStatus(id: string, status: 'confirmed' | 'shipped' | 'delivered', user: JwtPayload) {
    const order = await this.findOne(id, user)
    if (order.seller_id !== user.companyId) throw new ForbiddenException()
    const raw = await this.prisma.orders.update({
      where: { id },
      data: { status },
      include: ORDER_INCLUDE,
    })
    return normalizeOrder(raw)
  }

  async approve(id: string, user: JwtPayload) {
    const order = await this.findOne(id, user)
    if (order.buyer_id !== user.companyId) throw new ForbiddenException()
    if (user.role !== 'admin') throw new ForbiddenException()
    const raw = await this.prisma.orders.update({
      where: { id },
      data: { approved_by: user.sub },
      include: ORDER_INCLUDE,
    })
    return normalizeOrder(raw)
  }

  async reject(id: string, user: JwtPayload) {
    const order = await this.findOne(id, user)
    if (order.buyer_id !== user.companyId) throw new ForbiddenException()
    if (user.role !== 'admin') throw new ForbiddenException()
    return this.prisma.orders.delete({ where: { id } })
  }
}
