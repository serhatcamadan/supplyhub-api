import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'ayse@gunespazar.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'Demo1234!' })
  @IsString()
  @MinLength(6)
  password: string
}
