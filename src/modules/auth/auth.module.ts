import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { OtpStore } from './otp.store.js'
import { EmailService } from './email.service.js'
import { JwtStrategy } from './strategies/jwt.strategy.js'
import { JwtAuthGuard } from './guards/jwt-auth.guard.js'

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpStore, EmailService, JwtStrategy, JwtAuthGuard],
  exports: [PassportModule, JwtStrategy, JwtAuthGuard],
})
export class AuthModule {}
