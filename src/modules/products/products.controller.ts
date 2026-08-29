import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { ProductsService } from './products.service.js'
import { CreateProductDto } from './dto/create-product.dto.js'
import { UpdateProductDto } from './dto/update-product.dto.js'

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

  /** Seller: kendi ürünlerini listele — auth guard FAZ 3.5'te eklenecek */
  @Get('seller/products')
  @ApiOperation({ summary: "List seller's own products" })
  @ApiQuery({ name: 'sellerId', required: true })
  findBySeller(@Query('sellerId') sellerId: string) {
    return this.productsService.findAll(sellerId)
  }

  /** Seller: yeni ürün oluştur — auth guard FAZ 3.5'te eklenecek */
  @Post('seller/products')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiQuery({ name: 'sellerId', required: true })
  create(@Body() dto: CreateProductDto, @Query('sellerId') sellerId: string) {
    return this.productsService.create(dto, sellerId)
  }

  /** Seller: ürün güncelle */
  @Patch('seller/products/:id')
  @ApiOperation({ summary: 'Update a product' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto)
  }

  /** Seller: ürün durumunu değiştir (active/draft) */
  @Patch('seller/products/:id/status')
  @ApiOperation({ summary: 'Toggle product status (active/draft)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'active' | 'draft',
  ) {
    return this.productsService.updateStatus(id, status)
  }
}
