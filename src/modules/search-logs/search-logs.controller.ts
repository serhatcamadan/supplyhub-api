import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { SearchLogsService } from './search-logs.service.js'
import { CreateSearchLogDto } from './dto/create-search-log.dto.js'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js'
import { RolesGuard } from '../../common/guards/roles.guard.js'
import { Roles } from '../../common/decorators/roles.decorator.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

@ApiTags('search-logs')
@Controller()
export class SearchLogsController {
  constructor(private readonly searchLogsService: SearchLogsService) {}

  /** Buyer: pazar keşfi arama kutusuna yazdığı terimi loglar (debounced, frontend tarafında) */
  @Post('search-logs')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log a buyer product-discovery search keyword' })
  log(@Body() dto: CreateSearchLogDto, @CurrentUser() user: JwtPayload) {
    return this.searchLogsService.log(dto.keyword, user.companyId)
  }

  /** Seller: son 14 günde en çok aranan terimler */
  @Get('seller/discover/buyer-searches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Top buyer search keywords over the last 14 days' })
  getTopKeywords() {
    return this.searchLogsService.getTopKeywords()
  }
}
