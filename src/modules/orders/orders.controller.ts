import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { OrdersService } from './orders.service.js'
import { CreateOrderDto } from './dto/create-order.dto.js'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js'
import { RolesGuard } from '../../common/guards/roles.guard.js'
import { Roles } from '../../common/decorators/roles.decorator.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders (buyer: own, seller: received)' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user)
  }

  @Post()
  @Roles('buyer')
  @ApiOperation({ summary: 'Create order (buyer only, server-side pricing)' })
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user)
  }

  @Patch(':id/status')
  @Roles('seller')
  @ApiOperation({ summary: 'Update order status (seller only: confirmed/shipped/delivered)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'confirmed' | 'shipped' | 'delivered',
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateStatus(id, status, user)
  }

  @Post(':id/approve')
  @Roles('buyer/admin')
  @ApiOperation({ summary: 'Approve order (buyer admin only)' })
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.approve(id, user)
  }

  @Post(':id/reject')
  @Roles('buyer/admin')
  @ApiOperation({ summary: 'Reject and delete order (buyer admin only)' })
  reject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reject(id, user)
  }
}
