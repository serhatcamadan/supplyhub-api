import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator'
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

  @ApiPropertyOptional({ example: '14-21' })
  @IsOptional()
  @IsString()
  lead_time?: string

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  valid_until?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  volume_discount?: boolean
}
