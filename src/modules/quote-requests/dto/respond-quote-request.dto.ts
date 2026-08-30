import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class RespondQuoteRequestDto {
  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  seller_response_price!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seller_message?: string
}
