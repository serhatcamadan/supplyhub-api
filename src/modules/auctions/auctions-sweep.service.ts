import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { AuctionsService } from './auctions.service.js'
import { AuctionsGateway } from './auctions.gateway.js'
import { NotificationsService } from '../notifications/notifications.service.js'

const SWEEP_INTERVAL_MS = 15_000

/**
 * The sole writer of the active → ended transition. A lazy check inside
 * AuctionsService.placeBid() (ends_at <= now()) only ever *rejects* a late bid — it never
 * itself flips an auction's status, so there is exactly one place that ends an auction,
 * determines the winner, and fires the corresponding notifications/broadcast.
 */
@Injectable()
export class AuctionsSweepService {
  private readonly logger = new Logger(AuctionsSweepService.name)

  constructor(
    private readonly auctions: AuctionsService,
    private readonly gateway: AuctionsGateway,
    private readonly notifications: NotificationsService,
  ) {}

  @Interval(SWEEP_INTERVAL_MS)
  async handleSweep() {
    const ended = await this.auctions.endExpiredAuctions()

    for (const auction of ended) {
      const sellerId = auction.product.companies.id

      if (auction.current_bidder_id) {
        await this.notifications.create(auction.current_bidder_id, {
          category: 'auction',
          type: 'auction_won',
          data: { auctionId: auction.id, productName: auction.product.name, finalPrice: auction.current_price },
          action_href: `/buyer/auctions/${auction.id}`,
        })
        await this.notifications.create(sellerId, {
          category: 'auction',
          type: 'auction_ended_with_winner',
          data: { auctionId: auction.id, productName: auction.product.name, finalPrice: auction.current_price },
          action_href: `/seller/auctions/${auction.id}`,
        })
      } else {
        await this.notifications.create(sellerId, {
          category: 'auction',
          type: 'auction_ended_no_bids',
          data: { auctionId: auction.id, productName: auction.product.name },
          action_href: `/seller/auctions/${auction.id}`,
        })
      }

      this.gateway.broadcastAuctionEnded(auction.id, {
        winnerId: auction.current_bidder_id,
        finalPrice: auction.current_price,
      })

      this.logger.log(`Auction ${auction.id} ended (winner: ${auction.current_bidder_id ?? 'none'})`)
    }
  }
}
