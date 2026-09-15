import { Controller, Post, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js'
import { RolesGuard } from '../../common/guards/roles.guard.js'
import { Roles } from '../../common/decorators/roles.decorator.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'
import { ReviewsService } from './reviews.service.js'
import { CreateReviewDto } from './reviews.dto.js'

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Roles('buyer')
  @ApiOperation({ summary: 'Rate a product from a delivered order (buyer only)' })
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: JwtPayload) {
    return this.reviewsService.create(dto, user)
  }
}
