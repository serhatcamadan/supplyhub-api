import { describe, it, expect, vi } from 'vitest'
import { SearchLogsService } from './search-logs.service.js'

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    search_logs: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as any
}

describe('SearchLogsService.log', () => {
  it('records a trimmed keyword for the buyer', async () => {
    const prisma = mockPrisma()
    const service = new SearchLogsService(prisma)

    await service.log('  zeytinyağı  ', 'company-buyer')

    expect(prisma.search_logs.create).toHaveBeenCalledWith({
      data: { buyer_id: 'company-buyer', keyword: 'zeytinyağı' },
    })
  })

  it('silently drops keywords shorter than 2 characters', async () => {
    const prisma = mockPrisma()
    const service = new SearchLogsService(prisma)

    await service.log(' a ', 'company-buyer')

    expect(prisma.search_logs.create).not.toHaveBeenCalled()
  })
})

describe('SearchLogsService.getTopKeywords', () => {
  const DAY_MS = 86_400_000

  it('returns an empty list when there are no recent searches', async () => {
    const prisma = mockPrisma()
    const service = new SearchLogsService(prisma)

    expect(await service.getTopKeywords()).toEqual([])
  })

  it('groups case-insensitively, counts per keyword, and ranks by total count', async () => {
    const rows = [
      { keyword: 'zeytinyağı', created_at: new Date(Date.now() - 1 * DAY_MS) },
      { keyword: 'Zeytinyağı', created_at: new Date(Date.now() - 2 * DAY_MS) },
      { keyword: 'bal', created_at: new Date(Date.now() - 1 * DAY_MS) },
    ]
    const prisma = mockPrisma({ search_logs: { findMany: vi.fn().mockResolvedValue(rows) } })
    const service = new SearchLogsService(prisma)

    const result = await service.getTopKeywords()

    expect(result[0]).toMatchObject({ keyword: 'zeytinyağı', count: 2 })
    expect(result[1]).toMatchObject({ keyword: 'bal', count: 1 })
  })

  it('marks a keyword as growing when the recent 7-day count exceeds the prior 7-day count', async () => {
    const rows = [
      // 3 hits within the last 7 days
      { keyword: 'zeytinyağı', created_at: new Date(Date.now() - 1 * DAY_MS) },
      { keyword: 'zeytinyağı', created_at: new Date(Date.now() - 2 * DAY_MS) },
      { keyword: 'zeytinyağı', created_at: new Date(Date.now() - 3 * DAY_MS) },
      // 1 hit in the prior 7-day window
      { keyword: 'zeytinyağı', created_at: new Date(Date.now() - 10 * DAY_MS) },
    ]
    const prisma = mockPrisma({ search_logs: { findMany: vi.fn().mockResolvedValue(rows) } })
    const service = new SearchLogsService(prisma)

    const result = await service.getTopKeywords()

    expect(result[0]).toMatchObject({ keyword: 'zeytinyağı', count: 4, growing: true })
    expect(result[0].dailyCounts).toHaveLength(14)
  })
})
