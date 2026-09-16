import { IsString, IsOptional, IsNumber, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  free_shipping_threshold?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  shipping_fee?: number
}
