import { Injectable } from '@nestjs/common'
import { PrismaService } from './prisma/prisma.service.js'

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!'
  }

  async checkDb(): Promise<boolean> {
    await this.prisma.companies.count()
    return true
  }
}
