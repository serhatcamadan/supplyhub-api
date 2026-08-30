import { Module } from '@nestjs/common'
import { QuoteRequestsController } from './quote-requests.controller.js'
import { QuoteRequestsService } from './quote-requests.service.js'

@Module({
  controllers: [QuoteRequestsController],
  providers: [QuoteRequestsService],
})
export class QuoteRequestsModule {}
