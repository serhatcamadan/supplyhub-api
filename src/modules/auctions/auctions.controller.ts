import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AuctionsService } from './auctions.service.js'
import { AuctionsGateway } from './auctions.gateway.js'
import { CreateAuctionDto } from './dto/create-auction.dto.js'
import { PlaceBidDto } from './dto/place-bid.dto.js'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js'
import { RolesGuard } from '../../common/guards/roles.guard.js'
import { Roles } from '../../common/decorators/roles.decorator.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

@ApiTags('auctions')
@Controller()
export class AuctionsController {
  constructor(
    private readonly service: AuctionsService,
    private readonly gateway: AuctionsGateway,
  ) {}

  /** Buyer: canlı/biten ihaleleri listele (public) */
  @Get('auctions')
  @ApiOperation({ summary: 'List auctions (default: active only)' })
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status ?? 'active')
  }

  /** Buyer: ihale detayı (public) */
  @Get('auctions/:id')
  @ApiOperation({ summary: 'Get auction by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  /** Buyer: teklif geçmişi (public) */
  @Get('auctions/:id/bids')
  @ApiOperation({ summary: 'Get bid history for an auction' })
  findBids(@Param('id') id: string) {
    return this.service.findBids(id)
  }

  /** Buyer: teklif ver — REST fallback, canlı akış WebSocket üzerinden */
  @Post('auctions/:id/bids')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place a bid (buyer only)' })
  async placeBid(@Param('id') id: string, @Body() dto: PlaceBidDto, @CurrentUser() user: JwtPayload) {
    const result = await this.service.placeBid(id, dto.amount, user)
    this.gateway.broadcastNewBid(id, result)
    return result.auction
  }

  /** Seller: kendi ihalelerini listele (tüm statüler) */
  @Get('seller/auctions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List seller's own auctions" })
  findMine(@CurrentUser() user: JwtPayload) {
    return this.service.findMine(user)
  }

  /** Seller: yeni ihale oluştur */
  @Post('seller/auctions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an auction from an existing product' })
  create(@Body() dto: CreateAuctionDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user)
  }

  /** Seller: ihaleyi iptal et */
  @Patch('seller/auctions/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an active auction' })
  async cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const result = await this.service.cancel(id, user)
    this.gateway.broadcastAuctionCancelled(id)
    return result
  }
}
