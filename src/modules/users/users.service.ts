import { Injectable } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../../prisma/prisma.service.js'
import { UpdateUserDto } from './users.dto.js'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateMe(userId: string, dto: UpdateUserDto) {
    const data: Record<string, unknown> = {}
    if (dto.name) data.name = dto.name
    if (dto.password) data.password_hash = await bcrypt.hash(dto.password, 10)

    const user = await this.prisma.users.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, role: true, company_id: true },
    })
    return user
  }
}
