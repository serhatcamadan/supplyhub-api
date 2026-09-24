import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { DiscoverService } from './discover.service.js'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js'
import { RolesGuard } from '../../common/guards/roles.guard.js'
import { Roles } from '../../common/decorators/roles.decorator.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

@ApiTags('discover')
@Controller('seller/discover')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('seller')
@ApiBearerAuth()
export class DiscoverController {
  constructor(private readonly discoverService: DiscoverService) {}

  /** Seller'ın aktif ürünleri vs. aynı kategorideki diğer satıcıların ortalama fiyatı */
  @Get('price-index')
  @ApiOperation({ summary: 'Compare seller product prices against category market average' })
  getPriceIndex(@CurrentUser() user: JwtPayload) {
    return this.discoverService.getPriceIndex(user.companyId)
  }

  /** Seller'ın kendi kategori bazlı sipariş gelir trendi (son 30 gün vs önceki 30 gün) */
  @Get('trends')
  @ApiOperation({ summary: "Category-level revenue growth for the seller's own orders" })
  getTrends(@CurrentUser() user: JwtPayload) {
    return this.discoverService.getTrends(user.companyId)
  }

  /** Sipariş hacmi olan ama seller'ın satmadığı kategoriler */
  @Get('recommendations')
  @ApiOperation({ summary: "Category gaps with real order demand the seller isn't selling in" })
  getRecommendations(@CurrentUser() user: JwtPayload) {
    return this.discoverService.getRecommendations(user.companyId)
  }
}
