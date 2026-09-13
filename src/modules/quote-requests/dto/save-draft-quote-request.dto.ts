import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class SaveDraftQuoteRequestDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  seller_response_price?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seller_message?: string
}
