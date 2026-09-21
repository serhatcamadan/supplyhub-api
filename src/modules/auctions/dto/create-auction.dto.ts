import { IsString, IsNumber, IsDateString, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateAuctionDto {
  @ApiProperty()
  @IsString()
  productId!: string

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  starting_price!: number

  @ApiProperty()
  @IsDateString()
  ends_at!: string
}
