import { IsInt, IsNumber, IsOptional, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PriceTierDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  min_qty: number

  @ApiPropertyOptional({ example: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_qty?: number | null

  @ApiProperty({ example: 49.99 })
  @IsNumber()
  @Min(0)
  price: number
}
