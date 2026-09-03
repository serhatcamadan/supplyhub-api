import { IsEmail, IsString, IsIn, IsOptional, MinLength, Length } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SignupDto {
  @ApiProperty({ example: 'Yeni Şirket A.Ş.' })
  @IsString()
  @MinLength(2)
  companyName: string

  @ApiProperty({ enum: ['seller', 'buyer'] })
  @IsIn(['seller', 'buyer'])
  companyType: 'seller' | 'buyer'

  @ApiPropertyOptional({ example: 'food' })
  @IsOptional()
  @IsString()
  industry?: string

  @ApiProperty({ example: 'yeni@sirket.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'Ad Soyad' })
  @IsString()
  @MinLength(2)
  name: string

  @ApiProperty({ example: 'Guclu123!' })
  @IsString()
  @MinLength(8)
  password: string

  @ApiProperty({ example: '123456', description: '6 haneli e-posta doğrulama kodu' })
  @IsString()
  @Length(6, 6)
  verificationCode: string
}
