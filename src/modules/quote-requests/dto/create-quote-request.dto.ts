import { IsString, IsInt, IsOptional, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateQuoteRequestDto {
  @ApiProperty()
  @IsString()
  productId!: string

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyer_note?: string
}
