import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service.js'

const DAY_MS = 86_400_000
const WINDOW_DAYS = 14
const TOP_N = 8

export interface BuyerSearchResult {
  keyword: string
  count: number
  dailyCounts: number[]
  growing: boolean
}

@Injectable()
export class SearchLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(keyword: string, buyerId: string) {
    const trimmed = keyword.trim()
    if (trimmed.length < 2) return
    await this.prisma.search_logs.create({ data: { buyer_id: buyerId, keyword: trimmed } })
  }

  /** Son 14 gündeki arama terimlerini gruplar; her keyword için günlük sayım dizisi + toplam + büyüme sinyali döner. */
  async getTopKeywords(): Promise<BuyerSearchResult[]> {
    const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS)
    const rows = await this.prisma.search_logs.findMany({
      where: { created_at: { gte: since } },
      select: { keyword: true, created_at: true },
    })
    if (rows.length === 0) return []

    const byKeyword = new Map<string, number[]>()
    const now = Date.now()

    for (const row of rows) {
      const key = row.keyword.trim().toLocaleLowerCase('tr')
      const daysAgo = Math.floor((now - row.created_at.getTime()) / DAY_MS)
      const dayIndex = WINDOW_DAYS - 1 - Math.min(Math.max(daysAgo, 0), WINDOW_DAYS - 1)
      const dailyCounts = byKeyword.get(key) ?? Array.from({ length: WINDOW_DAYS }, () => 0)
      dailyCounts[dayIndex] += 1
      byKeyword.set(key, dailyCounts)
    }

    return [...byKeyword.entries()]
      .map(([keyword, dailyCounts]) => {
        const count = dailyCounts.reduce((a, b) => a + b, 0)
        const recentWeek = dailyCounts.slice(7).reduce((a, b) => a + b, 0)
        const priorWeek = dailyCounts.slice(0, 7).reduce((a, b) => a + b, 0)
        return { keyword, count, dailyCounts, growing: recentWeek > priorWeek }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N)
  }
}
