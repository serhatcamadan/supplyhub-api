import { Module } from '@nestjs/common'
import { QuoteRequestsController } from './quote-requests.controller.js'
import { QuoteRequestsService } from './quote-requests.service.js'
import { NotificationsModule } from '../notifications/notifications.module.js'

@Module({
  imports: [NotificationsModule],
  controllers: [QuoteRequestsController],
  providers: [QuoteRequestsService],
})
export class QuoteRequestsModule {}
