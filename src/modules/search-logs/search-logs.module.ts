import { Module } from '@nestjs/common'
import { SearchLogsController } from './search-logs.controller.js'
import { SearchLogsService } from './search-logs.service.js'

@Module({
  controllers: [SearchLogsController],
  providers: [SearchLogsService],
  exports: [SearchLogsService],
})
export class SearchLogsModule {}
