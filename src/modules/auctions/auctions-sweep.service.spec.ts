import { describe, it, expect, vi } from 'vitest'
import { AuctionsSweepService } from './auctions-sweep.service.js'

function mockAuctionsService(ended: unknown[] = []) {
  return { endExpiredAuctions: vi.fn().mockResolvedValue(ended) }
}
function mockGateway() {
  return { broadcastAuctionEnded: vi.fn() }
}
function mockNotifications() {
  return { create: vi.fn().mockResolvedValue(undefined) }
}

function makeEndedAuction(overrides = {}) {
  return {
    id: 'auction-1',
    current_bidder_id: null,
    current_price: 150,
    product: { name: 'Zeytinyağı', companies: { id: 'company-seller' } },
    ...overrides,
  }
}

describe('AuctionsSweepService.handleSweep', () => {
  it('kazananı olan ihalede hem kazanana hem satıcıya bildirim gider, broadcast bir kez yapılır', async () => {
    const ended = makeEndedAuction({ current_bidder_id: 'company-buyer-a' })
    const auctions = mockAuctionsService([ended])
    const gateway = mockGateway()
    const notifications = mockNotifications()
    const service = new AuctionsSweepService(auctions as any, gateway as any, notifications as any)

    await service.handleSweep()

    expect(notifications.create).toHaveBeenCalledWith('company-buyer-a', expect.objectContaining({ type: 'auction_won' }))
    expect(notifications.create).toHaveBeenCalledWith('company-seller', expect.objectContaining({ type: 'auction_ended_with_winner' }))
    expect(gateway.broadcastAuctionEnded).toHaveBeenCalledTimes(1)
    expect(gateway.broadcastAuctionEnded).toHaveBeenCalledWith('auction-1', { winnerId: 'company-buyer-a', finalPrice: 150 })
  })

  it('hiç teklif almamış ihalede sadece satıcıya "teklif yok" bildirimi gider', async () => {
    const ended = makeEndedAuction({ current_bidder_id: null })
    const auctions = mockAuctionsService([ended])
    const gateway = mockGateway()
    const notifications = mockNotifications()
    const service = new AuctionsSweepService(auctions as any, gateway as any, notifications as any)

    await service.handleSweep()

    expect(notifications.create).toHaveBeenCalledTimes(1)
    expect(notifications.create).toHaveBeenCalledWith('company-seller', expect.objectContaining({ type: 'auction_ended_no_bids' }))
  })

  it('süresi dolmuş ihale yoksa hiçbir şey yapmaz', async () => {
    const auctions = mockAuctionsService([])
    const gateway = mockGateway()
    const notifications = mockNotifications()
    const service = new AuctionsSweepService(auctions as any, gateway as any, notifications as any)

    await service.handleSweep()

    expect(notifications.create).not.toHaveBeenCalled()
    expect(gateway.broadcastAuctionEnded).not.toHaveBeenCalled()
  })
})
