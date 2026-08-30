import { IsString, IsArray, ValidateNested, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class OrderItemDto {
  @ApiProperty()
  @IsString()
  productId!: string

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number
}

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  sellerId!: string

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[]
}
