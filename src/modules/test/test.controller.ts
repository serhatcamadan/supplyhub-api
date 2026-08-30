import { Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { TestService } from './test.service.js'

@ApiTags('test')
@Controller('test')
export class TestController {
  constructor(private readonly service: TestService) {}

  @Post('reset')
  @ApiOperation({ summary: 'Reset mutable test data to seed state (non-production only)' })
  reset() {
    return this.service.reset()
  }
}
