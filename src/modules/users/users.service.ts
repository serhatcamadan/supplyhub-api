import { Injectable } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../../prisma/prisma.service.js'
import { UpdateUserDto } from './users.dto.js'

const USER_SELECT = { id: true, email: true, name: true, phone: true, role: true, company_id: true } as const

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string) {
    return this.prisma.users.findUniqueOrThrow({
      where: { id: userId },
      select: { ...USER_SELECT, companies: { select: { name: true, type: true } } },
    })
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const data: Record<string, unknown> = {}
    if (dto.name !== undefined)     data.name = dto.name
    if (dto.phone !== undefined)    data.phone = dto.phone
    if (dto.password)               data.password_hash = await bcrypt.hash(dto.password, 10)

    return this.prisma.users.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    })
  }
}
