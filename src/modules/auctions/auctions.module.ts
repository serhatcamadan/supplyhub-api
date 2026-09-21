import { Module } from '@nestjs/common'
import { AuctionsController } from './auctions.controller.js'
import { AuctionsService } from './auctions.service.js'
import { AuctionsGateway } from './auctions.gateway.js'
import { AuctionsSweepService } from './auctions-sweep.service.js'
import { NotificationsModule } from '../notifications/notifications.module.js'

@Module({
  imports: [NotificationsModule],
  controllers: [AuctionsController],
  providers: [AuctionsService, AuctionsGateway, AuctionsSweepService],
})
export class AuctionsModule {}
