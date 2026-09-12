import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'
import type { Prisma } from '@prisma/client'

export type NotificationCategory = 'order' | 'quote' | 'system'

export interface CreateNotificationInput {
  category: NotificationCategory
  type: string
  data?: Record<string, unknown>
  action_href?: string
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: JwtPayload) {
    return this.prisma.notifications.findMany({
      where: { company_id: user.companyId },
      orderBy: { created_at: 'desc' },
      take: 50,
    })
  }

  async markRead(id: string, user: JwtPayload) {
    const notification = await this.prisma.notifications.findUnique({ where: { id } })
    if (!notification) throw new NotFoundException(`Notification ${id} not found`)
    if (notification.company_id !== user.companyId) throw new ForbiddenException()
    return this.prisma.notifications.update({ where: { id }, data: { read: true } })
  }

  async markAllRead(user: JwtPayload) {
    await this.prisma.notifications.updateMany({
      where: { company_id: user.companyId, read: false },
      data: { read: true },
    })
    return { success: true }
  }

  /** Internal helper — other modules call this to emit a notification. */
  create(companyId: string, input: CreateNotificationInput) {
    return this.prisma.notifications.create({
      data: {
        company_id: companyId,
        category: input.category,
        type: input.type,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
        action_href: input.action_href,
      },
    })
  }
}
