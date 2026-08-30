import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { QuoteRequestsService } from './quote-requests.service.js'
import { CreateQuoteRequestDto } from './dto/create-quote-request.dto.js'
import { RespondQuoteRequestDto } from './dto/respond-quote-request.dto.js'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js'
import { RolesGuard } from '../../common/guards/roles.guard.js'
import { Roles } from '../../common/decorators/roles.decorator.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

@ApiTags('quote-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quote-requests')
export class QuoteRequestsController {
  constructor(private readonly service: QuoteRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List quote requests (buyer: own, seller: received)' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quote request detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user)
  }

  @Post()
  @Roles('buyer')
  @ApiOperation({ summary: 'Create quote request (buyer only)' })
  create(@Body() dto: CreateQuoteRequestDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user)
  }

  @Patch(':id/respond')
  @Roles('seller')
  @ApiOperation({ summary: 'Seller responds to quote request' })
  respond(
    @Param('id') id: string,
    @Body() dto: RespondQuoteRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.respond(id, dto, user)
  }

  @Patch(':id/accept')
  @Roles('buyer')
  @ApiOperation({ summary: 'Buyer accepts quote' })
  accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.updateStatus(id, 'accepted', user)
  }

  @Patch(':id/decline')
  @Roles('buyer')
  @ApiOperation({ summary: 'Buyer declines quote' })
  decline(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.updateStatus(id, 'declined', user)
  }
}
