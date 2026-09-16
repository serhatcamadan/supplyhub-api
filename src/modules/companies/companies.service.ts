import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'
import { UpdateCompanyDto } from './companies.dto.js'

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const company = await this.prisma.companies.findUnique({ where: { id } })
    if (!company) throw new NotFoundException('Company not found')

    const [totalOrders, deliveredOrders] = await Promise.all([
      this.prisma.orders.count({ where: { seller_id: id } }),
      this.prisma.orders.count({ where: { seller_id: id, status: 'delivered' } }),
    ])

    return {
      ...company,
      free_shipping_threshold: Number(company.free_shipping_threshold),
      shipping_fee: Number(company.shipping_fee),
      delivery_rate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : null,
    }
  }

  async updateMy(companyId: string, dto: UpdateCompanyDto) {
    const data: Record<string, unknown> = {}
    if (dto.name !== undefined)     data.name = dto.name
    if (dto.industry !== undefined) data.industry = dto.industry
    if (dto.free_shipping_threshold !== undefined) data.free_shipping_threshold = dto.free_shipping_threshold
    if (dto.shipping_fee !== undefined)             data.shipping_fee = dto.shipping_fee

    const company = await this.prisma.companies.update({
      where: { id: companyId },
      data,
      select: {
        id: true, name: true, type: true, industry: true,
        free_shipping_threshold: true, shipping_fee: true,
      },
    })
    return {
      ...company,
      free_shipping_threshold: Number(company.free_shipping_threshold),
      shipping_fee: Number(company.shipping_fee),
    }
  }
}
