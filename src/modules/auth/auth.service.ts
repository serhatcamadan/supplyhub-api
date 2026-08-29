import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service.js'
import type { LoginDto } from './dto/login.dto.js'
import type { SignupDto } from './dto/signup.dto.js'
import type { JwtPayload } from './strategies/jwt.strategy.js'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findFirst({
      where: { email: dto.email },
      include: { companies: true },
    })
    if (!user) throw new UnauthorizedException('Invalid credentials')

    let hash = user.password_hash

    // Geçiş dönemi: hash yoksa auth_users_view'dan çek ve kaydet
    if (!hash) {
      const view = await this.prisma.$queryRaw<{ encrypted_password: string }[]>`
        SELECT encrypted_password FROM auth_users_view WHERE id = ${user.id}::uuid
      `
      if (!view[0]?.encrypted_password) throw new UnauthorizedException('Invalid credentials')
      hash = view[0].encrypted_password
      await this.prisma.users.update({
        where: { id: user.id },
        data: { password_hash: hash },
      })
    }

    const valid = await bcrypt.compare(dto.password, hash)
    if (!valid) throw new UnauthorizedException('Invalid credentials')

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      companyId: user.company_id,
      role: user.role,
      companyType: user.companies.type,
    }

    return {
      access_token: this.signAccess(payload),
      refresh_token: this.signRefresh(payload),
      user: { id: user.id, email: user.email, name: user.name, role: user.role, companyType: user.companies.type },
    }
  }

  async signup(dto: SignupDto) {
    const existing = await this.prisma.users.findFirst({ where: { email: dto.email } })
    if (existing) throw new ConflictException('Email already in use')

    const password_hash = await bcrypt.hash(dto.password, 12)

    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.companies.create({
        data: { name: dto.companyName, type: dto.companyType },
      })
      const user = await tx.users.create({
        data: {
          id: randomUUID(),
          company_id: company.id,
          email: dto.email,
          name: dto.name,
          role: 'admin',
          password_hash,
        },
      })
      return { company, user }
    })

    const payload: JwtPayload = {
      sub: result.user.id,
      email: result.user.email,
      companyId: result.company.id,
      role: result.user.role,
      companyType: result.company.type,
    }

    return {
      access_token: this.signAccess(payload),
      refresh_token: this.signRefresh(payload),
      user: { id: result.user.id, email: result.user.email, name: result.user.name, role: result.user.role, companyType: result.company.type },
    }
  }

  refresh(token: string) {
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      })
      const { iat, exp, ...rest } = payload as JwtPayload & { iat: number; exp: number }
      void iat; void exp
      return { access_token: this.signAccess(rest) }
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  private signAccess(payload: JwtPayload) {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    })
  }

  private signRefresh(payload: JwtPayload) {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    })
  }
}
