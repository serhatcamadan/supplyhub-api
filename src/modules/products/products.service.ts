import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'
import { CreateProductDto } from './dto/create-product.dto.js'
import { UpdateProductDto } from './dto/update-product.dto.js'
import { getStartingPrice, type PriceTier } from '../../common/pricing.js'
import type { Prisma } from '@prisma/client'

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(sellerId?: string) {
    const where: Prisma.productsWhereInput = sellerId
      ? { seller_id: sellerId }
      : { status: 'active' }
    const products = await this.prisma.products.findMany({
      where,
      include: { companies: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
    })

    if (products.length === 0) return products

    const stats = await this.prisma.reviews.groupBy({
      by: ['product_id'],
      where: { product_id: { in: products.map((p) => p.id) } },
      _avg: { rating: true },
      _count: { rating: true },
    })
    const statsMap = new Map(stats.map((s) => [s.product_id, s]))

    return products.map((product) => {
      const stat = statsMap.get(product.id)
      return {
        ...product,
        avg_rating: stat ? Math.round(Number(stat._avg.rating) * 10) / 10 : null,
        review_count: stat?._count.rating ?? 0,
      }
    })
  }

  private async fetchWithStats(id: string) {
    const product = await this.prisma.products.findUnique({
      where: { id },
      include: { companies: { select: { id: true, name: true } } },
    })
    if (!product) throw new NotFoundException(`Product ${id} not found`)

    const stat = await this.prisma.reviews.aggregate({
      where: { product_id: id },
      _avg: { rating: true },
      _count: { rating: true },
    })

    return {
      ...product,
      avg_rating: stat._count.rating > 0 ? Math.round(Number(stat._avg.rating) * 10) / 10 : null,
      review_count: stat._count.rating,
    }
  }

  /** Internal — no visibility filtering. Only for owner-checked mutation paths (update/remove/updateStatus). */
  async findOne(id: string) {
    return this.fetchWithStats(id)
  }

  /** Public product detail — draft products 404 for everyone except their own seller. */
  async findPublic(id: string) {
    const product = await this.fetchWithStats(id)
    if (product.status !== 'active') throw new NotFoundException(`Product ${id} not found`)
    return product
  }

  /** Seller's own product detail (used by the edit page) — bypasses the active-only filter, ownership-checked. */
  async findOwn(id: string, ownerId: string) {
    const product = await this.fetchWithStats(id)
    if (product.seller_id !== ownerId) throw new ForbiddenException()
    return product
  }

  async create(dto: CreateProductDto, sellerId: string) {
    const product = await this.prisma.products.create({
      data: {
        ...dto,
        seller_id: sellerId,
        description: dto.description ?? '',
        status: dto.status ?? 'draft',
        price_tiers: dto.price_tiers as unknown as Prisma.InputJsonValue,
      },
    })

    const startingPrice = getStartingPrice(dto.price_tiers)
    if (startingPrice !== null) {
      await this.prisma.product_price_history.create({
        data: { product_id: product.id, price: startingPrice },
      })
    }

    return product
  }

  async update(id: string, dto: UpdateProductDto, ownerId: string) {
    const product = await this.findOne(id)
    if (product.seller_id !== ownerId) throw new ForbiddenException()

    const { price_tiers, ...rest } = dto
    const data: Prisma.productsUpdateInput = {
      ...rest,
      ...(price_tiers !== undefined && {
        price_tiers: price_tiers as unknown as Prisma.InputJsonValue,
      }),
    }

    if (price_tiers !== undefined) {
      const oldStartingPrice = getStartingPrice(product.price_tiers as unknown as PriceTier[])
      const newStartingPrice = getStartingPrice(price_tiers)
      if (newStartingPrice !== null && newStartingPrice !== oldStartingPrice) {
        await this.prisma.product_price_history.create({
          data: { product_id: id, price: newStartingPrice },
        })
      }
    }

    return this.prisma.products.update({ where: { id }, data })
  }

  async getPriceHistory(id: string) {
    await this.findPublic(id) // 404s for draft/unpublished products, same as the detail endpoint
    const rows = await this.prisma.product_price_history.findMany({
      where: { product_id: id },
      orderBy: { recorded_at: 'asc' },
    })
    return rows.map((row) => ({ price: Number(row.price), recorded_at: row.recorded_at }))
  }

  async updateStatus(id: string, status: 'active' | 'draft', ownerId: string) {
    const product = await this.findOne(id)
    if (product.seller_id !== ownerId) throw new ForbiddenException()
    return this.prisma.products.update({ where: { id }, data: { status } })
  }

  async remove(id: string, ownerId: string) {
    const product = await this.findOne(id)
    if (product.seller_id !== ownerId) throw new ForbiddenException()
    await this.prisma.products.delete({ where: { id } })
  }
}
