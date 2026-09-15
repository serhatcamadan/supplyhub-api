import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'
import type { CreateReviewDto } from './reviews.dto.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReviewDto, user: JwtPayload) {
    const order = await this.prisma.orders.findUnique({
      where: { id: dto.order_id },
      include: { order_items: true },
    })
    if (!order) throw new NotFoundException('Order not found')
    if (order.buyer_id !== user.companyId) throw new ForbiddenException()
    if (order.status !== 'delivered') {
      throw new BadRequestException('Only delivered orders can be reviewed')
    }
    if (!order.order_items.some((item) => item.product_id === dto.product_id)) {
      throw new BadRequestException('Product is not part of this order')
    }

    const existing = await this.prisma.reviews.findFirst({
      where: { order_id: dto.order_id, product_id: dto.product_id },
    })
    if (existing) throw new ConflictException('This product has already been reviewed for this order')

    return this.prisma.reviews.create({
      data: {
        order_id: dto.order_id,
        product_id: dto.product_id,
        buyer_id: user.companyId,
        rating: dto.rating,
      },
    })
  }
}
