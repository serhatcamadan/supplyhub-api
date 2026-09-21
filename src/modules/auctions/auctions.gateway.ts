import { HttpException, Logger } from '@nestjs/common'
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { SkipThrottle } from '@nestjs/throttler'
import type { Server, Socket } from 'socket.io'
import { AuctionsService } from './auctions.service.js'
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js'

interface BidErrorBody {
  code?: string
  message?: string | string[]
  currentPrice?: number
}

// The app-wide ThrottlerGuard (registered as APP_GUARD) assumes an HTTP response object
// (it calls res.header(...) to set X-RateLimit-* headers) and crashes on a WS execution
// context, which has no such response. Skip it here — throttling a WebSocket gateway would
// need its own WS-aware guard anyway, which is out of scope for this feature.
@SkipThrottle()
@WebSocketGateway({
  namespace: 'auctions',
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class AuctionsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server
  private readonly logger = new Logger(AuctionsGateway.name)

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly service: AuctionsService,
  ) {}

  // A socket's identity is verified once at handshake and doesn't change for its lifetime —
  // no per-message re-verification needed (unlike a stateless HTTP request per call).
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined
    if (!token) {
      client.disconnect(true)
      return
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      })
      client.data.user = payload
    } catch {
      client.disconnect(true)
    }
  }

  @SubscribeMessage('join_auction')
  handleJoin(@MessageBody() data: { auctionId: string }, @ConnectedSocket() client: Socket) {
    client.join(`auction:${data.auctionId}`)
  }

  @SubscribeMessage('leave_auction')
  handleLeave(@MessageBody() data: { auctionId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`auction:${data.auctionId}`)
  }

  @SubscribeMessage('place_bid')
  async handlePlaceBid(
    @MessageBody() data: { auctionId: string; amount: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as JwtPayload | undefined
    if (!user) return { ok: false, code: 'unauthorized', message: 'Not authenticated' }

    try {
      const result = await this.service.placeBid(data.auctionId, data.amount, user)
      this.broadcastNewBid(data.auctionId, result)
      return { ok: true }
    } catch (err) {
      const body = err instanceof HttpException ? (err.getResponse() as BidErrorBody | string) : {}
      const normalized = typeof body === 'string' ? { message: body } : body
      this.logger.debug(`place_bid rejected for auction ${data.auctionId}: ${normalized.message}`)
      return { ok: false, code: normalized.code ?? 'unknown', message: normalized.message, currentPrice: normalized.currentPrice }
    }
  }

  broadcastNewBid(auctionId: string, result: { auction: unknown; bid: unknown }) {
    this.server.to(`auction:${auctionId}`).emit('new_bid', result)
  }

  broadcastAuctionCancelled(auctionId: string) {
    this.server.to(`auction:${auctionId}`).emit('auction_ended', { auctionId, reason: 'cancelled' })
  }

  broadcastAuctionEnded(auctionId: string, payload: { winnerId: string | null; finalPrice: number }) {
    this.server.to(`auction:${auctionId}`).emit('auction_ended', { auctionId, reason: 'expired', ...payload })
  }
}
