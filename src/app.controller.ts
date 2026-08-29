import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service.js'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello()
  }

  @Get('health/db')
  async testDb() {
    const companies = await this.appService.getCompanies()
    return { ok: true, count: companies.length, companies }
  }
}
