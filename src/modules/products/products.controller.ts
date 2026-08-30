import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ProductsService } from './products.service.js'
import { CreateProductDto } from './dto/create-product.dto.js'
import { UpdateProductDto } from './dto/update-product.dto.js'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js'
import { RolesGuard } from '../../common/guards/roles.guard.js'
import { Roles } from '../../common/decorators/roles.decorator.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

@ApiTags('products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** Buyer: aktif ürünleri listele (public) */
  @Get('products')
  @ApiOperation({ summary: 'List active products (buyer discover)' })
  findAll() {
    return this.productsService.findAll()
  }

  /** Buyer: ürün detay (public) */
  @Get('products/:id')
  @ApiOperation({ summary: 'Get product by id' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id)
  }

  /** Seller: kendi ürünlerini listele */
  @Get('seller/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List seller's own products" })
  findBySeller(@CurrentUser() user: JwtPayload) {
    return this.productsService.findAll(user.companyId)
  }

  /** Seller: yeni ürün oluştur */
  @Post('seller/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product' })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: JwtPayload) {
    return this.productsService.create(dto, user.companyId)
  }

  /** Seller: ürün güncelle */
  @Patch('seller/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productsService.update(id, dto, user.companyId)
  }

  /** Seller: ürün durumunu değiştir (active/draft) */
  @Patch('seller/products/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle product status (active/draft)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'active' | 'draft',
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productsService.updateStatus(id, status, user.companyId)
  }
}
