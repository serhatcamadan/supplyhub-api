import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'
import { CreateProductDto } from './dto/create-product.dto.js'
import { UpdateProductDto } from './dto/update-product.dto.js'
import type { Prisma } from '@prisma/client'

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(sellerId?: string) {
    const where: Prisma.productsWhereInput = sellerId
      ? { seller_id: sellerId }
      : { status: 'active' }
    return this.prisma.products.findMany({
      where,
      include: { companies: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
    })
  }

  async findOne(id: string) {
    const product = await this.prisma.products.findUnique({
      where: { id },
      include: { companies: { select: { id: true, name: true } } },
    })
    if (!product) throw new NotFoundException(`Product ${id} not found`)
    return product
  }

  create(dto: CreateProductDto, sellerId: string) {
    return this.prisma.products.create({
      data: {
        ...dto,
        seller_id: sellerId,
        description: dto.description ?? '',
        status: dto.status ?? 'draft',
        price_tiers: dto.price_tiers as unknown as Prisma.InputJsonValue,
      },
    })
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
    return this.prisma.products.update({ where: { id }, data })
  }

  async updateStatus(id: string, status: 'active' | 'draft', ownerId: string) {
    const product = await this.findOne(id)
    if (product.seller_id !== ownerId) throw new ForbiddenException()
    return this.prisma.products.update({ where: { id }, data: { status } })
  }
}
