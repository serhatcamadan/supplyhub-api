import { IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateSearchLogDto {
  @ApiProperty({ example: 'zeytinyağı' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  keyword: string
}
