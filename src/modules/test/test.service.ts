import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service.js'

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

@Injectable()
export class TestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async reset() {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new ForbiddenException('Not available in production')
    }

    // 1. Resolve companies
    const companies = await this.prisma.companies.findMany({ select: { id: true, name: true, type: true } })
    const seller = companies.find((c) => c.type === 'seller')
    const buyers = companies
      .filter((c) => c.type === 'buyer')
      .sort((a, b) => a.name.localeCompare(b.name))

    if (!seller || buyers.length < 2) {
      throw new BadRequestException('Expected 1 seller + 2 buyers — run /api/seed first')
    }

    const cSeller = seller.id
    // buyers sorted alphabetically: Güneş Pazarı (buyer1/ayse), Lezzet Restoranları (buyer2/kemal)
    const cBuyer1 = buyers[0].id
    const cBuyer2 = buyers[1].id

    // 2. Resolve products
    const products = await this.prisma.products.findMany({
      where: { seller_id: cSeller },
      select: { id: true, name: true },
    })
    const p1 = products.find((p) => p.name.includes('Zeytinyağı'))?.id
    const p2 = products.find((p) => p.name.includes('Buğday'))?.id
    const p3 = products.find((p) => p.name.includes('Bal'))?.id
    if (!p1 || !p2 || !p3) {
      throw new BadRequestException(`Products not found: p1=${p1} p2=${p2} p3=${p3}`)
    }

    // 3. Resolve users by email
    const users = await this.prisma.users.findMany({
      where: { email: { in: ['ayse@gunespazar.com', 'kemal@lezzet.com'] } },
      select: { id: true, email: true },
    })
    const uBuyer1Admin = users.find((u) => u.email === 'ayse@gunespazar.com')?.id
    const uBuyer2Admin = users.find((u) => u.email === 'kemal@lezzet.com')?.id
    if (!uBuyer1Admin || !uBuyer2Admin) {
      throw new BadRequestException('Demo user IDs not found — run /api/seed first')
    }

    // 4. Reset quote_requests
    const productIds = products.map((p) => p.id)
    await this.prisma.quote_requests.deleteMany({ where: { product_id: { in: productIds } } })
    await this.prisma.quote_requests.createMany({
      data: [
        { buyer_id: cBuyer1, product_id: p1, quantity: 300, status: 'pending',
          buyer_note: 'Düzenli aylık sipariş için fiyat alıyoruz.', created_at: daysAgo(2) },
        { buyer_id: cBuyer1, product_id: p2, quantity: 600, status: 'responded',
          seller_response_price: 36, seller_message: '600 adet için özel iskonto uygulandı.', created_at: daysAgo(5) },
        { buyer_id: cBuyer2, product_id: p3, quantity: 150, status: 'accepted',
          buyer_note: 'Restoran menüsü için kullanacağız.',
          seller_response_price: 180, seller_message: 'Anlaşma sağlandı, teşekkürler.', created_at: daysAgo(10) },
        { buyer_id: cBuyer2, product_id: p1, quantity: 50, status: 'declined', created_at: daysAgo(15) },
      ],
    })

    // 5. Reset orders + order_items
    const existingOrders = await this.prisma.orders.findMany({
      where: { seller_id: cSeller },
      select: { id: true },
    })
    const orderIds = existingOrders.map((o) => o.id)
    if (orderIds.length) {
      await this.prisma.order_items.deleteMany({ where: { order_id: { in: orderIds } } })
      await this.prisma.orders.deleteMany({ where: { id: { in: orderIds } } })
    }

    const [oDelivered, oShipped, oPending, oConfirmed] = await Promise.all([
      this.prisma.orders.create({
        data: { buyer_id: cBuyer1, seller_id: cSeller, status: 'delivered',
          total: 16500, needs_approval: false, created_by: uBuyer1Admin, created_at: daysAgo(42) },
        select: { id: true },
      }),
      this.prisma.orders.create({
        data: { buyer_id: cBuyer1, seller_id: cSeller, status: 'shipped',
          total: 42000, needs_approval: true, approved_by: uBuyer1Admin, created_by: uBuyer1Admin, created_at: daysAgo(27) },
        select: { id: true },
      }),
      this.prisma.orders.create({
        data: { buyer_id: cBuyer2, seller_id: cSeller, status: 'pending',
          total: 58000, needs_approval: true, created_by: uBuyer2Admin, created_at: daysAgo(11) },
        select: { id: true },
      }),
      this.prisma.orders.create({
        data: { buyer_id: cBuyer1, seller_id: cSeller, status: 'confirmed',
          total: 8900, needs_approval: false, created_by: uBuyer1Admin, created_at: daysAgo(7) },
        select: { id: true },
      }),
    ])

    await this.prisma.order_items.createMany({
      data: [
        { order_id: oDelivered.id, product_id: p1, quantity: 100, unit_price: 165 },
        { order_id: oShipped.id,   product_id: p2, quantity: 500, unit_price: 38  },
        { order_id: oShipped.id,   product_id: p3, quantity: 100, unit_price: 175 },
        { order_id: oPending.id,   product_id: p2, quantity: 500, unit_price: 34  },
        { order_id: oPending.id,   product_id: p1, quantity: 200, unit_price: 145 },
        { order_id: oConfirmed.id, product_id: p3, quantity: 40,  unit_price: 220 },
        { order_id: oConfirmed.id, product_id: p1, quantity: 10,  unit_price: 145 },
      ],
    })

    return { ok: true, message: 'Test data reset to seed state' }
  }
}
