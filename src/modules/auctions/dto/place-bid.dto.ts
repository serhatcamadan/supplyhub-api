import { IsNumber, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class PlaceBidDto {
  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount!: number
}
