import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service.js'
import { LoginDto } from './dto/login.dto.js'
import { SignupDto } from './dto/signup.dto.js'
import { JwtAuthGuard } from './guards/jwt-auth.guard.js'
import { CurrentUser } from './decorators/current-user.decorator.js'
import type { JwtPayload } from './strategies/jwt.strategy.js'

const REFRESH_COOKIE = 'refresh_token'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login — returns access token + sets refresh cookie' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto)
    res.cookie(REFRESH_COOKIE, result.refresh_token, COOKIE_OPTS)
    return { access_token: result.access_token, user: result.user }
  }

  @Post('signup')
  @ApiOperation({ summary: 'Register new company + admin user' })
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(dto)
    res.cookie(REFRESH_COOKIE, result.refresh_token, COOKIE_OPTS)
    return { access_token: result.access_token, user: result.user }
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get new access token using refresh cookie' })
  refresh(@Req() req: Request) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
    if (!token) throw new Error('No refresh token')
    return this.authService.refresh(token)
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear refresh token cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: '/' })
    return { ok: true }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user from JWT' })
  me(@CurrentUser() user: JwtPayload) {
    return user
  }
}
