import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'
import { UpdateCompanyDto } from './companies.dto.js'

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const company = await this.prisma.companies.findUnique({ where: { id } })
    if (!company) throw new NotFoundException('Company not found')
    return company
  }

  async updateMy(companyId: string, dto: UpdateCompanyDto) {
    const data: Record<string, unknown> = {}
    if (dto.name !== undefined)     data.name = dto.name
    if (dto.industry !== undefined) data.industry = dto.industry
    return this.prisma.companies.update({
      where: { id: companyId },
      data,
      select: { id: true, name: true, type: true, industry: true },
    })
  }
}
