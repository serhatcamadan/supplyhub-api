import { IsEmail, IsString, IsIn, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SignupDto {
  @ApiProperty({ example: 'Yeni Şirket A.Ş.' })
  @IsString()
  @MinLength(2)
  companyName: string

  @ApiProperty({ enum: ['seller', 'buyer'] })
  @IsIn(['seller', 'buyer'])
  companyType: 'seller' | 'buyer'

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
}
