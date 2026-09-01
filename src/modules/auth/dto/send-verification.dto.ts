import { IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SendVerificationDto {
  @ApiProperty({ example: 'yeni@sirket.com' })
  @IsEmail()
  email: string
}
