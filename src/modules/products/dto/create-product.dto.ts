import {
  IsString,
  IsInt,
  IsNumber,
  IsArray,
  IsOptional,
  IsIn,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PriceTierDto } from './price-tier.dto.js'

export class CreateProductDto {
  @ApiProperty({ example: 'Zeytinyağı 5L' })
  @IsString()
  @MinLength(2)
  name: string

  @ApiPropertyOptional({ example: 'Soğuk sıkım, cam şişe' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ example: 'Yağlar' })
  @IsString()
  category: string

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  min_order_qty: number

  @ApiProperty({ type: [PriceTierDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceTierDto)
  price_tiers: PriceTierDto[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image_url?: string

  @ApiPropertyOptional({ enum: ['active', 'draft'], default: 'draft' })
  @IsOptional()
  @IsIn(['active', 'draft'])
  status?: 'active' | 'draft'

  @ApiPropertyOptional({ example: 100, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock_quantity?: number

  @ApiPropertyOptional({ example: 2.5, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number | null

  @ApiPropertyOptional({ example: 14, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  lead_time_days?: number | null
}
