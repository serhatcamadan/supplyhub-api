import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'
import { getStartingPrice, type PriceTier } from '../../common/pricing.js'

const DAY_MS = 86_400_000

export interface TrendResult {
  category: string
  growth: number
  demandPct: number
  buyerCount: number
}

export interface PriceIndexResult {
  product: string
  category: string
  myPrice: number
  marketPrice: number
}

export interface RecommendationResult {
  category: string
  buyerCount: number
}

@Injectable()
export class DiscoverService {
  constructor(private readonly prisma: PrismaService) {}

  /** Seller'ın aktif ürünleri vs. aynı kategoride diğer aktif ürünlerin ortalama başlangıç fiyatı. */
  async getPriceIndex(companyId: string): Promise<PriceIndexResult[]> {
    const mine = await this.prisma.products.findMany({
      where: { seller_id: companyId, status: 'active' },
      select: { name: true, category: true, price_tiers: true },
    })
    if (mine.length === 0) return []

    const categories = [...new Set(mine.map((p) => p.category))]
    const others = await this.prisma.products.findMany({
      where: { category: { in: categories }, status: 'active', seller_id: { not: companyId } },
      select: { category: true, price_tiers: true },
    })

    const marketAvgByCategory = new Map<string, number>()
    for (const category of categories) {
      const prices = others
        .filter((p) => p.category === category)
        .map((p) => getStartingPrice(p.price_tiers as unknown as PriceTier[]))
        .filter((p): p is number => p !== null)
      if (prices.length > 0) {
        marketAvgByCategory.set(category, prices.reduce((a, b) => a + b, 0) / prices.length)
      }
    }

    return mine
      .map((p) => ({
        product: p.name,
        category: p.category,
        myPrice: getStartingPrice(p.price_tiers as unknown as PriceTier[]),
        marketPrice: marketAvgByCategory.get(p.category) ?? null,
      }))
      .filter((c): c is PriceIndexResult => c.myPrice !== null && c.marketPrice !== null)
  }

  /** Seller'ın kendi sipariş geçmişinde kategori bazlı gelir büyümesi (son 30 gün vs önceki 30 gün). */
  async getTrends(companyId: string): Promise<TrendResult[]> {
    const since = new Date(Date.now() - 60 * DAY_MS)
    const midpoint = new Date(Date.now() - 30 * DAY_MS)

    const items = await this.prisma.order_items.findMany({
      where: { orders: { seller_id: companyId, created_at: { gte: since } } },
      select: {
        quantity: true,
        unit_price: true,
        orders: { select: { created_at: true, buyer_id: true } },
        products: { select: { category: true } },
      },
    })

    type Bucket = { revenue: number; buyers: Set<string> }
    const current = new Map<string, Bucket>()
    const prior = new Map<string, Bucket>()

    for (const item of items) {
      const category = item.products.category
      const revenue = Number(item.unit_price) * item.quantity
      const bucketMap = item.orders.created_at >= midpoint ? current : prior
      const bucket = bucketMap.get(category) ?? { revenue: 0, buyers: new Set<string>() }
      bucket.revenue += revenue
      bucket.buyers.add(item.orders.buyer_id)
      bucketMap.set(category, bucket)
    }

    // Sadece önceki dönemde gerçek bir baz oluşan kategoriler döner — sıfıra bölme veya uydurma "yeni" büyüme yok.
    const qualifying = [...current.entries()].filter(([category]) => {
      const priorBucket = prior.get(category)
      return priorBucket !== undefined && priorBucket.revenue > 0
    })
    if (qualifying.length === 0) return []

    const maxRevenue = Math.max(...qualifying.map(([, bucket]) => bucket.revenue))

    return qualifying
      .map(([category, bucket]) => {
        const priorRevenue = prior.get(category)!.revenue
        const growth = Math.round(((bucket.revenue - priorRevenue) / priorRevenue) * 100)
        const demandPct = maxRevenue > 0 ? Math.round((bucket.revenue / maxRevenue) * 100) : 0
        return { category, growth, demandPct, buyerCount: bucket.buyers.size }
      })
      .sort((a, b) => b.demandPct - a.demandPct)
  }

  /** Platform genelinde sipariş hacmi olan ama seller'ın aktif ürün satmadığı kategoriler (top 3). */
  async getRecommendations(companyId: string): Promise<RecommendationResult[]> {
    const myProducts = await this.prisma.products.findMany({
      where: { seller_id: companyId, status: 'active' },
      select: { category: true },
      distinct: ['category'],
    })
    const myCategories = new Set(myProducts.map((p) => p.category))

    const items = await this.prisma.order_items.findMany({
      select: {
        orders: { select: { buyer_id: true } },
        products: { select: { category: true } },
      },
    })

    const buyersByCategory = new Map<string, Set<string>>()
    for (const item of items) {
      const category = item.products.category
      if (myCategories.has(category)) continue
      const buyers = buyersByCategory.get(category) ?? new Set<string>()
      buyers.add(item.orders.buyer_id)
      buyersByCategory.set(category, buyers)
    }

    return [...buyersByCategory.entries()]
      .map(([category, buyers]) => ({ category, buyerCount: buyers.size }))
      .sort((a, b) => b.buyerCount - a.buyerCount)
      .slice(0, 3)
  }
}
