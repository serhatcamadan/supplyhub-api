import { IsInt, IsString, Max, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateReviewDto {
  @ApiProperty()
  @IsString()
  order_id: string

  @ApiProperty()
  @IsString()
  product_id: string

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number
}
